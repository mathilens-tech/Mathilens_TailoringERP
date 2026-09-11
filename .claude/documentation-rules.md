# Documentation rules

How documentation is maintained in this repository, and what Claude Code must do when source code
changes. These rules are binding for every development task.

---

## 1. The four connected layers

```
FRS (what the product SHOULD do)
  ↓ specified_by
Product Feature (what the product DOES)
  ↓ implemented_by
Source Code (HOW it is implemented)
  ↓ verified_by
Test Case (how we KNOW it works)
```

Each layer is structured JSON under `docs/data/`, and each entity carries a stable ID:

| Entity | ID | Directory | Status |
|---|---|---|---|
| Requirement | `FR-<MODULE>-<NNN>` | `docs/data/requirements/` | Phase 4 |
| Feature | `FEATURE-<MODULE>-<NNN>` | `docs/data/features/` | Phase 4 |
| Component | `COMP-<MODULE>-<NNN>` | `docs/data/source/<module>.json` | **live** |
| Test case | `TC-<MODULE>-<NNN>` | `docs/data/testcases/` | Phase 3 |
| Test plan | `TP-<MODULE>-<NNN>` | `docs/data/testplans/` | later |
| Issue | `BUG-<MODULE>-<NNN>` | `docs/data/issues/` | later |
| Change | `CHANGE-<YYYY>-<NNNN>` | `docs/data/changes/` | later |
| Risk | `RISK-<MODULE>-<NNN>` | `docs/data/risks/` | later |

IDs are assigned once, in `docs/data/component-id-ledger.json`, against a natural key
(`path#Symbol`). **A retired ID is never reused** — an old report referring to it must not silently
start describing something else. Never renumber by hand.

---

## 2. Source of truth

- **`docs/data/**` is committed and authoritative.** It is both harvested and hand-enriched.
- **`docs/generated/**`, `docs/registry/**`, `docs/traceability/**` are git-ignored build output.**
  They are reproducible from `docs/data/**` plus repository state. Never hand-edit them, never
  commit them, and never treat them as a source.
- Within a component entry, the `machine` block belongs to the harvester and is **rewritten on
  every run**. Everything else — `purpose`, `simple_explanation`, `technical_explanation`,
  `knowledge_ref`, and the `features`/`requirements`/`test_cases` links — is human-authored and is
  preserved. Put judgement outside `machine`; anything written inside it is lost silently.

Commands:

```bash
npm run docs:harvest:source     # re-read the code into the component registry (merges, never clobbers)
npm run docs:validate           # schema + references + evidence + secrets, WARN mode
npm run docs:validate:strict    # same, exits non-zero on any ERROR
node scripts/documentation/refresh-branches.mjs   # recompute derived branch data from git
```

---

## 3. Evidence and confidence

Every claim carries a confidence and the evidence behind it.

| Confidence | Means | Requires |
|---|---|---|
| `CONFIRMED` | Directly verified against a file, symbol, command output or git object | **At least one evidence item — enforced in code** |
| `INFERRED` | Reasoned from evidence that does not state it outright | Evidence expected |
| `PREDICTED` | A forward-looking judgement about something that has not happened | `why`, `what_to_test`, `failure_signal` |
| `NEEDS_REVIEW` | A human has to decide | — |

**Never present a prediction as a fact. Never record an absence of evidence as CONFIRMED.**

---

## 4. Committed vs uncommitted

Every entity records the git state of the file behind it: `COMMITTED`, `MODIFIED` or `UNCOMMITTED`.

An untracked or modified file describes **one machine's working tree**. It is not branch truth, it
must not be presented as history, and a component sourced from one is `NEEDS_REVIEW`, never
`CONFIRMED`. Validation enforces this.

This matters here because the working tree frequently holds unrelated work in progress. **Do not
commit, stash, reset or revert anything you were not asked to change.**

---

## 5. Branch awareness

Documentation lives at the same paths in every branch; **git provides the branch-specific version**.
There are no `docs/main/`, `docs/dev/` directories and there must never be.

Branch availability of a feature is **computed, never stored** — by reading other refs with
`git cat-file` / `git ls-tree` / `git grep`, never by checking anything out. A feature file may
claim what its implementation looks like (`implementation.paths`, `implementation.evidence`); it may
not claim which branches have it.

Branch classification is **declared** in `docs/data/branches.json` and never guessed from a name —
in this repository `Ver1.0.1` is a merged work branch, not a release. Activity (`ACTIVE`,
`INACTIVE`, `HISTORICAL`) is derived from divergence and refreshed by script.

---

## 6. What to do when source code changes

Documentation maintenance is part of the task, not a follow-up.

```
1.  Understand the request
2.  Read the FRS entry, feature and existing tests for the area BEFORE editing
3.  Make the source change
4.  Run the relevant tests — and report what actually ran
5.  Re-harvest:            npm run docs:harvest:source
6.  Assess impact:         which components, features, requirements, tests are affected?
7.  Update feature and component documentation where behaviour changed
8.  Review affected test cases; add cases for new rules and boundaries
9.  Check requirement consistency — report any mismatch, never resolve it silently
10. Validate:              npm run docs:validate
11. Report what changed, what did not, and why
```

**Do not regenerate unrelated documentation.** A change to one module should not produce a diff
across all of them.

### When documentation genuinely does not need to change

That is a legitimate outcome — a rename with no behavioural change, a comment, a formatting fix.
Say so explicitly, with the reason:

> Documentation impact: none. `OrderItemsEditor` was reformatted; no exported symbol, route, rule
> or asserted value changed, so no component, feature or test entity is affected.

An unexplained absence is not acceptable; a justified one is.

---

## 7. Requirement mismatch

If the code contradicts an approved requirement, **report it. Do not edit the requirement.**

```
REQUIREMENT MISMATCH
Requirement:      FR-ORDER-015
FRS says:         cancellation window = 24 hours
Implementation:   src/Domain/Orders/Order.cs — 2 hours
Affected feature: FEATURE-ORDER-002
Action:           Business/Product Owner review required
```

Approved requirements are protected by a content hash over their normative fields. Editing them
without re-approval **fails validation** — deliberately, and that applies to Claude Code as much as
to anyone.

Distinguish: *approved requirement change* · *implementation drift* · *documentation drift* ·
*unknown*.

---

## 8. Test rules

- A test case is `AUTOMATED` only when `automation_ref` names a test method that exists.
- A proposed test is `PLANNED` and `needs-review` until it is written.
- **A test result is never inferred.** `last_result` is set only from a real run, and carries the
  run id. No run means `null`, which reads as "not run" — not as "passing".
- Do not generate bulk duplicate cases. Review what exists first.

---

## 9. Security

The repository is **public** and `docs/data/**` is committed, so anything written there is
published — permanently, because history cannot be un-pushed.

- Never copy a password, signing key, token, connection string, API key, publish profile or
  certificate into documentation.
- Reference configuration by **key name**: "reads `Jwt:SigningKey` from app settings" is
  documentation; the value is a credential.
- `scripts/documentation/lib/redact.mjs` scrubs every string on the way out and reports findings.
  It is a backstop, not permission to be careless.

---

## 10. Absolute rules

Never:

- invent a requirement, business rule, API, dependency, defect or branch status
- claim a feature exists in a branch without git evidence
- mark a test as passing unless it ran and passed
- silently modify an approved FRS entry
- delete documentation without checking what references it
- commit generated artefacts
- modify unrelated working-tree changes
- break CI or the existing Azure deployments

When uncertain, write `NEEDS_REVIEW` and say what you could not determine.
