# Phase 4 — FRS + Product Features + Business Rules

**Branch:** `dev` @ `fec30963` · **Date:** 2026-09-06 · **Status:** complete and validated

Every number below came from running the tooling. Nothing is estimated.

---

## Executive summary

Five things were built, in this order:

1. **Method-level production dependency analysis** — the blind spot Phase 3 exposed. Production edges
   grew **1,760 → 2,194**, and `Order`'s dependents grew **2 → 9**, because a handler that calls
   `Order.Create(...)` inside `Handle()` now records that.
2. **121 FR-\* requirements**, each a normative clause quoted verbatim from the specification with
   its document, section, parent section and line range.
3. **43 FEAT-\* product features**, derived from this codebase's own use-case decomposition and
   attached to 62 API routes.
4. **239 BR-\* business rules**, read out of the five places rules are actually enforced.
5. **Full traceability in both directions**, with SPECIFIED / IMPLEMENTED / TESTED kept apart.

The platform now holds **1,537 entities** and validates clean.

## Starting state → ending state

| | Start of Phase 4 | End of Phase 4 |
|---|---|---|
| Production components | 645 | 645 |
| Test cases | 489 | 489 |
| Component → TestCase edges | 1,594 | 1,594 |
| Production dependency edges | 1,760 | **2,194** |
| Requirements | 0 | **121** |
| Features | 0 | **43** |
| Business rules | 0 | **239** |
| Total entities | 1,134 | **1,537** |

## Production dependency enhancement

| `via` | Before | After | Source |
|---|---|---|---|
| constructor-injection | 830 | 830 | Phase 2 (structural) |
| import | 548 | 548 | Phase 2 |
| base-type | 279 | 279 | Phase 2 |
| http-call | 85 | 85 | Phase 2 |
| ef-configuration | 18 | 18 | Phase 2 |
| **static-call** | — | **204** | **Phase 4 (method body)** |
| **instantiation** | — | **175** | **Phase 4** |
| **method-call** | — | **35** | **Phase 4** |
| **declared-type** | — | **20** | **Phase 4** |
| **Total** | **1,760** | **2,194** | |
| Reverse-map targets | 171 | **314** | |

Four resolvable forms. Three name the type outright and are `CONFIRMED`; `method-call` resolves a
local's type and is `INFERRED`. Every method-body edge carries the file, line and expression:

```jsonc
{ "target": "Order", "target_component": "COMP-ORDER-049", "via": "static-call",
  "confidence": "CONFIRMED",
  "evidence": { "file": "src/Application/Orders/Commands/Create/CreateOrderCommandHandler.cs",
                "line": 58, "expression": "Order.Create(…)" } }
```

**The two-pass resolution is what made this work.** The first attempt raised `Order`'s dependents
only 2 → 2, because handlers do not name the type:

```csharp
var order = await _orderRepository.GetByIdAsync(id, ct);   // type not stated
order.TransitionTo(...);                                    // ...but discoverable
```

So a second pass resolves `_orderRepository` from its constructor parameter to `IOrderRepository`,
looks up `GetByIdAsync` in that port's parsed members, unwraps `Task<Order?>` to `Order`, and binds
the edge. Both halves are signatures already in the registry — evidence, not familiarity. That took
`Order` from 2 dependents to 9, every one a real handler.

Framework noise is excluded by a 60-name denylist (`Task`, `Guid`, `ILogger<T>`, `CancellationToken`
…) plus the existing rule that a target must resolve to a known component. Migrations keep their
Phase 2 treatment — schema operations only, designer files untouched.

**Regression check:** 645 components unchanged, 0 duplicate IDs, human metadata preserved, 1,594
test edges unchanged, validation clean.

## FRS — 121 requirements

| | |
|---|---|
| Statements examined | 614 (216 sentences, 227 table rows, 171 bullets) |
| Normative clauses selected | 121 |
| Rejected | 22 non-normative sections, 10 meta statements |
| `needs-review` | 3 |

**By document:** `00_MASTER_SPEC.md` 43 · `01_ARCHITECTURE.md` 33 · `02_DATABASE.md` 45

**By module:** PLATFORM 95 · AUTH 6 · BILLING 5 · USER 3 · ORDER 3 · REPORT 2 · MEASUREMENT 2 ·
ACTIVITY 2 · CUSTOMER 1 · EMPLOYEE 1 · SETTING 1

**By type:** functional 36 · data 23 · validation 14 · architecture 9 · security 6 · configuration 6 ·
workflow 5 · reporting 5 · audit 5 · authorization 4 · performance 3 · notification 3 · integration 2

Selection is by **modality** — `must`, `never`, `shall`, `cannot`, `is required`. These documents are
prescriptive by their own declaration, so reading them for demands is reading them as written.
Every requirement preserves the specification's hierarchy (`§ 10.7 Orders` under `§ 10 Required
Entities`), quotes the clause verbatim as its `description`, and starts `status: draft`,
`approval.approved: false`. The approval lock then binds everyone, including this tooling.

**PLATFORM's 95 is honest, not a bug.** These three documents are overwhelmingly cross-cutting
engineering standards; the module-specific requirements come from `02_DATABASE`'s per-entity
sections.

## Features — 43

**By module:** ORDER 6 · AUTH 5 · BILLING 4 · EMPLOYEE 4 · REPORT 4 · CUSTOMER 3 · INVENTORY 3 ·
MEASUREMENT 3 · WHATSAPP 3 · ACTIVITY 2 · OCCASION 2 · PRICING 2 · SETTING 2

**Implementation status:** `IMPLEMENTED` 33 · `UNDOCUMENTED_CODE` 10 · `DOCUMENTED_ONLY` 0 · `ABSENT` 0

A feature is a **capability**, derived by grouping `src/Application/<Module>/Commands|Queries/<UseCase>/`
— this codebase's own decomposition of what the product does — then attaching the API routes
(62 of 93 bound), frontend routes, permissions, components, rules and tests that serve it.

`DOCUMENTED_ONLY` is 0 because features are currently derived from code; a specification-only feature
catalogue would be needed to populate it, and inventing one was not an option.

## Business rules — 239

**By detector:** fluent-validation 149 · guard-clause 59 · domain-invariant 19 · constant 6 ·
state-table 6

**By category:** validation 206 · NEEDS_REVIEW 14 · state-transition 7 · policy 6 · calculation 5 ·
workflow 1

**By module:** ORDER 62 · EMPLOYEE 22 · MEASUREMENT 22 · PLATFORM 19 · CUSTOMER 19 · BILLING 18 ·
INVENTORY 17 · PRICING 17 · WHATSAPP 10 · USER 9 · SETTING 8 · ACTIVITY 6 · AUTH 5 · REPORT 5

**Origin: `IMPLEMENTED` 239, `SPECIFIED` 0, `BOTH` 0.**

Every rule was read out of code and carries `confidence: INFERRED` — the behaviour is certain, the
intent is a human judgement. The statement is the enforcement's own words where it has them:

> `BR-ORDER-048` — *"Cannot remove the last item from an order — cancel the order instead."*
> enforced at `src/Domain/Orders/Order.cs:234`, mechanism `domain-invariant`

**Not one of the 239 matched an FRS clause** under a strict 60%-word-overlap test. That is a finding,
not a failure of the matcher: the specification describes architecture and data design, while the
rules the product enforces live almost entirely in validators and invariants that nothing wrote down.

## Traceability

| Edge | Count |
|---|---|
| Requirement → Component (via developer-written spec citations) | 147 |
| Requirement → Feature | 95 |
| Feature → Component | 271 |
| Feature → Rule | 178 |
| Rule → Component | 239 |
| Component → Test | 1,594 |

Reverse traversal is supported for all of them. **The Requirement → Component edge is earned:** it
comes from the 184 `00_MASTER_SPEC.md § 8.3`-style citations this team already maintains by hand in
its source comments, not from a keyword match invented here.

## Coverage — specified, implemented, tested kept apart

| | Specified | Implemented | Tested |
|---|---|---|---|
| **Requirements** (121) | 121 | **40** | **28** |
| **Features** (43) | 33 | 43 | 30 |
| **Business rules** (239) | **0** | 239 | 153 |
| **Components** (645) | 84 have FRS | — | 199 have tests |

Three findings this separation surfaces that a single flag would hide:

1. **81 of 121 requirements have no implementation evidence.** Mostly architectural clauses no
   source comment cites.
2. **10 of 43 features are `UNDOCUMENTED_CODE`** — built, with nothing in the FRS asking for them:
   all of Inventory, Pricing, WhatsApp and Occasions.
3. **239 of 239 business rules are enforced with nothing specifying them.**

## Orders proof — end to end

```
$ node scripts/documentation/query.mjs component src/Domain/Orders/Order.cs

COMP-ORDER-049  Order   [entity, Domain, ORDER]
  src/Domain/Orders/Order.cs   → knowledge.html#72-orders-the-core-aggregate

  REQUIREMENTS implemented by it (6) — via developer-written spec citations
    FR-ORDER-001     § 10.7  Validation Rules — Must reference a valid, non-deleted Customer…
    FR-PLATFORM-050  § 11    Input validation runs as a pipeline behavior…
    FR-PLATFORM-081  § 5     Entities representing business records are soft-deleted…

  PRODUCT FEATURES depending on it (4)
    FEAT-ORDER-003  Order Management          [IMPLEMENTED]
    FEAT-ORDER-004  Order Items               [IMPLEMENTED]
    FEAT-ORDER-005  Order Status Lifecycle    [IMPLEMENTED]
    FEAT-ORDER-006  Order Work Assignment     [IMPLEMENTED]

  BUSINESS RULES implemented by it (14)
    BR-ORDER-048  [workflow]          Cannot remove the last item from an order — cancel instead.
    BR-ORDER-049  [state-transition]  Cannot transition an order from '…' to '…'.
    BR-ORDER-050  [NEEDS_REVIEW]      Cannot start work on an order with no employee assigned.

  TESTS exercising it (104)
    TC-ORDER-001    [static-call, CONFIRMED]  …adds item                 passed
    TC-BILLING-001  [static-call, CONFIRMED]  …creates invoice from order  passed
```

```
$ node scripts/documentation/query.mjs impact src/Domain/Orders/Order.cs

  DIRECT dependents (9)
    COMP-ORDER-010  CreateOrderCommandHandler           [static-call] — CreateOrderCommandHandler.cs:58
    COMP-ORDER-024  TransitionOrderStatusCommandHandler [method-call] — TransitionOrderStatusCommandHandler.cs:36
    COMP-ORDER-002  AddOrderItemCommandHandler          [method-call] — AddOrderItemCommandHandler.cs:30
    …
    COMP-PLATFORM-126  OrderConfiguration               [ef-configuration]

  TESTS   direct 68   including indirect 74
  FEATURES affected        4
  BUSINESS RULES affected  14
  REQUIREMENTS affected    7
```

Full chain, every hop evidence-backed: **FR-ORDER-001 → FEAT-ORDER-005 → BR-ORDER-049 →
COMP-ORDER-049 → method-level dependency at line 36 → TC-ORDER-\* (passed).**

## Validation

```
$ npm run docs:validate
Validation (warn mode) — 215 files, 1537 entities, 1.50s
  components 645  requirements 121  features 43  rules 239  test cases 489  migrations 27
  ERROR 0   WARN 0   INFO 0
```

Checks now cover schema, referential integrity (including rule → component and rule → file
existence), evidence liveness, approval-hash integrity, secret exposure, ID uniqueness and ledger
completeness across four ID families.

## Idempotency

```
$ npm run docs:harvest   # three consecutive runs
  wrote  0 of 18 files changed        (source)
  wrote  0 of 13 files changed        (tests)
  wrote  0 of 121 files changed       (requirements)
  wrote  0 of 43 files changed        (features)
  wrote  0 of 14 files changed        (rules)
  wrote  0 data files updated         (traceability)
```

Two defects had to be fixed to get there — see below. Human enrichment survives: adding `purpose`,
`title`, `statement` or an asserted link and re-harvesting leaves them untouched.

## Git safety

**Start and end of Phase 4 are identical:**

```
 M .gitignore                                    (Phase 1, append-only)
 M web/src/app/dashboard/customers/CustomerForm.tsx
 M web/src/app/dashboard/{customers,employees,inventory,orders,stock}/page.tsx
 M web/src/app/dashboard/layout.tsx
 M web/src/app/globals.css
 M web/src/components/ui/{Input,Modal}.tsx
 M web/staticwebapp.config.json
RM web/src/app/dashboard/orders/new/page.tsx -> NewOrderForm.tsx
--- 13 files changed, 515 insertions(+), 171 deletions(-)   (unchanged)
```

Nothing committed, stashed, reset or reverted. No file under `src/`, `web/` or `tests/` was modified.

## Defects found and fixed

| # | Defect | Effect | Fix |
|---|---|---|---|
| 1 | Method-body edges missed locals loaded from repositories | `Order` had 2 dependents instead of 9 | Two-pass resolution through parsed port signatures |
| 2 | "Core Values" table rows became requirements | A product *value* ("must be right before it is fast") harvested as a requirement | Section-level exclusion of vision/values/risks sections |
| 3 | Module assigned from a stray word in the clause | A Core Values row landed in ORDER because it contained "orders" | Module from the section title only |
| 4 | Modality pattern missed "X **is required**" | **Zero** CUSTOMER/MEASUREMENT/INVENTORY requirements — `02_DATABASE` states its per-entity rules in exactly that form | Pattern extended |
| 5 | `\bcustomer\b` failed against "Customers" | Every per-entity database section fell to PLATFORM | Plural-tolerant module patterns |
| 6 | **Controllers classified as PLATFORM** | **0 of 93 API routes** could be attached to a feature | Api-layer module rule from the controller/contract file name |
| 7 | Duplicate `BR-ORDER-053` | Same guard enforced twice in a file produced two entities with one ID | Merged into one rule with multiple `enforced_by` sites |
| 8 | `computed_at` rewritten every run | 164 committed files diffed on every harvest | Added to the volatile-key set |
| 9 | Harvest and traceability overwrote each other | 121 + 43 files churned on every run, forever | One writer per field; `coverage` and `implementation_evidence` moved to the preserve list |
| 10 | Features never reached domain entities | `Order` belonged to no feature at all | Features claim one-hop, same-module Domain/Infrastructure dependencies |

## Known gaps

1. **All 239 business rules are `IMPLEMENTED`-only.** No rule matched an FRS clause. The strict
   matcher is deliberate — a loose one would manufacture the traceability this platform measures.
2. **81 of 121 requirements have no implementation evidence**, because the link depends on a
   developer having cited that section in a comment. Absence of a citation is not absence of
   implementation, and the field says `NOT_FOUND`, not `NO`.
3. **PLATFORM holds 95 of 121 requirements.** True to the documents, but it means module-level FRS
   coverage is thin.
4. **`DOCUMENTED_ONLY` features are 0** — features are derived from code, so a specified-but-unbuilt
   feature cannot currently be represented.
5. **31 of 93 API routes are unattached** — `UsersController` actions (`Me`, `Roles`, `SetRole`,
   `ResetPassword` …) are served by Infrastructure services, not Application use cases, so no
   use-case group exists to attach them to.
6. **14 rules are `category: NEEDS_REVIEW`** — their statements carry no categorising vocabulary.
7. **Requirement→Feature is `INFERRED` by module**, the weakest edge in the graph.
8. **`web/**` has no test framework**, so 60 WEB components can have no test edges by construction.

## False-positive risks

- **`class-name-convention` and module-level Requirement→Feature edges are the weakest.** Both are
  labelled `INFERRED`; neither should be read as proof.
- **Modality selection admits prescriptive prose that is not a testable requirement.** Section
  exclusion removed the worst of it; some architectural "must"s remain that no code can satisfy
  directly.
- **`method-call` resolution assumes a local keeps the type its initialiser returned.** True in this
  codebase; not true in general. Hence `INFERRED`.
- **Rule statements from interpolated messages lose their values** — `"Cannot transition an order
  from '…' to '…'"`. The rule is right; the specific statuses are not in the text.
- **`knowledge_ref` quality varies** — 183 links, some technically correct but unhelpful.

## Exact commands used

```bash
npm run docs:harvest              # source → tests → requirements → features → rules → traceability
npm run docs:harvest:source
npm run docs:harvest:tests
npm run docs:harvest:requirements
npm run docs:harvest:features
npm run docs:harvest:rules
npm run docs:traceability
npm run docs:validate
node scripts/documentation/link-knowledge.mjs
node scripts/documentation/query.mjs component src/Domain/Orders/Order.cs
node scripts/documentation/query.mjs impact    src/Domain/Orders/Order.cs
node scripts/documentation/query.mjs gaps
```

**Integration tests were not run** — they boot the real host and would write to `mathilens_dev`.
The 67 integration test cases keep `last_result: null` = NOT_RUN, unchanged from Phase 3. No result
was inferred.

## Phase 5 recommendation

**Phase 5 — Knowledge Graph + deeper impact infrastructure**, which is now the natural next step
because every node type exists and every edge type has at least one evidence channel.

Four tasks, in order:

1. **Unify the graph.** Build one in-memory graph over all five entity types with typed, weighted,
   confidence-carrying edges, replacing the ad-hoc traversals in `query.mjs` and
   `build-traceability.mjs`.
2. **Weight edges by fan-in.** `Result` has 60 ambiguous references; an impact report that treats an
   edge to `Result` as equal to an edge to `Order` will drown its own signal.
3. **Close the `Result`/`Result<T>` ambiguity** — 60 of the 71 ambiguous production edges are this
   one arity collision, and resolving it by generic arity at the call site is tractable.
4. **Then Phase 6/7: the change-impact engine** over a diff, emitting the `CHANGE-*` entities the
   schema already defines.

**One decision I need:** the FRS is 95/121 PLATFORM and 0 rules matched a requirement. Do you want
me to (a) leave the FRS as the harvested clause set and accept that module-level requirements are
thin, or (b) author module-level requirements by hand from the code's own business rules — which
would raise coverage but means writing requirements from implementation, exactly the direction this
platform is built to distrust? I recommend (a), with the 239 unspecified rules standing as the
honest backlog.

---

**Phase 4 is complete and validated. Stopping here for review before Phase 5.**
