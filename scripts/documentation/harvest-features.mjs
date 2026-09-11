/**
 * Phase 4 — product feature harvest.
 *
 * A feature is a CAPABILITY of the product, not a class. The evidence for what capabilities exist is
 * already in the repository in a form the team itself created: `src/Application/<Module>/Commands|
 * Queries/<UseCase>/` is this codebase's own decomposition of what the product does, one folder per
 * use case. Grouping those folders into capabilities, and attaching the API routes, frontend routes
 * and permissions that serve them, produces a feature catalogue derived from the product rather than
 * imagined for it.
 *
 * THE THREE QUESTIONS ARE KEPT APART. `implementation_status` answers only "is there code". Whether
 * anything SPECIFIED it, and whether anything TESTS it, are separate fields computed from the
 * requirement and test registries — because "specified but not built" and "built but never
 * specified" are the two findings a documentation platform exists to surface, and a single
 * "implemented" flag hides both.
 *
 * Usage: node scripts/documentation/harvest-features.mjs [--dry-run] [--quiet]
 */

import fs from "node:fs";
import path from "node:path";
import { DATA_DIRS, REPO_ROOT, rel, readJson, writeJson, writeJsonIfChanged } from "./lib/paths.mjs";
import * as git from "./lib/git.mjs";
import { scrub } from "./lib/redact.mjs";
import { IdLedger } from "./lib/ids.mjs";
import { SCHEMA_VERSION, HARVESTER_VERSION, CONFIDENCE, evidence, confirmed, inferred, mergeHarvested } from "./lib/entity.mjs";

const GENERATOR = "harvest-features.mjs";

/** `coverage` is owned by build-traceability — see the note in harvest-requirements.mjs. */
const HUMAN_FIELDS = [
  "name", "simple_explanation", "business_purpose", "users", "user_journey", "workflow",
  "business_rules", "scenarios", "feature_flag", "requirements", "components", "test_cases",
  "test_plans", "routes", "change_history", "coverage",
];

/**
 * Use-case folders grouped into capabilities.
 *
 * The left column is a real directory under `src/Application/<Module>/`; the right is the capability
 * a shop would name. CRUD folders collapse into one "Management" capability because "Create
 * Customer" and "Edit Customer" are one thing to the person using the product. Anything not listed
 * keeps its own name — an unrecognised use case becomes its own feature rather than being forced
 * into a bucket it does not belong in.
 */
const CAPABILITY_MAP = new Map(Object.entries({
  Create: "Management", Update: "Management", Delete: "Management", GetById: "Management",
  Search: "Management", ListAll: "Management", FindDuplicates: "Duplicate Detection",
  Import: "Import & Export", Export: "Import & Export",
  AddItem: "Order Items", RemoveItem: "Order Items", UpdateItem: "Order Items", SetItemFabric: "Order Items",
  TransitionStatus: "Status Lifecycle", AssignEmployee: "Work Assignment",
  PreviousForCustomer: "Customer Order History", OrderHistory: "Employee Work History",
  RecordPayment: "Payment Recording", Void: "Invoice Voiding",
  GetShareToken: "Invoice Sharing", GetPublicInvoice: "Invoice Sharing",
  Receive: "Cloth Receiving", Stock: "Stock Levels",
  UpdateValues: "Measurement Capture", ByCustomer: "Measurement Capture", History: "Measurement History",
  Templates: "Measurement Templates",
  Retire: "Employee Retirement",
  RecordContact: "Occasion Follow-up",
  Send: "Message Sending", RecordShare: "Share Tracking",
  Login: "Sign In", Register: "Registration", RefreshAccessToken: "Session Renewal",
  ChangePassword: "Password Change", RedeemResetCode: "Password Reset",
  Revenue: "Revenue Reporting", OrderCollections: "Collections Reporting",
  OrderStatusSummary: "Order Status Reporting", OutstandingInvoices: "Outstanding Invoice Reporting",
  Upsert: "Settings Management", GetByKey: "Settings Management", List: "Settings Management",
  Filters: "Activity Filtering",
}));

/** The noun a module is called in the product. */
const MODULE_NOUN = {
  ORDER: "Order", CUSTOMER: "Customer", MEASUREMENT: "Measurement", EMPLOYEE: "Employee",
  BILLING: "Invoice", PRICING: "Cloth Pricing", INVENTORY: "Inventory", REPORT: "Reports",
  WHATSAPP: "WhatsApp", SETTING: "Settings", USER: "User", ACTIVITY: "Activity Log",
  AUTH: "Authentication", OCCASION: "Occasion", PLATFORM: "Platform", WEB: "Web", TOOLING: "Tooling",
};

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const QUIET = args.has("--quiet");
const log = (...parts) => { if (!QUIET) console.log(...parts); };

function main() {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const branch = git.currentBranch();
  const head = git.headSha();

  const components = loadAll(DATA_DIRS.source, "components");
  const testCases = loadAll(DATA_DIRS.testcases, "test_cases");
  const requirements = loadRequirements();
  const rules = loadAll(DATA_DIRS.rules, "rules");
  const routeTable = readJson(path.join(REPO_ROOT, "docs/registry/route-table.json"))?.routes ?? [];

  if (components.length === 0) {
    console.error("No components. Run `npm run docs:harvest:source` first.");
    process.exit(1);
  }

  const componentById = new Map(components.map((c) => [c.id, c]));
  const rulesByComponent = new Map();
  for (const rule of rules) {
    for (const componentId of rule.components ?? []) {
      if (!rulesByComponent.has(componentId)) rulesByComponent.set(componentId, new Set());
      rulesByComponent.get(componentId).add(rule.id);
    }
  }

  const testsByComponent = new Map();
  for (const testCase of testCases) {
    for (const edge of testCase.machine?.exercises ?? []) {
      if (!testsByComponent.has(edge.component)) testsByComponent.set(edge.component, new Set());
      testsByComponent.get(edge.component).add(testCase.id);
    }
  }

  // ---------------------------------------------------------------- group use cases into features

  const groups = new Map();

  for (const component of components) {
    const useCase = useCaseOf(component.path);
    if (!useCase) continue;

    const capability = CAPABILITY_MAP.get(useCase.name) ?? humanize(useCase.name);
    const key = `${component.module}|${capability}`;
    if (!groups.has(key)) {
      groups.set(key, {
        module: component.module,
        capability,
        useCases: new Set(),
        components: new Set(),
        paths: new Set(),
      });
    }
    const group = groups.get(key);
    group.useCases.add(useCase.name);
    group.components.add(component.id);
    group.paths.add(useCase.folder);
  }

  /*
   * A feature reaches beyond its use-case folder.
   *
   * Grouping only `src/Application/<Module>/…` left `Order` — the aggregate every order feature is
   * about — belonging to no feature at all, because it lives in `src/Domain`. So each feature also
   * claims the components its use cases DEPEND ON, one hop, within the same module. The edge is the
   * one the method-level analysis established: `CreateOrderCommandHandler` calls `Order.Create(...)`
   * at a known line. Restricted to one hop and one module, because two hops would pull in half the
   * platform and say nothing.
   */
  for (const group of groups.values()) {
    for (const componentId of [...group.components]) {
      const component = componentById.get(componentId);
      for (const dependency of component?.machine?.depends_on ?? []) {
        const target = dependency.target_component ? componentById.get(dependency.target_component) : null;
        if (!target || target.module !== group.module) continue;
        if (!["Domain", "Infrastructure"].includes(target.layer)) continue;
        group.components.add(target.id);
      }
    }
  }

  // Frontend routes join the feature of their module, as the screens that serve it.
  const frontendByModule = new Map();
  for (const component of components) {
    if (component.kind !== "route" || !component.machine.namespace) continue;
    if (!frontendByModule.has(component.module)) frontendByModule.set(component.module, []);
    frontendByModule.get(component.module).push({ route: component.machine.namespace, component: component.id });
  }

  // API routes join by controller action name, which mirrors the use-case name in this codebase.
  const routesByModuleCapability = new Map();
  for (const route of routeTable) {
    const controllerComponent = components.find((c) => c.name === route.controller);
    if (!controllerComponent) continue;
    const capability = CAPABILITY_MAP.get(route.action) ?? humanize(route.action);
    const key = `${controllerComponent.module}|${capability}`;
    if (!routesByModuleCapability.has(key)) routesByModuleCapability.set(key, []);
    routesByModuleCapability.get(key).push(route);
  }

  // ---------------------------------------------------------------- build entities

  const ledger = IdLedger.open("FEAT", "feature-id-ledger.json");
  const features = [];
  const stats = { byModule: {}, byStatus: {}, withRequirements: 0, withTests: 0, routesAttached: 0 };

  for (const [key, group] of [...groups.entries()].sort()) {
    // "Invoice Invoice Sharing" and "Order Order Items" — the capability already carries the noun
    // in those cases, so prefixing it again reads as a stutter.
    const noun = MODULE_NOUN[group.module] ?? group.module;
    const capabilityMentionsNoun = new RegExp(`\\b${noun}s?\\b`, "i").test(group.capability);
    const name = capabilityMentionsNoun ? group.capability : `${noun} ${group.capability}`;

    const id = ledger.idFor(`feature:${key}`, group.module, today);
    const componentIds = [...group.components].sort();

    const apiRoutes = routesByModuleCapability.get(key) ?? [];
    stats.routesAttached += apiRoutes.length;
    const permissions = [...new Set(apiRoutes.map((r) => r.policy).filter(Boolean))].sort();

    const relatedTests = new Set();
    const relatedRules = new Set();
    for (const componentId of componentIds) {
      for (const testId of testsByComponent.get(componentId) ?? []) relatedTests.add(testId);
      for (const ruleId of rulesByComponent.get(componentId) ?? []) relatedRules.add(ruleId);
    }

    // Requirements are attached by MODULE, and only where the requirement is module-specific. A
    // PLATFORM requirement governs everything, so attaching it to every feature would say nothing.
    const relatedRequirements = requirements
      .filter((r) => r.module === group.module && r.module !== "PLATFORM")
      .map((r) => r.id)
      .sort();

    const featureEvidence = [
      ...[...group.paths].slice(0, 4).map((folder) => evidence.file(folder, "use-case folder")),
      ...apiRoutes.slice(0, 3).map((r) => evidence.route(r.file, `${r.method} ${r.route}`, r.line)),
    ];

    const implemented = componentIds.length > 0;
    const specified = relatedRequirements.length > 0;
    const status = !implemented ? "ABSENT"
      : specified ? "IMPLEMENTED"
      : "UNDOCUMENTED_CODE";

    stats.byModule[group.module] = (stats.byModule[group.module] ?? 0) + 1;
    stats.byStatus[status] = (stats.byStatus[status] ?? 0) + 1;
    if (specified) stats.withRequirements++;
    if (relatedTests.size) stats.withTests++;

    const gitInfo = latestGit(componentIds.map((cid) => componentById.get(cid)).filter(Boolean));

    features.push({
      id,
      schema_version: SCHEMA_VERSION,
      entity_version: 1,
      name,
      module: group.module,
      simple_explanation: `${name} — derived from the ${[...group.useCases].sort().join(", ")} use case${group.useCases.size > 1 ? "s" : ""} in src/Application/${titleCase(group.module)}. A plain-language description has not been written yet.`,
      business_purpose: null,
      users: [],
      user_journey: [],
      workflow: [],
      business_rules: [],
      scenarios: [],
      feature_flag: null,
      implementation: {
        paths: [...group.paths].sort(),
        evidence: componentIds.slice(0, 3).map((cid) => {
          const component = componentById.get(cid);
          return { kind: "symbol", file: component.path, contains: component.name.replace(/<.*$/, ""), pattern: null };
        }),
      },
      implementation_status: status,
      implementation_status_evidence:
        status === "IMPLEMENTED" ? `${componentIds.length} component(s) and ${relatedRequirements.length} module requirement(s)`
        : status === "UNDOCUMENTED_CODE" ? `${componentIds.length} component(s) exist; no module-specific requirement was found in the FRS`
        : "no components found",
      coverage: {
        specified: specified ? "YES" : "NO",
        implemented: implemented ? "YES" : "NOT_FOUND",
        tested: relatedTests.size === 0 ? "NOT_FOUND" : relatedTests.size >= componentIds.length ? "YES" : "PARTIAL",
        component_count: componentIds.length,
        test_count: relatedTests.size,
        requirement_count: relatedRequirements.length,
        rule_count: relatedRules.size,
        computed_at: now,
      },
      machine: {
        capability: group.capability,
        use_cases: [...group.useCases].sort(),
        api_routes: apiRoutes.map((r) => ({
          method: r.method, route: r.route, policy: r.policy, controller: r.controller, action: r.action,
        })),
        frontend_routes: (frontendByModule.get(group.module) ?? []).map((f) => f.route).sort(),
        permissions,
        derived_components: componentIds,
        derived_test_cases: [...relatedTests].sort(),
        derived_rules: [...relatedRules].sort(),
        derived_requirements: relatedRequirements,
        git: gitInfo,
      },
      requirements: [],
      components: [],
      test_cases: [],
      test_plans: [],
      routes: apiRoutes.map((r) => `${r.method} ${r.route}`).sort(),
      status: "draft",
      data_classification: "PUBLIC_SAFE",
      provenance: confirmed(GENERATOR, featureEvidence, now,
        "Capability derived by grouping this codebase's own use-case folders; naming and plain-language description await a human."),
      last_verified_commit: gitInfo.last_commit,
      change_history: [],
    });
  }

  // ---------------------------------------------------------------- write

  const retired = ledger.retireUnseen(today);
  const written = [];
  for (const feature of features) {
    const file = path.join(DATA_DIRS.features, `${feature.id}.json`);
    const existing = readJson(file);
    const merged = mergeHarvested(existing, feature, HUMAN_FIELDS);
    const { entity: safe } = scrub(merged, { context: `${feature.id}:` });
    const changed = !DRY_RUN && writeJsonIfChanged(file, safe);
    written.push({ changed });
  }

  if (!DRY_RUN) {
    ledger.save();
    writeJson(path.join(REPO_ROOT, "docs/registry/feature-harvest-summary.json"), {
      branch, head, generated_at: now, total: features.length, stats, retired_ids: retired,
    });
  }

  log(`Harvested features on ${branch} @ ${head.slice(0, 8)}`);
  log(`  features             ${features.length}`);
  log(`  by module            ${JSON.stringify(sortCounts(stats.byModule))}`);
  log(`  implementation       ${JSON.stringify(stats.byStatus)}`);
  log(`  with requirements    ${stats.withRequirements}   with tests ${stats.withTests}`);
  log(`  API routes attached  ${stats.routesAttached} of ${routeTable.length}`);
  log(`  wrote                ${written.filter((w) => w.changed).length} of ${written.length} files changed${DRY_RUN ? " (DRY RUN)" : ""}`);
}

/** `src/Application/Orders/Commands/TransitionStatus/X.cs` -> { name: TransitionStatus, folder }. */
function useCaseOf(componentPath) {
  const match = /^(src\/Application\/[^/]+\/(?:Commands|Queries)(?:\/[^/]+)?\/([^/]+))\/[^/]+\.cs$/.exec(componentPath);
  if (!match) return null;
  return { folder: match[1], name: match[2] };
}

function loadAll(dir, key) {
  const items = [];
  if (!fs.existsSync(dir)) return items;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    for (const item of readJson(path.join(dir, file))?.[key] ?? []) items.push(item);
  }
  return items;
}

function loadRequirements() {
  const items = [];
  if (!fs.existsSync(DATA_DIRS.requirements)) return items;
  for (const file of fs.readdirSync(DATA_DIRS.requirements)) {
    if (!file.endsWith(".json")) continue;
    const requirement = readJson(path.join(DATA_DIRS.requirements, file));
    if (requirement?.id) items.push(requirement);
  }
  return items;
}

function latestGit(components) {
  let best = { state: "UNKNOWN", last_commit: null, last_commit_date: null };
  for (const component of components) {
    const info = component.machine?.git;
    if (!info?.last_commit_date) continue;
    if (!best.last_commit_date || info.last_commit_date > best.last_commit_date) {
      best = { state: info.state, last_commit: info.last_commit, last_commit_date: info.last_commit_date };
    }
  }
  return best;
}

function humanize(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

function titleCase(module) {
  return module.charAt(0) + module.slice(1).toLowerCase();
}

function sortCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

main();
