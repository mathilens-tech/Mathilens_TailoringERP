# Continue here

Briefing for picking this up in a fresh chat. Written 13 August 2026 at the end of an unattended
session working through a ten-point change list.

---

## State right now

- **Branch:** `dev`. Orders export committed as `7c44ac4` (`feat: export filtered orders`).
- **8 commits ahead of `origin/main`. Nothing pushed.**
- **Production is untouched** and still running the previous release (`e6b48c8`). Verified live:
  API returns 400 on a validation error, site returns 200.
- **502 unit tests pass.** Frontend lint passes; use `NODE_OPTIONS=--max-old-space-size=3072 npm run build` on this 7.7 GB machine.
- Pushing to `main` auto-deploys both API and web via GitHub Actions. There is no staging.

```
6b8909d  Handover notes for the unattended session
e885f22  Export for the four figure reports
901c80e  Export asks for a format, and can produce PDF
f8cede6  Add Customer and Employee from a modal, without losing the list
d0b0421  One signed-in place per account, cut off at once
b3359f9  Password changes: self-service, and Owner reset by one-time code
61db00b  Reports become six screens, with Birthday and Wedding follow-ups
65e2174  Menu and label tidy-ups
```

---

## Blocking: do these before deploying

### 1. Apply the migration

`src/Infrastructure/Persistence/Migrations/20260813172014_AddOccasionContacts.cs` — **not applied to
any database.** Creates one table (`OccasionContacts`) plus three indexes. Additive only; no changes
to existing tables.

```bash
dotnet ef database update --project src/Infrastructure --startup-project src/Api
```

The API also migrates on startup outside Development, so deploying applies it. Without it, the
Birthday and Wedding reports error; nothing else is affected.

**Note:** local runs point at the *live Azure database* via `dotnet user-secrets` in `src/Api`.
There is no separate dev database. Treat every local run as touching production data.

### 2. Decide on the #2 deviation (below)

---

## Decisions already made — don't re-litigate these

Four were approved explicitly during the session:

| Question | Chosen |
|---|---|
| How a user sets a password after an Owner reset | **One-time code**, shown to the Owner once, handed over in person |
| Single session cut-off | **Instant** — per-request check, not "within 15 minutes" |
| "Every action against the screen" on the rights page | **Relabel View/Manage in plain words**, not new per-action permissions |
| Which screens get modal forms | **Customer and Employee only**, keeping the existing `/new` routes |

And these were stated as assumptions and not objected to:

- "Change password for every user" = a **self-service** change-password screen (Owner-resets-anyone
  already existed).
- "Wedding Report — birthday of the customer" was a copy-paste; built as **wedding anniversary**.
- "Export every screen" = every **list** screen.

---

## The one deviation from what was asked

**Point 2.** The ask was that a user set their password *by entering their username on the login
page*. That was not built: anyone who knows a staff email address could set that account's password,
and Owner is in that list. It is account takeover, not a reset.

Built instead: Owner presses **Send reset code** on Users → an eight-character code is shown once →
handed over in person → user clicks **Have a reset code?** on the login page and chooses their own
password. Single-use, 24-hour expiry, only a hash stored, sessions revoked at *issue* rather than
redemption, and every failure returns one identical message so the endpoint cannot be used to
discover which emails have accounts.

**The user has not yet responded to this.** If they want the literal behaviour, it needs building —
but record it as a decision rather than assuming.

---

## What's left

### Export on the remaining screens

Done: Customers · Employees · Price Details · Orders · all six reports.

**Not done:** Invoices · Cloth Receipts · Stock Details · Activity Log · WhatsApp.

Each is roughly twenty lines. The pattern:

1. Add `[FromQuery] ExportFormat format = ExportFormat.Xlsx` to a new `[HttpGet("export")]` on the
   controller.
2. Fetch the list (unpaginated — see `ExportPageSize` in `OccasionsController` / `ReportsController`).
3. Return `ExportResultFactory.Create(format, title, fileNameStem, headers, rows, subtitle?)`.
4. Frontend: drop `<ExportButton resource="..." label="..." query={{ ...currentFilters }} />` into
   the page header.

**Orders implementation note:** `SearchOrdersQuery` intentionally remains capped at 100 rows for
interactive pagination. `ExportOrdersQuery` is its separate 5,000-row export path; use that shape
for any list where the normal query validator would reject an export-sized page.

Everything shared already exists in `src/Api/Common/Export/`.

### Not started at all

Nothing else from the ten points. All ten are otherwise complete.

---

## Where the new code lives

**Backend**
```
src/Domain/Customers/OccasionContact.cs          birthday/anniversary follow-up record
src/Domain/Customers/AnnualOccurrence.cs         date rollover — unit tested, 16 tests
src/Application/Occasions/                       query, command, repository port
src/Infrastructure/Persistence/Customers/OccasionRepository.cs
src/Infrastructure/Identity/PasswordResetCodes.cs    one-time code generation + hashing
src/Infrastructure/Identity/ActiveSessionService.cs  single-session store
src/Api/Common/Export/                           ExportFormat, PdfTable, ExportResultFactory
src/Api/Controllers/V1/OccasionsController.cs
```

**Frontend**
```
web/src/app/dashboard/reports/                   six screens + ReportRange + OccasionReport
web/src/app/dashboard/settings/change-password/
web/src/app/login/ResetCodeForm.tsx
web/src/app/login/SessionEndedNotice.tsx
web/src/components/ui/Modal.tsx
web/src/components/ui/ExportButton.tsx
web/src/lib/api/occasions.ts
web/src/lib/api/auth.ts
```

---

## Gotchas

- **Single session uses an in-process cache.** Correct on one Azure App Service instance, which is
  how this deploys. If it ever scales out, it needs a shared cache — not a longer expiry. Documented
  on `ActiveSessionService`.
- **`useSearchParams` opts its caller out of static rendering.** This app uses `output: "export"`.
  Keep it in a small child component inside `<Suspense>`, as `SessionEndedNotice` does.
- **Integration tests need a real Postgres** at `localhost:5432` with a `mathilens_test` database.
  They used to silently run against the Azure production database; that was fixed earlier today in
  `CustomWebApplicationFactory`. CI provisions Postgres as a service container.
- **This machine has 7.7 GB RAM.** The frontend build ran out of JS heap once; it passes with
  `NODE_OPTIONS=--max-old-space-size=3072`. The .NET test host has also been OOM-killed mid-run.
  Neither is a code problem.
- **Don't leave headless Chrome running.** Screenshot runs earlier left 25 orphaned processes and
  contributed to a memory exhaustion that killed the local API.
- **PDF uses PDFsharp/MigraDoc** (MIT), chosen over QuestPDF to avoid a revenue-threshold licence.

---

## Related docs

- `docs/handover-2026-08-13.md` — the same session written up as "what changed and why".
- `docs/resetpwd.md` — runbook for the emergency Owner password reset tool (`tools/ResetPassword`).
