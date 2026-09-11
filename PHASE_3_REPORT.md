# Phase 3 — Test Harvest

**Branch:** `dev` @ `fec30963` · **Date:** 2026-09-06 · **Status:** complete and validated

Every figure below came from running the code. Nothing in this report is estimated.

---

## 1. What was implemented

| Capability | Delivered as |
|---|---|
| Test discovery and parsing | `lib/csharp-tests.mjs` — method bodies, attributes, Theory rows, literal API paths, asserted literals |
| Test harvest → `TC-*` entities | `harvest-tests.mjs` (`npm run docs:harvest:tests`) |
| Evidence-based module classification | `moduleForTest()` in `lib/ids.mjs` — subject → namespace → path, with the deciding evidence recorded |
| Component → TestCase edges | six evidence channels, each with its own `via` and confidence |
| TestCase → Component | `machine.exercises[]` on every test case |
| Component → TestCase (reverse) | `docs/registry/component-test-index.json`, derived and regenerated |
| Real test-result recording | `record-test-run.mjs` — TRX only, never inference |
| Test validation | four new checks in `validate-documentation.mjs` |
| `knowledge_ref` population | `link-knowledge.mjs` — conservative, evidence-recorded |
| True idempotency | `writeJsonIfChanged()` in `lib/paths.mjs` |

The Phase 1/2 architecture was not redesigned. The `machine`/human split, the ID ledger, the
evidence/confidence model, the redaction gate and the merge-not-overwrite rule are all reused as-is.

## 2. Files created / modified

**Created (6):** `scripts/documentation/harvest-tests.mjs` (519), `lib/csharp-tests.mjs` (333),
`record-test-run.mjs` (160), `link-knowledge.mjs` (156), `PHASE_3_REPORT.md`, and 13 module
registries under `docs/data/testcases/` plus `docs/data/testcase-id-ledger.json`.

**Modified (7):** `docs/schemas/testcase.schema.json` (extended), `lib/ids.mjs` (`moduleForTest`),
`lib/paths.mjs` (`writeJsonIfChanged`), `harvest-source.mjs` (excludes `tests/`),
`validate-documentation.mjs` (test checks), `package.json` (scripts),
`scripts/build-knowledge-html.js` (CommonJS → ESM regression fix), `knowledge.md` (factual
correction), `knowledge.html` (regenerated).

**Untouched:** `src/`, `web/`, `tests/` — no product or test behaviour was changed. The 12
pre-existing working-tree modifications are exactly as they were; nothing was committed, stashed,
reset or reverted.

## 3–6. Discovery and entity counts

| | |
|---|---|
| Test projects discovered | **2** — `UnitTests` (96 files), `IntegrationTests` (15 files) |
| Test files discovered | **111** (109 contain tests; `CustomWebApplicationFactory.cs` and `TestAuthentication.cs` correctly contain none) |
| Test classes | **112** |
| `[Fact]` methods | **454** |
| `[Theory]` methods | **35** |
| **Total `TC-*` entities** | **489** |
| `[InlineData]` rows retained as metadata | 115 |

489 matches the Phase 0 count of test attributes exactly — an independent cross-check, since Phase 0
counted with `grep` and Phase 3 counted with a parser.

**A `[Theory]` is one test case.** Its rows live in `machine.inline_data`. Minting a case per row
would have turned 489 methods into ~570 entities that no report would ever show separately.

## 7. Tests by module

| Module | Tests | | Module | Tests |
|---|---|---|---|---|
| PLATFORM | 127 | | INVENTORY | 14 |
| ORDER | 84 | | REPORT | 14 |
| CUSTOMER | 50 | | ACTIVITY | 11 |
| MEASUREMENT | 43 | | AUTH | 10 |
| BILLING | 43 | | SETTING | 15 |
| EMPLOYEE | 40 | | USER | 20 |
| WHATSAPP | 18 | | | |

**Module classification is fixed.** `tests/UnitTests/Domain/Orders/OrderTests.cs` is now ORDER, not
PLATFORM. The evidence that decided each one is recorded: **290 by subject-components** (the
production types the test actually builds — the strongest signal, and one that survives a file
being moved) and **199 by namespace**. **Zero** fell back to path or to the no-evidence default.

PLATFORM's 127 are genuinely platform: `Shared` (Guard, Result, phone/email), the mediator, the
pipeline behaviors, and cross-cutting authorization tests. `OrderNumberFormatTests` sits in PLATFORM
because `OrderNumberFormat` itself lives in `src/Shared/Numbering` — the test follows its subject,
which is the rule, even where intuition might say ORDER.

## 8. Tests by type and category

Two independent axes, each with its evidence recorded per test.

| `type` (what kind of check) | | `category` (which area) | |
|---|---|---|---|
| positive | 227 | Application | 259 |
| negative | 150 | Domain | 119 |
| security | 40 | Integration | 67 |
| validation | 39 | Unit | 38 |
| boundary | 25 | Infrastructure | 6 |
| integration | 7 | | |
| api | 1 | | |

No test was classified `NEEDS_REVIEW` — every one had at least one supporting signal (a status-code
assertion, a literal route, a fixture, numeric Theory rows, or the expectation half of the
`Method_Condition_Expectation` convention this repository follows without exception).

## 9. Component → TestCase edges

**1,594 edges covering 199 of 640 product components (31.1%).**

| Evidence channel (`via`) | Edges | Confidence |
|---|---|---|
| `class-name-convention` | 405 | CONFIRMED when corroborated (250), else INFERRED (155) |
| `instantiation` — `new Handler(...)` | 354 | CONFIRMED |
| `class-scope` — shared fields, ctor, private helpers | 335 | INFERRED |
| `static-call` — `Order.Create(...)` | 295 | CONFIRMED |
| `generic-argument` — `Substitute.For<IOrderRepository>()` | 145 | CONFIRMED |
| `http-route` — literal path → controller | 59 | CONFIRMED |
| `declared-type` | 1 | CONFIRMED |

**59 of 59 literal API paths bind to a controller action (100%).**

Both directions are supported: `TestCase → Component` in `machine.exercises[]`, and
`Component → TestCase` in `docs/registry/component-test-index.json`.

## 10. Unresolved and NEEDS_REVIEW relationships

- **53 NEEDS_REVIEW edges** — a referenced name matches more than one component. The edge is kept
  but demoted rather than resolved by guessing.
- **0 unresolved edge targets** — every emitted edge points at a component that exists (validated).
- **Unresolved type references: recorded, not discarded.** The most frequent are `Assert` (482),
  `Guid` (175), `Arg` (119), `CancellationToken` (119), `Substitute` (82),
  `CustomWebApplicationFactory` (59). None is a product component, so none should have become an
  edge. They are listed in `machine.unresolved_references` so a genuine gap in the component
  registry would be visible rather than silent.
- **2 tests link to nothing**, both correctly flagged for review, never deleted:
  `PolicyRegistrationTests.EveryEndpointPolicy_IsRegisteredAtStartup` and
  `NoEndpointDemandsAManageUmbrella`. Both enumerate controllers by **reflection**
  (`typeof(Program).Assembly.GetTypes()`) and name no type. Claiming they exercise all 15
  controllers would be a guess; the flag records exactly why no link was made.

## 11. Validation results

```
npm run docs:validate
Validation (warn mode) — 34 files, 1134 entities, 1.14s
  components 645  requirements 0  features 0  test cases 489  migrations 27
  ERROR 0   WARN 0   INFO 2
```

Four checks added in this phase:

1. Every `machine.exercises[].component` resolves to a real component — **1,594 checked, 0 unresolved**.
2. Every `AUTOMATED` case's `automation_ref` names a file that exists and a method found in it —
   **489 checked, 0 failures**.
3. A recorded result must carry a `run_id`, so a hand-written "passed" cannot survive.
4. Every live entity must have a ledger entry, so an ID minted outside the ledger is caught.

## 12. Actual test execution results

**Executed — real run, real results.**

```
dotnet test tests/UnitTests/MathilensERP.UnitTests.csproj --configuration Release \
  --logger "trx;LogFileName=unit-20260906-phase3.trx"

Passed! - Failed: 0, Passed: 502, Skipped: 0, Total: 502, Duration: 1 s
```

```
node scripts/documentation/record-test-run.mjs <trx> --command="..."
  run_id                trx:a13d30e08fcb800d
  TRX rows              502 across 422 distinct methods
  test cases updated    422   (all passed)
  NOT_RUN (left null)   67
```

- **422 test cases** carry a real `passed` result, each stamped with the run id, the commit and the
  timestamp.
- **67 test cases keep `last_result: null` = NOT_RUN** — every one of them an `IntegrationTests`
  case. I did **not** run them: `CustomWebApplicationFactory` boots the real host and authorization
  queries the database on every authenticated request, so a local run would write into the
  developer's `mathilens_dev` database. That is a side effect on your data that I was not asked to
  cause. The split was verified: `{"UnitTests":422}` have results, `{"IntegrationTests":67}` do not.
- 502 executed cases from 489 methods confirms the Phase 0 inference that `[Theory]` rows expand.

## 13. knowledge.md correction

**Corrected**, in two places, from repository evidence (`using` directives in exactly four files):

> §10.2 previously: "*hand-rolled spreadsheet read/write (no ClosedXML/EPPlus dependency)*"
> Now: a thin wrapper over **ClosedXML 0.105.1**; PDF rendering over **PDFsharp-MigraDoc 6.2.4**,
> with `EmbeddedFontResolver` implementing PdfSharp's `IFontResolver`.

The §2 technology-stack table gained an **Export** row and a **Mocking** row (NSubstitute 6.0.0),
which were missing entirely. `knowledge.html` was regenerated. No unrelated edits were made.

## 14. knowledge_ref linkage

**183 of 645 components linked** (182 by the linker, 1 seeded by hand in Phase 2).

| Outcome | Count | Meaning |
|---|---|---|
| linked | 182 | The component name appears in exactly one knowledge.md section, in a heading or as a code span |
| ambiguous → left null | 64 | Two or more candidate sections; the evidence does not identify one |
| not mentioned → left null | 398 | knowledge.md is a narrative, not an API reference; most components are not discussed individually |

No section was fabricated. Each proposal and its evidence is in
`docs/registry/knowledge-links.json`. `knowledge_ref` remains a human field — the linker only fills
nulls, so a hand-written link always wins and is never overwritten.

## 15. Defects discovered and fixed

Six, all found by running the code and inspecting real output:

| # | Defect | Effect | Fix |
|---|---|---|---|
| 1 | Query strings broke the API-path pattern | Every Reports endpoint test linked to no controller; 15 unbound calls | Query made optional and discarded |
| 2 | `class-scope` excluded **all** method bodies, not just test bodies | 10 tests in `OrderFabricSaleTests`/`OrderWorkTimestampTests` linked to nothing — they reach `Order` only through a private helper | Exclude test-method bodies only |
| 3 | `declared-type` rejected generics | `Result<string> result = "hello"` linked to nothing | Allow a generic argument list |
| 4 | Concrete path values never matched parameterised routes | `/api/v1/settings/Shop.BusinessName` vs `settings/{key}` — 3 unbound calls | Retry with trailing segments treated as parameters |
| 5 | `entity_version` rejected by the test-case schema | 489 validation errors | Declared in the schema |
| 6 | **Root `package.json` `"type": "module"` broke `build-knowledge-html.js`** | The Phase 0 HTML generator stopped running — a regression *I* introduced in Phase 1 | Converted CommonJS → ESM |

Effect of the first four: unlinked tests **28 → 2**, edges **1,239 → 1,594**, bound API calls
**40/44 → 59/59**.

Defect 6 is worth singling out: adding a root `package.json` in Phase 1 retroactively changed how
every root-level `.js` file is interpreted. It was invisible until something re-ran the older script.

## 16. Idempotency

```
node scripts/documentation/harvest-tests.mjs   # first run
node scripts/documentation/harvest-tests.mjs   # second run
  wrote            0 of 13 files changed
node scripts/documentation/harvest-source.mjs
  wrote           0 of 18 files changed
```

Repeated runs produce **no duplicate IDs, no duplicate edges, and no file writes at all**. This
needed a fix: `generated_at` — including `provenance.generated_at` on every entity — changed on
every run, so all 31 committed files diffed after a run that discovered nothing. `writeJsonIfChanged`
now compares content with volatile timestamps stripped at every depth. A harvest that finds nothing
new leaves the working tree untouched, which is what makes the committed data reviewable.

Human enrichment is preserved: `title`, `steps`, `expected_result`, `priority`, asserted links and
`last_result` all survive a re-harvest; only `machine` is rewritten.

## 17. Known gaps

1. **Indirect impact traversal is shallow** — see §18. The production dependency graph records
   structural wiring (DI, base types, EF configuration, imports) but **not intra-method type usage**,
   so reverse traversal from a domain entity finds few dependents.
2. **31.1% component test coverage** (199/640) is what the evidence supports, not a quality
   judgement. Much of the remainder is DTOs, contracts and frontend components — `web/**` has no
   test framework at all, so 60 WEB components can have no test edges by construction.
3. **`class-name-convention` is the largest edge source (405)**, and 155 of those are uncorroborated
   INFERRED. They are honest but weaker than the rest.
4. **Integration test results are NOT_RUN** for the reason in §12.
5. **`knowledge_ref` quality varies.** Some links are technically correct but unhelpful —
   `ChoosePasswordForm → #158-route-inventory` is where the name appears, not where it is explained.
6. **Test *classes* are no longer components.** `tests/` was removed from the component harvest
   (645 components, down from 769), because representing test code as both "how the product is
   implemented" and "how we verify it" made the component count mean two things. If you would rather
   test classes remained in the component registry with corrected modules, this is a one-line change
   — say so and I will restore it.
7. **`[MemberData]` is recorded but not resolved** to its source collection.

## 18. Can the system answer "if I change one line, which tests are related?"

**Directly: yes, and demonstrably.**

```
CHANGED FILE: src/Domain/Orders/Order.cs
  component          COMP-ORDER-049 Order
  DIRECT tests       68        (TC-ORDER-001, TC-BILLING-001, TC-BILLING-003, …)
```

The 68 include cross-module tests — Billing tests that build an `Order` are found, which a
folder-based approach would miss.

**Indirectly: partially, and here is exactly what is missing.**

| Component | Dependents @0 hops | @≤2 hops | Tests @0 | Tests @≤2 |
|---|---|---|---|---|
| `Order` | 1 | 2 | 68 | 68 |
| `IOrderRepository` | 1 | 11 | 40 | 40 |
| `OrderStatus` | 1 | 5 | 1 | **13** |
| `Invoice` | 1 | 2 | 20 | 20 |

Multi-hop traversal works — `OrderStatus` goes from 1 directly-linked test to 13 at two hops. But it
adds little for `Order` itself, and the reason is specific:

> **The production dependency graph does not capture intra-method type usage.** A handler that calls
> `Order.Create(...)` inside `Handle()` records no edge to `Order`, because Phase 2 only extracts
> constructor injection, base types, EF configuration and imports. The reverse map therefore covers
> 171 components as targets, and a domain entity appears as the target of very few edges.

Ironically the **test** harvester already solves this — `static-call` and `instantiation` scanning is
exactly what produced 649 of the 1,594 test edges. Applying the same body scan to production
components is a contained change and is the right first task of Phase 6 (Knowledge Graph).

**Also still missing for a complete answer:** requirement and feature layers (Phase 4), so a change
cannot yet name the business rule or FRS clause it touches; test plans (Phase 11); historical
issues (Phase 8); and risk (Phase 9).

## 19. Exact commands used

```bash
npm run docs:harvest:source          # 645 components (tests now excluded)
npm run docs:harvest:tests           # 489 test cases, 1,594 edges
npm run docs:harvest                 # both, in order
npm run docs:validate                # 34 files, 1,134 entities, 0 ERROR 0 WARN
node scripts/documentation/refresh-branches.mjs
node scripts/documentation/link-knowledge.mjs
node scripts/build-knowledge-html.js

dotnet test tests/UnitTests/MathilensERP.UnitTests.csproj --configuration Release \
  --logger "trx;LogFileName=unit-20260906-phase3.trx" \
  --results-directory "$env:TEMP\mathilens-testruns"

node scripts/documentation/record-test-run.mjs \
  "$TEMP/mathilens-testruns/unit-20260906-phase3.trx" \
  --command="dotnet test tests/UnitTests/... --configuration Release --logger trx"
```

Phase 1/2 data was re-harvested and re-validated after Phase 3: **645 components, 1,760 edges,
27 migrations, 93 routes — 0 errors.** Phase 3 did not break it.

## 20. Recommended Phase 4 work

**Phase 4 — FRS + Feature harvest**, in this order:

1. **Seed `FR-*` from the 184 harvested spec citations.** Each already carries its document, section
   and line, so requirements can be created from real citations rather than invented. They start
   `status: draft`, `approved: false`.
2. **Seed `FEATURE-*`** from the 93 routes with their permission policies, the 54 frontend route
   components, `Permissions.ActionsByModule`, and the three named order kinds.
3. **Wire the existing links**: a test already knows its components, and a component already knows
   its spec citations — so `TestCase → Component → Requirement` can be closed without new guessing.

**One decision needed before I start** (it changes the shape of the FRS layer):

> `00_MASTER_SPEC.md` is 643 lines of §-numbered prose. Do you want **one `FR-*` per cited section**
> (~40 requirements, every one backed by a citation that already exists in the code), or a **fuller
> pass over every normative clause** (~120 requirements, most with no code citation and therefore
> `NEEDS_REVIEW`)?

I would also fold the **intra-method type-usage scan** into Phase 6 as its first task, since §18
shows it is the single change that most improves indirect impact analysis.

---

**Phase 3 is complete and validated. Stopping here for your review before Phase 4.**
