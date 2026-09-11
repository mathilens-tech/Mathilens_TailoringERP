# 03 — Roadmap

> Living document — updated as each module completes. Phase contract defined in [00_MASTER_SPEC.md § 2.4](./00_MASTER_SPEC.md#24-phase-roadmap).

## Purpose

Tracks the phased delivery plan for Mathilens Tailoring ERP, from repository setup through to a commercially sellable product.

## Phase 0 — Repository Preparation

- [x] Establish repository folder structure
- [x] Define master specification
- [x] Define architecture
- [x] Define database design

## Phase 1 — Platform Foundation (MVP Core)

- [x] Solution scaffolding (Clean Architecture: Domain, Application, Infrastructure, Api, Shared, UnitTests, IntegrationTests)
- [x] Shared kernel (Result type, guard clauses, common constants)
- [x] Domain base entity (audit columns, soft delete, concurrency token)
- [x] Database foundation (PostgreSQL + EF Core Code First, ASP.NET Core Identity, initial migration) — all 8 migrations (`InitialCreate` through `AddSettings`) verified against a live Azure Database for PostgreSQL instance; connection string kept out of source control via `dotnet user-secrets`
- [x] Authentication module (login, JWT issuance/refresh) — role *assignment* (baseline role seeding, admin role-management) deferred to Phase 2 once a live database is available to verify startup seeding against; role *claims* already flow through JWTs and `[Authorize(Roles = ...)]` is usable today
- [x] Dashboard shell (Next.js frontend scaffold + authenticated shell layout) — login, JWT-backed auth guard, sign-out, dark/light theme toggle; CORS wired on the API for the frontend origin
- [x] CI/CD skeleton (GitHub Actions: build + test on every push/PR) — `.github/workflows/ci.yml`: .NET solution build/test + frontend lint/build, run in parallel

## Phase 2 — Core Operational Modules (MVP)

- [ ] Customer Management — backend complete (Domain, Infrastructure/EF migration, Application CQRS, `CustomersController` REST endpoints, 35 tests). Frontend built: list page with debounced server-side search + pagination + delete confirmation (`/dashboard/customers`), create (`/new`) and edit (`/[id]`) forms sharing a `CustomerForm` component, following 00_MASTER_SPEC.md § 9 UI Standards (loading/empty/error states, field-level validation preserving input on failure, non-blocking toasts, blocking delete confirmation). Not yet done per § 15 Definition of Done: no live PostgreSQL instance exists yet to verify the create/search/update/delete paths end-to-end (same blocker noted under Phase 1 Database foundation) — the frontend has only been exercised against an unreachable API, verifying its loading/error states, not a real round trip
- [ ] Measurement Management — backend complete (`Measurement`/`MeasurementHistory` domain entities, EF migration, Application CQRS, `MeasurementsController` REST endpoints, 34 tests); measurement points are a flexible name/value set rather than fixed per-garment-type columns, since 02_DATABASE.md § 10.4 explicitly defers garment-type templates to a future phase — see CHANGELOG.md for the full design rationale. Frontend built: embedded in the customer detail page (never a standalone top-level list — measurements are always accessed through their owning customer) via a `MeasurementsSection` with a free-form point editor and inline add/edit, plus a standalone paginated history page. The history page was verified in-browser; `MeasurementsSection` itself only renders after a successful customer load, which needs the live backend this environment doesn't have — verified by a clean typecheck/build only, not in-browser. No live-database verification yet
- [ ] Employee Management — backend complete (`Employee` domain entity, EF migration with a real FK + filtered-unique-index to `Users`, Application CQRS, `EmployeesController` REST endpoints, 22 tests); schema includes the optional `UserId` link to a system login (02_DATABASE.md § 10.6) but no command sets it yet — linking an employee to a login account is an admin/role-management flow, already deferred in Phase 1's Authentication entry for the same live-database reason. Frontend built (list/search/pagination/delete + create/edit forms, mirroring Customer Management exactly) and verified in-browser. No live-database verification
- [ ] Tailoring Orders — backend complete: `Order` aggregate root (`OrderItem`s, each with an optional one-to-one `FabricDetails`), a strict enforced status lifecycle (`Received → InProgress → ReadyForDelivery → Delivered`, cancellable from any non-terminal state — 02_DATABASE.md § 10.7), EF migration with real FKs to Customers/Employees, Application CQRS (create with items, add item, set item fabric, transition status, assign employee, get/search), `OrdersController` REST endpoints, 41 tests. Frontend built: list with status filter/pagination; create form with customer/employee `SearchPicker`s and a dynamic garment-item editor (optional fabric per item); detail page with status-transition buttons (computed from the same state machine client-side), employee (re)assignment, add-item, and per-item fabric entry — all inline, no separate routes. Verified in-browser. No live-database verification
- [ ] Fabric Details — built together with Tailoring Orders as one aggregate (`FabricDetails` is owned by `OrderItem`, per 02_DATABASE.md § 10.11's one-to-one option), not a separate module/table set

## Phase 3 — Commercial Modules (MVP)

- [ ] Billing — backend complete: `Invoice` aggregate root (owns `Payment`s), a strict enforced billing status (`Unpaid → PartiallyPaid → Paid`, or `Void` — recomputed automatically as payments are recorded, per 02_DATABASE.md §§ 10.9-10.10), EF migration with real FKs to Orders/Customers, Application CQRS (create invoice from an order's items, record payment, void, get/search), `InvoicesController` REST endpoints, 40 tests. Invoicing is an explicit staff action, not automatic on order delivery — there's no domain-event dispatch mechanism wired up yet (01_ARCHITECTURE.md § 26 is future work). Frontend built: "Create Invoice" action added to the order detail page (matching the backend's design — invoicing is order-initiated), a standalone invoices list with status filter, and a detail page with a record-payment form and a void action (client-side gated the same way the backend gates it: only when `amountPaid === 0`). Verified in-browser. No live-database verification
- [ ] WhatsApp — backend complete: `WhatsAppMessage` log entity (00_MASTER_SPEC.md § 3: order updates, reminders, delivery notices), EF migration with real FKs to Customers/Orders, Application CQRS (send, get/search), `WhatsAppMessagesController` REST endpoints, 24 tests. Sends via a `MetaWhatsAppSender` targeting Meta's WhatsApp Cloud API directly (the user's explicit provider choice) behind an `IWhatsAppSender` port — **unverified against a live account**: no real Meta credentials have been available, so this client has never actually sent a message, only been written to match Meta's documented API contract. The integration is optional-at-startup (the API still starts fine unconfigured) and fails gracefully per-send if credentials are missing. Frontend built: message log list with status filter, a send-message form (customer picker + message type + content — no order association in the UI yet, since Orders has no free-text search endpoint to drive a picker), and a detail page showing delivery status/failure reason. Verified in-browser. No live-database verification
- [ ] Reports — backend complete: no new Domain entity or migration (reports are pure read-side projections over Orders/Invoices, per 01_ARCHITECTURE.md § 20 Reporting Strategy — "project directly from persistence... bypassing full entity materialization"). Three reports: revenue (invoiced/collected/outstanding totals for a date range), order-status-summary (counts per `OrderStatus` for a date range, every status present even at zero), and outstanding-invoices (paginated, oldest-first). `ReportsController` REST endpoints, 22 tests. **This completes Phase 3's backend** (Billing, WhatsApp, Settings, Reports). Frontend built: single `/dashboard/reports` page — a shared From/To date range drives the Revenue summary tiles and the Order Status Summary table, plus a separately paginated Outstanding Invoices table (no date range, oldest-first per the backend default). Deliberately kept to numeric tiles and plain tables, no charts, given this session's already large scope. Verified in-browser (nav link, both graceful error states, date inputs). **This completes all 8 module frontends across Phase 2 and Phase 3.** No live-database verification
- [ ] Settings — backend complete: `Setting` key-value entity (02_DATABASE.md § 10.12, explicitly exempt from soft delete — `IAuditable` directly, not `AuditableEntity`), EF migration with a unique index on `Key`, Application CQRS (upsert, delete, get-by-key, paginated list), `SettingsController` REST endpoints (`PUT/GET/DELETE /api/v1/settings/{key}`), 16 tests. Frontend built: single page, paginated table with inline add/edit (one form, since upsert handles both — key is only editable when creating) and delete confirmation. Verified in-browser. No live-database verification

## Phase 4 — Hardening & Launch Readiness

- [ ] Security review
- [ ] Performance pass
- [ ] Full test coverage
- [ ] Production readiness validation
- [ ] Production deployment

## Phase 5 — Expansion (Future Modules)

- [ ] Inventory
- [ ] Website
- [ ] E-Commerce
- [ ] Customer Portal
- [ ] AI Features

## Related Documents

- [00_MASTER_SPEC.md](./00_MASTER_SPEC.md)
- [01_ARCHITECTURE.md](./01_ARCHITECTURE.md)
- [02_DATABASE.md](./02_DATABASE.md)
- [04_FEATURES.md](./04_FEATURES.md)
