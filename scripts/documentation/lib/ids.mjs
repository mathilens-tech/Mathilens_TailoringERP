/**
 * Stable entity identity.
 *
 * The requirement is blunt: "Do not use unstable names as primary identifiers." A harvester that
 * numbered components in directory order would renumber the whole registry the first time someone
 * added a file, and every stored cross-reference — every requirement pointing at COMP-ORDER-015 —
 * would silently start pointing somewhere else.
 *
 * So identity is assigned once, against a NATURAL KEY (`path#Symbol`), and persisted in a ledger
 * committed alongside the data. Rules:
 *
 *   - A natural key seen before keeps its ID, wherever the file has moved to in the listing.
 *   - A new key takes the next free number for its module.
 *   - A key that disappears is marked `retired: true` and its number is NEVER reused. Reuse would
 *     make an old document silently describe a different component.
 *   - A rename can be recorded as an alias, so history survives the rename.
 *
 * The ledger is data, not output: it is committed, and losing it would scramble every ID.
 */

import path from "node:path";
import { DATA, readJson, writeJson } from "./paths.mjs";

const LEDGER_SCHEMA_VERSION = "1.0.0";

/**
 * Which business module a repo-relative path belongs to.
 *
 * Ordered most-specific first. The module list is closed (see common.schema.json#moduleId) and
 * derived from Shared/Authorization/Permissions.cs, so a new module is a deliberate decision rather
 * than something a path can invent.
 */
const MODULE_RULES = [
  [/^src\/[^/]+\/Orders?\b/i, "ORDER"],
  [/^web\/src\/(app\/dashboard\/orders|lib\/orders)\b/i, "ORDER"],
  [/^src\/[^/]+\/Customers?\b/i, "CUSTOMER"],
  [/^web\/src\/app\/dashboard\/customers\b/i, "CUSTOMER"],
  [/^src\/[^/]+\/Measurements?\b/i, "MEASUREMENT"],
  [/^web\/src\/(app\/dashboard\/measurements|components\/measurements)\b/i, "MEASUREMENT"],
  [/^src\/[^/]+\/Employees?\b/i, "EMPLOYEE"],
  [/^web\/src\/app\/dashboard\/(employees?|employee)\b/i, "EMPLOYEE"],
  [/^src\/[^/]+\/Billing\b/i, "BILLING"],
  [/^web\/src\/(app\/(dashboard\/invoices|invoice)|components\/(billing|orders\/Invoice))/i, "BILLING"],
  [/^src\/[^/]+\/Pricing\b/i, "PRICING"],
  [/^web\/src\/app\/dashboard\/price-detail\b/i, "PRICING"],
  [/^src\/[^/]+\/Inventory\b/i, "INVENTORY"],
  [/^web\/src\/app\/dashboard\/(inventory|stock)\b/i, "INVENTORY"],
  [/^src\/[^/]+\/Reports?\b/i, "REPORT"],
  [/^web\/src\/app\/dashboard\/reports\b/i, "REPORT"],
  [/^src\/[^/]+\/WhatsApp\b/i, "WHATSAPP"],
  [/^web\/src\/(app\/dashboard\/whatsapp|components\/whatsapp|lib\/whatsapp)\b/i, "WHATSAPP"],
  [/^src\/[^/]+\/Settings?\b/i, "SETTING"],
  [/^web\/src\/app\/dashboard\/settings\b/i, "SETTING"],
  [/^src\/[^/]+\/Occasions?\b/i, "OCCASION"],
  [/^src\/[^/]+\/(Users?|Identity|Authorization)\b/i, "USER"],
  [/^web\/src\/(app\/dashboard\/(users|user-roles|user-rights|profile)|components\/users)\b/i, "USER"],
  [/^src\/[^/]+\/Auth\b/i, "AUTH"],
  [/^web\/src\/app\/(login|register)\b/i, "AUTH"],
  [/^src\/[^/]+\/Activity\b/i, "ACTIVITY"],
  [/^web\/src\/app\/dashboard\/activity\b/i, "ACTIVITY"],
  [/^tools\//i, "TOOLING"],
  [/^scripts\//i, "TOOLING"],
  [/^web\//i, "WEB"],
  [/^src\//i, "PLATFORM"],
  [/^tests\//i, "PLATFORM"],
];

/**
 * The Api layer names its module in the FILE, not the folder.
 *
 * `src/Api/Controllers/V1/OrdersController.cs` and `src/Api/Contracts/Orders/CreateOrderRequest.cs`
 * both belong to ORDER, but the path-prefix rules below see only `src/Api/...` and answered
 * PLATFORM. That put all 15 controllers and every wire contract in PLATFORM — which in turn meant
 * not one of the 93 API routes could be attached to the feature it serves, because the controller
 * and the use case appeared to be in different modules.
 */
const API_NOUN_TO_MODULE = new Map(Object.entries({
  order: "ORDER", customer: "CUSTOMER", measurement: "MEASUREMENT", employee: "EMPLOYEE",
  invoice: "BILLING", publicinvoice: "BILLING", billing: "BILLING", payment: "BILLING",
  clothprice: "PRICING", pricing: "PRICING", inventory: "INVENTORY", report: "REPORT",
  whatsappmessage: "WHATSAPP", whatsapp: "WHATSAPP", setting: "SETTING", user: "USER",
  activitylog: "ACTIVITY", activity: "ACTIVITY", auth: "AUTH", occasion: "OCCASION",
}));

function apiModuleFor(relativePath) {
  const controller = /^src\/Api\/Controllers\/V\d+\/([A-Za-z]+?)s?Controller\.cs$/.exec(relativePath);
  if (controller) {
    return API_NOUN_TO_MODULE.get(controller[1].toLowerCase()) ?? null;
  }
  const contract = /^src\/Api\/Contracts\/([A-Za-z]+?)s?\//.exec(relativePath);
  if (contract) {
    return API_NOUN_TO_MODULE.get(contract[1].toLowerCase()) ?? null;
  }
  return null;
}

export function moduleFor(relativePath) {
  const fromApi = apiModuleFor(relativePath);
  if (fromApi) return fromApi;

  for (const [pattern, module] of MODULE_RULES) {
    if (pattern.test(relativePath)) return module;
  }
  return "PLATFORM";
}

/**
 * The module a TEST belongs to.
 *
 * Folder names alone are not enough, and this repository shows why: `tests/UnitTests/Domain/Orders/`
 * and `tests/IntegrationTests/Orders/` describe the same module through two different shapes, and
 * `tests/UnitTests/Shared/Numbering/OrderNumberFormatTests.cs` sits under Shared while testing order
 * numbering. So three sources of evidence are used, strongest first, and which one answered is
 * recorded on the entity:
 *
 *   1. `subject` — the production component the test exercises. If the test builds `Order` and
 *      `TransitionOrderStatusCommandHandler`, its module is theirs. This is the only evidence that
 *      survives a test being moved to a different folder.
 *   2. `namespace` — `MathilensERP.UnitTests.Application.Orders.Commands.TransitionStatus` mirrors
 *      the production namespace exactly, with the test project name spliced in. Strip that and the
 *      remainder maps through the same rules as a source path.
 *   3. `path` — the fallback, and the weakest, for the same reason.
 *
 * Returns { module, source } so nothing downstream has to guess how confident to be.
 */
export function moduleForTest({ namespace, relativePath, subjectModules = [] }) {
  // 1. What the test actually exercises.
  const distinct = [...new Set(subjectModules.filter((m) => m && m !== "PLATFORM"))];
  if (distinct.length === 1) {
    return { module: distinct[0], source: "subject-components" };
  }

  // 2. The namespace, mapped through the production rules.
  if (namespace) {
    const withoutProject = namespace
      .replace(/^MathilensERP\.(UnitTests|IntegrationTests|Tests)\.?/, "")
      .replace(/\./g, "/");
    if (withoutProject) {
      const asSourcePath = `src/${withoutProject}/x.cs`;
      for (const [pattern, module] of MODULE_RULES) {
        if (pattern.test(asSourcePath)) return { module, source: `namespace(${namespace})` };
      }
      // A test namespace that names the module directly, e.g. IntegrationTests.Orders -> src/Orders
      const firstSegment = withoutProject.split("/")[0];
      const direct = `src/Api/${firstSegment}/x.cs`;
      for (const [pattern, module] of MODULE_RULES) {
        if (pattern.test(direct)) return { module, source: `namespace(${namespace})` };
      }
    }
  }

  // 3. The path, mapped the same way, with the test project prefix removed.
  const withoutProjectPath = relativePath.replace(/^tests\/[^/]+\//, "");
  for (const [pattern, module] of MODULE_RULES) {
    if (pattern.test(`src/${withoutProjectPath}`)) return { module, source: `path(${relativePath})` };
  }

  return { module: "PLATFORM", source: "fallback:no-module-evidence" };
}

/** Which architectural layer a path sits in. Structural, not inferred. */
export function layerFor(relativePath) {
  if (/^src\/Domain\//.test(relativePath)) return "Domain";
  if (/^src\/Application\//.test(relativePath)) return "Application";
  if (/^src\/Infrastructure\//.test(relativePath)) return "Infrastructure";
  if (/^src\/Api\//.test(relativePath)) return "Api";
  if (/^src\/Shared\//.test(relativePath)) return "Shared";
  if (/^web\//.test(relativePath)) return "Web";
  if (/^tests\//.test(relativePath)) return "Tests";
  if (/^tools\//.test(relativePath)) return "Tools";
  return "Unknown";
}

/** The natural key an ID is assigned against. Must be stable across harvests. */
export function naturalKey(relativePath, symbol) {
  return symbol ? `${relativePath}#${symbol}` : relativePath;
}

export class IdLedger {
  constructor(prefix, file) {
    this.prefix = prefix;
    this.file = file;
    const loaded = readJson(file);
    this.data = loaded ?? {
      schema_version: LEDGER_SCHEMA_VERSION,
      prefix,
      next: {},
      entries: {},
    };
    this.seen = new Set();
  }

  static open(prefix, fileName) {
    return new IdLedger(prefix, path.join(DATA, fileName));
  }

  /**
   * The ID for this natural key, minting one if it is new.
   *
   * `today` is passed in rather than read from the clock so a harvest is reproducible in a test.
   */
  idFor(key, module, today) {
    this.seen.add(key);
    const existing = this.data.entries[key];
    if (existing) {
      existing.last_seen = today;
      existing.retired = false;
      return existing.id;
    }

    const nextNumber = (this.data.next[module] ?? 0) + 1;
    this.data.next[module] = nextNumber;
    const id = `${this.prefix}-${module}-${String(nextNumber).padStart(3, "0")}`;
    this.data.entries[key] = { id, first_seen: today, last_seen: today, retired: false, aliases: [] };
    return id;
  }

  /**
   * Marks keys that were not seen in this run as retired. Their numbers stay spent — a retired ID
   * is never handed to a different component, because an old report referring to it must not
   * quietly start describing something else.
   */
  retireUnseen(today) {
    const retired = [];
    for (const [key, entry] of Object.entries(this.data.entries)) {
      if (!this.seen.has(key) && !entry.retired) {
        entry.retired = true;
        entry.last_seen = entry.last_seen ?? today;
        retired.push(entry.id);
      }
    }
    return retired;
  }

  stats() {
    const entries = Object.values(this.data.entries);
    return {
      total: entries.length,
      active: entries.filter((e) => !e.retired).length,
      retired: entries.filter((e) => e.retired).length,
    };
  }

  save() {
    // Sorted so the committed file diffs cleanly rather than reordering on every run.
    const sortedEntries = {};
    for (const key of Object.keys(this.data.entries).sort()) {
      sortedEntries[key] = this.data.entries[key];
    }
    const sortedNext = {};
    for (const key of Object.keys(this.data.next).sort()) {
      sortedNext[key] = this.data.next[key];
    }
    writeJson(this.file, { ...this.data, next: sortedNext, entries: sortedEntries });
  }
}
