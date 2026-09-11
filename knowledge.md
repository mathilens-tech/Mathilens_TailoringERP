# knowledge.md — Mathilens Tailoring ERP

A single reference for how this codebase is built: the architecture, every layer, every class of
consequence, every endpoint, and the flows that tie them together. Written from the source as it
stands, not from the specification — where the two differ, this file describes the code.

The aspirational design documents live in [docs/](docs/) (`00_MASTER_SPEC.md`, `01_ARCHITECTURE.md`,
`02_DATABASE.md`). They are quoted extensively in code comments and are the *intent*; this file is
the *implementation*.

---

## Table of contents

1. [What the system is](#1-what-the-system-is)
2. [Technology stack](#2-technology-stack)
3. [Repository map](#3-repository-map)
4. [Architecture](#4-architecture)
5. [The life of a request](#5-the-life-of-a-request)
6. [Shared kernel](#6-shared-kernel-srcshared)
7. [Domain layer](#7-domain-layer-srcdomain)
8. [Application layer](#8-application-layer-srcapplication)
9. [Infrastructure layer](#9-infrastructure-layer-srcinfrastructure)
10. [API layer](#10-api-layer-srcapi)
11. [Authentication and authorization](#11-authentication-and-authorization)
12. [Cross-cutting mechanisms](#12-cross-cutting-mechanisms)
13. [Numbering schemes](#13-numbering-schemes)
14. [The settings store](#14-the-settings-store)
15. [Frontend](#15-frontend-web)
16. [End-to-end business flows](#16-end-to-end-business-flows)
17. [Database](#17-database)
18. [Tests](#18-tests)
19. [Build, CI, deployment, local development](#19-build-ci-deployment-local-development)
20. [Conventions and gotchas](#20-conventions-and-gotchas)

---

## 1. What the system is

An ERP for a tailoring shop (branded per deployment — currently "Radha Men's"). It records
customers and their measurements, takes orders for stitched garments and for cloth sold over the
counter, bills them, tracks payments, manages cloth stock, messages customers over WhatsApp, and
reports on all of it. It is deployed per shop: one API, one web app, one PostgreSQL database.

Two applications, separately deployable, talking REST over JSON:

- **`src/`** — an ASP.NET Core (.NET 10) API, Clean Architecture + CQRS.
- **`web/`** — a Next.js 16 / React 19 App Router frontend, statically exported to Azure Static Web Apps.

---

## 2. Technology stack

| Concern | Choice |
|---|---|
| Backend runtime | .NET 10 (`net10.0`, nullable enabled, implicit usings) — [Directory.Build.props](Directory.Build.props) |
| Web framework | ASP.NET Core, controller-based (not minimal APIs) |
| ORM | EF Core, code-first, migration-based, **Npgsql** |
| Database | PostgreSQL 18 (single provider from day one) |
| Identity | ASP.NET Core Identity (`IdentityCore` + roles + `SignInManager`), `Guid` keys |
| Tokens | Hand-issued JWT access tokens + opaque, hashed, rotating refresh tokens |
| Validation | FluentValidation 12.1.1, run as a mediator pipeline behavior |
| Mediator | **Hand-rolled**, ~50 lines — not MediatR ([Sender.cs](src/Application/Common/Mediator/Sender.cs)) |
| Export | **ClosedXML 0.105.1** (xlsx) and **PDFsharp-MigraDoc 6.2.4** (pdf), both wrapped in `Api/Common` |
| Mocking | NSubstitute 6.0.0 |
| API docs | Swashbuckle/Swagger, Development only |
| Frontend | Next.js 16.3.0, React 19.2.8, TypeScript 5, Tailwind CSS v4, `next-themes` |
| Frontend state | None. Plain `useState`/`useEffect` + a thin fetch wrapper. No React Query, no Redux |
| Tests | xUnit (`tests/UnitTests`, `tests/IntegrationTests` via `WebApplicationFactory<Program>`) |
| CI/CD | GitHub Actions → Azure App Service (API) + Azure Static Web Apps (web) |

Notable **non**-dependencies: no MediatR, no AutoMapper, no message broker, no Redis, no
client-side data-fetching library. Mapping is hand-written `ToDto()` extension methods; caching is
`IMemoryCache`.

---

## 3. Repository map

```
Mathilens_TailoringERP/
├── src/
│   ├── Api/              ASP.NET Core host: controllers, wire contracts, DI composition root
│   ├── Application/      Use cases: commands, queries, handlers, validators, ports (274 files)
│   ├── Domain/           Entities, enums, invariants (33 files) — zero framework references
│   ├── Infrastructure/   EF Core, repositories, Identity, WhatsApp client (51 files + 27 migrations)
│   └── Shared/           Result, Guard, phone/email rules, permissions catalogue, constants
├── tests/
│   ├── UnitTests/        Domain + Application handlers/validators + Shared
│   └── IntegrationTests/ Real host over a real Postgres
├── web/                  Next.js app (146 .ts/.tsx files)
├── docs/                 Specification set (00_MASTER_SPEC … 10_RELEASE_NOTES)
├── deploy/test-server/   Nginx + systemd assets for the self-hosted test box
├── docker/               Dockerfile.api, Dockerfile.web (docker-compose.yml is a stub)
├── scripts/start-local.ps1   Starts portable Postgres + API + web locally
└── .github/workflows/    ci.yml, deploy-api(.test).yml, azure-static-web-apps-*.yml
```

---

## 4. Architecture

### 4.1 Layers and the dependency rule

```
Api ──► Application ──► Domain ──► Shared
 │           │             ▲          ▲
 └──► Infrastructure ──────┘──────────┘
```

- `Domain` references only `Shared`. No EF Core, no ASP.NET Core.
- `Application` references `Domain` + `Shared`, and defines **ports** (interfaces) it needs.
- `Infrastructure` implements those ports. It references `Application`, `Domain`, `Shared`.
- `Api` references everything and is the **only** place a port is bound to an implementation.

The rule is enforced by project references — an inward layer cannot compile against an outward one.

### 4.2 Organisation: module first, technical kind second

Every layer is sliced by business module, then by kind:

```
Application/Orders/Commands/TransitionStatus/{Command, Handler, Validator}.cs
Application/Orders/Queries/Search/{Query, Handler, Validator}.cs
Application/Orders/{OrderDto.cs, IOrderRepository.cs}
```

One folder per use case, holding its command/query, its handler, and (usually) its validator. This
is not incidental — [ActivityDescriptor](src/Application/Activity/ActivityDescriptor.cs) derives the
audit trail's "screen" from the *namespace*, so `Application.Customers.Commands.Create` logs as
screen "Customers".

The twelve modules: **Activity, Auth, Authorization, Billing, Customers, Employees, Inventory,
Measurements, Occasions, Orders, Pricing, Reports, Settings, WhatsApp**.

### 4.3 Composition root

Two extension methods, called once each from [Program.cs](src/Api/Program.cs):

- `AddApplication()` — [src/Application/DependencyInjection.cs](src/Application/DependencyInjection.cs).
  Registers `ISender`, then **scans the assembly** for every closed `ICommandHandler<,>`,
  `IQueryHandler<,>` and `IValidator<>` and registers each as scoped. A new handler is wired up
  simply by existing. Then registers the two pipeline behaviors *in order*: `ValidationBehavior`,
  then `ActivityLogBehavior`.
- `AddInfrastructure(configuration)` — [src/Infrastructure/DependencyInjection.cs](src/Infrastructure/DependencyInjection.cs).
  Binds the `DbContext` (with both interceptors), Identity, `JwtOptions`, `WhatsAppOptions`, and
  every repository/service port. Lifetimes are deliberate: everything touching the `DbContext` is
  **scoped**; `IInvoiceShareTokenService` is **singleton** (stateless, one derived key);
  `IWhatsAppSender` is registered via `AddHttpClient` (typed client).

---

## 5. The life of a request

Taking `PUT /api/v1/orders/{id}/status` as the worked example:

1. **Kestrel → CORS** (`Frontend` policy, origins from `Cors:FrontendOrigin`, comma-separated,
   exposing `Content-Disposition` so exports keep their filename cross-origin).
2. **`UseAuthentication`** — JWT bearer validation: issuer, audience, signature (HMAC-SHA256 over a
   base64 key), lifetime, 30 s clock skew.
3. **`OnTokenValidated` event** — reads the `session` claim and asks `IActiveSessionService` whether
   it is still the account's current session. If not, `context.Fail("session_superseded")` and the
   response carries `X-Session-Ended: superseded`. This is what makes "one signed-in place per
   account" immediate rather than waiting for the access token to expire.
4. **`UseAuthorization`** — the endpoint's `[Authorize(Policy = Permissions.OrdersStatus)]` resolves
   to a `PermissionRequirement`, handled by `PermissionAuthorizationHandler`, which asks
   `IRolePermissionService` what the caller's *roles* currently grant. Permissions are **not** in
   the token: changing a role's rights takes effect on the next request.
5. **Model binding** — a failure produces the same error envelope as everything else, via
   `ApiBehaviorOptions.InvalidModelStateResponseFactory`.
6. **Controller action** — builds an Application command and calls `ISender.Send(...)`. Controllers
   contain no logic beyond this translation.
7. **`Sender.Dispatch`** — resolves `ICommandHandler<TCommand, TResponse>` from the container by
   reflection, resolves every `IPipelineBehavior<TCommand, TResponse>`, and nests them (reversed, so
   registration order is execution order).
8. **`ValidationBehavior`** — runs every registered `IValidator<TCommand>`. On failure it
   short-circuits with `Error.Validation("VALIDATION_ERROR", …, fieldErrors)` — the handler never
   runs, so nothing is logged to the activity trail either.
9. **`ActivityLogBehavior`** — calls the handler, then (only for a successful `ICommand<>` that is
   not `IUnloggedCommand`, and only when there is a real signed-in user) writes an `ActivityLog` row
   with screen, action, description and a JSON diff of what changed. A failure here is logged, never
   surfaced — the command already committed.
10. **The handler** — loads aggregates through repository ports, calls domain methods, saves,
    returns `Result<OrderDto>`.
11. **`SaveChangesAsync`** fires two interceptors: `AuditableEntitySaveChangesInterceptor` (stamps
    created/modified by/at) and `EntityChangeSaveChangesInterceptor` (captures before/after values
    into the scoped `IEntityChangeCollector` the activity behavior drains).
12. **`ApiControllerBase.ToActionResult`** maps `Result` → HTTP: `Validation`→400, `NotFound`→404,
    `Conflict`→409, `Unauthorized`→401, `Forbidden`→403, anything else→500; success →
    `200 { success, data, meta? }` or `204`.
13. **Unhandled exceptions** are caught by `GlobalExceptionHandler` (registered via
    `AddExceptionHandler` + `UseExceptionHandler`) — no stack trace ever reaches a client.

---

## 6. Shared kernel (`src/Shared`)

Framework-agnostic primitives usable by any layer.

### Results
- **`Result`** / **`Result<TValue>`** — success/failure with an `Error`. Expected business outcomes
  are values, not exceptions.
- **`Error(Code, Message, Type, Details?)`** — with factories `Error.Validation`, `.NotFound`,
  `.Conflict`, `.Unauthorized`, `.Forbidden`, and `Error.None`.
- **`ErrorType`** enum — `Validation, NotFound, Conflict, Unauthorized, Forbidden, Failure`.
- **`FieldError(Field, Message)`** — per-field detail carried to the form that raised it.

### Pagination
- **`PagedResult<T>(Items, Page, PageSize, TotalCount)`**.
- **`PaginationDefaults`** — `DefaultPage = 1`, `DefaultPageSize = 20`, `MaxPageSize = 100`. Every
  collection endpoint is paginated against these.

### Guards
- **`Guard`** — `AgainstNull`, `AgainstNullOrWhiteSpace`, `AgainstEmpty(Guid)`, `AgainstNegative`,
  `AgainstNegativeOrZero`, `AgainstOutOfRange`. Used inside domain factories.

### Contact rules
- **`IndianPhoneNumber`** — `TryNormalize`, `Normalize`, `ToDisplay`, `IsValid`,
  `StartsWithMobileSeries`. Storage form is `+91XXXXXXXXXX`; display and entry are the ten national
  digits; the first digit must be 6–9.
- **`EmailAddress.IsValid`** — regex-based (source-generated).

### Authorization catalogue
- **`AppRoles`** — `Owner, Manager, FrontDesk, Tailor`, plus the built-in permission set per role,
  `PermissionsFor(roles)`, `IsBuiltIn`, `IsKnownRole`. An unknown role contributes nothing rather
  than throwing (a stale claim must not crash a request).
- **`Permissions`** — the catalogue everything derives from:
  - Actions: `View, Manage, Create, Edit, Delete, Import, Retire, Assign, Status, Payment, Void, Send, Password, Rights, Roles`.
  - Modules: `Customers, Measurements, Employees, Orders, Invoices, WhatsApp, Reports, Pricing, Inventory, Settings, Activity, Users`.
  - `ActionsByModule` — which actions each module actually offers.
  - `ModuleOrder` — menu order, so the rights grid is deterministic.
  - `All` (with `Manage` umbrellas — one ASP.NET policy each at startup), `Granular` (without).
  - `Expand(permissions)` — widens a stored `X.Manage` to every action of module X, which is what
    keeps built-in roles and pre-split overrides working after actions were split out.

### Numbering & constants
- **`OrderNumberFormat.Format(prefix, sequenceValue)`** → `MTLA-1111`. Bijective base-26 letter
  (`LetterFor`), four-digit count from 1111 to 9999, then the letter advances (A → B … Z → AA).
- **`SettingKeys`** — only the keys the *server* reads: `Orders.NumberPrefix`, `Invoice.NumberPrefix`.
- **`OrderLimits.MaxItemQuantity = 100_000`** — a typo wall, not a business rule.
- **`SystemUsers.SystemUserId`** — `0000…0001`, stamped when there is no signed-in user.
- **`UserNameRules`** — username length/shape rules shared with the login screen.

---

## 7. Domain layer (`src/Domain`)

Entities have **private setters** and are constructed through static factories. Every one has a
private parameterless constructor reserved for EF materialisation. Ids are `Guid.NewGuid()` in the
factory — never database-generated (see §9.1).

### 7.1 Base types (`Domain/Common`)

- **`IAuditable`** — `CreatedAtUtc`, `CreatedBy`, `LastModifiedAtUtc?`, `LastModifiedBy?`, plus
  `SetCreationAudit` / `SetModificationAudit`.
- **`ISoftDeletable`** — `IsDeleted`, `DeletedAtUtc?`, `DeletedBy?`.
- **`AuditableEntity`** — implements both; `SoftDelete(deletedBy, atUtc)` and `Restore()`.

### 7.2 Orders (the core aggregate)

**`Order : AuditableEntity`** — [src/Domain/Orders/Order.cs](src/Domain/Orders/Order.cs)

| Member | Meaning |
|---|---|
| `OrderNumber` | Stored whole, e.g. `MTLA-1111`. Never rebuilt from the prefix — the prefix is a mutable setting and rebuilding would renumber receipts already in customers' hands. |
| `CustomerId`, `EmployeeId?`, `Status`, `DueAtUtc`, `Notes?` | |
| `DeliveredAtUtc?` | When the garment changed hands. Supplied by the caller, not read off the clock, so a late entry is dated correctly. |
| `WorkStartedAtUtc?` / `WorkCompletedAtUtc?` | Stamped on first arrival at `InProgress` / `ReadyForDelivery`. |
| `Items` | `_items` filtered to non-deleted, so an in-memory aggregate matches a freshly loaded one (EF's soft-delete filter would exclude them). |
| `IsOpen` | Not `Delivered`, `Cancelled` or `Sold`. |
| `RequiresEmployeeToStartWork` | `EmployeeId is null`. |
| `TotalAmount` | `Σ quantity × unitPrice` over live items. In-memory only — carries no invoice tax or discount. |

Methods: `Create`, `CreateFabricSale`, `SealAsSale`, `UpdateDetails`, `AddItem`, `UpdateItem`,
`RemoveItem`, `SetItemFabric`, `AssignEmployee`, `CanTransitionTo`, `TransitionTo`. Private:
`RequireItem`, `EnsureModifiable`.

**Invariants enforced in the entity:**
- The state machine is a table: `Received → InProgress → ReadyForDelivery → Delivered`; any
  non-terminal state → `Cancelled`; `Delivered`, `Cancelled` and `Sold` are terminal.
- `InProgress` requires an assigned employee — deliberately checked in `TransitionTo`, *not* in
  `CanTransitionTo`, because the UI still wants to offer "start work" and say what is missing.
- `Delivered` requires a `deliveredAtUtc`.
- Nothing may be edited (details, items, fabric) unless `IsOpen`.
- An order cannot be emptied — removing the last item throws; cancel it instead.
- `SealAsSale` only accepts an untouched `Received` order with no employee, so it cannot be a back
  door for marking a real stitching job `Sold`.

**`OrderItem : AuditableEntity`** — `OrderId`, `GarmentType`, `Quantity`, `UnitPrice`, `Fabric?`.
**`FabricDetails : AuditableEntity`** — `OrderItemId`, `FabricType`, `Source`, `Color?`, `Quantity`,
`ClothPriceId?` (resolved from the catalogue, which is what makes it come off stock), `ClothCode?`,
`Unit`.
**`OrderStatus`** — `Received, InProgress, ReadyForDelivery, Delivered, Cancelled, Sold`.
**`FabricSource`** — `CustomerSupplied, ShopSupplied`.

### 7.3 Billing

**`Invoice : AuditableEntity`** — aggregate root for its payments.
`InvoiceNumber`, `OrderId`, `CustomerId`, `Subtotal`, `TaxAmount`, `DiscountAmount`, `TotalAmount`,
`AmountPaid`, `Status`, `Payments`, `RemainingBalance`, `CanVoid`.
Methods: `Create`, `CanAcceptPayment`, `RecordPayment`, `Void`.
Rules: subtotal > 0; tax and discount ≥ 0; `total = subtotal - discount + tax` must be > 0; a
payment must be positive and no larger than the remaining balance and the invoice must not be void;
status recomputes to `Paid`/`PartiallyPaid`; only an invoice with **zero** recorded payments can be
voided.

**`Payment : IAuditable`** — `InvoiceId`, `Amount`, `Method`, audit fields. Created only through
`Invoice.RecordPayment`.
**`InvoiceStatus`** — `Unpaid, PartiallyPaid, Paid, Void`. **`PaymentMethod`** — `Cash, Card, Upi,
BankTransfer, Other`.

### 7.4 Customers

**`Customer : AuditableEntity`** — `FullName`, `PhoneNumber` (stored `+91…`), `Email?`, `Address?`,
`Notes?`, `Gender?`, `Religion?`, `DateOfBirth?`, `WeddingDate?`. Methods: `Create`, `UpdateDetails`.
**`Gender`** — `Male, Female`. **`Religion`** — `Hindu, Muslim, Christian, Sikh, Jain, Buddhist, Other`.
**`OccasionContact : AuditableEntity`** — `CustomerId`, `Occasion`, `OccasionYear`, `ContactedOn`,
`Remarks?`; `Record`, `Update`. **`OccasionType`** — `Birthday, WeddingAnniversary`.
**`AnnualOccurrence`** — pure date maths for recurring dates: `Next(source, today)`,
`OnYear(source, year)`, `YearsCompleted(source, occurrence)`.

### 7.5 Employees

**`Employee : AuditableEntity`** — `EmployeeCode`, `FullName`, `JobTitle?`, `PhoneNumber`, `Email?`,
`JoiningDate`, `EmploymentType`, `LastWorkingDate?`, `UserId?`. Methods: `Create`, `UpdateDetails`,
`Retire(lastWorkingDate)`. Retirement is a date, not a delete. **`EmploymentType`** — `FullTime, Contract`.

### 7.6 Measurements

**`Measurement : AuditableEntity`** — `CustomerId`, `GarmentType` (free text — a shop names its own
garments), `ValuesJson`, `Notes?`, and a `Values` projection deserialising to
`IReadOnlyDictionary<string, MeasurementValue>`. Values are stored as **ordinary JSON text**, not a
provider-specific JSON column, so per-garment measurement points stay flexible without a schema
change. Notes travel with the customer+garment onto every future order.

**`MeasurementValue`** — a `readonly record struct` union: `Kind` (`MeasurementPointType`: `Number`,
`Checkbox`, `Text`), `Number`, `Flag`, `Text?`, with a custom
`MeasurementValueJsonConverter : JsonConverter<MeasurementValue>` so the JSON is a bare number,
boolean or string rather than a wrapper object.
**`MeasurementHistory : IAuditable`** — `CaptureSnapshot(measurement)` freezes the previous values
before an edit. **`GarmentTypes`** — `Normalise`, `IsWellFormed`, plus the shipped catalogue.

### 7.7 Inventory & pricing

**`ClothReceipt : AuditableEntity`** — `ClothPriceId`, `ClothCode`, `ClothName`, `Quantity`, `Unit`,
`ReceivedOn`, `SupplierName?`, `InvoiceNumber?`, `RatePerUnit?`, `Notes?`; `Create`.
**`ClothUnit`** — `Metres, Yards, Pieces, Rolls`.
**`ClothPrice : AuditableEntity`** — `ClothCode`, `ClothName`, `CostPrice`, `SellingPrice`;
`Create`, `UpdateDetails`. Stock is *derived*: receipts in, order fabric out (see §16.5).

### 7.8 Identity, settings, messaging, audit

**`RefreshToken : IAuditable`** — `UserId`, `TokenHash` (only the hash is ever stored),
`ExpiresAtUtc`, `RevokedAtUtc?`, `ReplacedByTokenId?`; `Issue`, `Revoke`, `IsRevoked`, `IsExpired`.
**`Setting : IAuditable`** — `Key`, `Value`; `Create`.
**`WhatsAppMessage : AuditableEntity`** — `CustomerId`, `OrderId?`, `MessageType`, `Content`,
`Status`, `ProviderMessageId?`, `FailureReason?`; `Create`, `MarkSent`, `MarkFailed`.
`WhatsAppMessageType` — `OrderStatusUpdate, DeliveryReminder, Custom`; `WhatsAppMessageStatus` —
`Pending, Sent, Failed`.
**`ActivityLog`** — `UserId?`, `UserName?`, `Screen`, `Action`, `RequestName`, `OccurredAtUtc`,
`Description?`, `Changes?` (JSON); static `Record(...)`. Deliberately *not* auditable/soft-deletable
— it is the audit.

---

## 8. Application layer (`src/Application`)

### 8.1 The mediator (`Common/Mediator`)

Seven interfaces and one class:

- `ICommand<TResponse>` — mutates. `TResponse` is always `Result` or `Result<T>`.
- `IQuery<TResponse>` — never mutates, shaped per read use case.
- `ICommandHandler<in TCommand, TResponse>` / `IQueryHandler<in TQuery, TResponse>` — one `Handle`.
- `IPipelineBehavior<TRequest, TResponse>` — `Handle(request, next, ct)`.
- `RequestHandlerDelegate<TResponse>` — the continuation.
- `IUnloggedCommand` — opt-*out* marker for machine-issued commands (only
  `RefreshAccessTokenCommand` carries it today).
- `ISender` — the single abstraction controllers depend on.
- **`Sender`** — resolves the handler by closed generic type, wraps it in the registered behaviors
  (reversed so registration order = execution order), invokes the chain. Reflection-based, ~50 lines,
  deliberately not a general-purpose messaging library.

### 8.2 Pipeline behaviors (`Common/Behaviors`)

- **`ValidationBehavior<TRequest, TResponse> where TResponse : Result`** — runs every registered
  `IValidator<TRequest>`, aggregates `FieldError`s, and short-circuits with a `VALIDATION_ERROR`.
  Because `TResponse` may be `Result` or `Result<T>`, it builds the failure of the right concrete
  type via reflection over `Result.Failure<T>`.
- **`ActivityLogBehavior<TRequest, TResponse> where TResponse : Result`** — described in §5 step 9
  and §12.1.

### 8.3 Ports (`Common/Interfaces` and per-module)

Repository ports, all with intention-revealing methods, `void Add(...)` and an explicit
`SaveChangesAsync` (EF's `DbContext` *is* the unit of work — there is no hand-rolled abstraction over it):

| Port | Notable methods beyond `GetByIdAsync`/`SearchAsync`/`Add`/`SaveChangesAsync` |
|---|---|
| `ICustomerRepository` | `ListAllAsync`, `GetByPhoneNumberAsync`, `GetByEmailAsync`, `FindPotentialDuplicatesAsync(phone, email, excludeId)` |
| `IEmployeeRepository` | `GetByEmployeeCodeAsync`, `GetByPhoneNumberAsync`, `GetByEmailAsync`, `ListAllAsync` |
| `IOrderRepository` | `ExistsForCustomerAsync`, `ExistsForEmployeeAsync`, `SearchByEmployeeAsync`, `GetByCustomerPhoneAsync(phone, excludingOrderId)` |
| `IInvoiceRepository` | `ExistsBillableForOrderAsync`, `GetOutstandingAmountForOrderAsync`, `GetPaidAmountsForOrdersAsync` |
| `IMeasurementRepository` | `ExistsForCustomerAndGarmentTypeAsync`, `GetByCustomerAsync`, `GetHistoryAsync`, `AddHistory` |
| `IClothPriceRepository` | `GetByClothCodeAsync`, `ListAllAsync`, `IsUsedOnAnyOrderAsync` |
| `IClothReceiptRepository` | `GetStockSummaryAsync(search, page, pageSize)` |
| `ISettingRepository` | `GetByKeyAsync`, `ListByKeyPrefixAsync`, `Remove` |
| `IWhatsAppMessageRepository` | — |
| `IActivityLogRepository` | `AddAsync`, `SearchAsync`, `ListScreensAsync`, `ListUsersAsync` |
| `IOccasionRepository` | `SearchAsync`, `UpsertContactAsync` (projects DTOs directly — a read model, not an aggregate) |
| `IReportRepository` | `GetRevenueAsync`, `GetOrderCollectionsAsync`, `GetOrderStatusSummaryAsync`, `GetOutstandingInvoicesAsync` |

Service ports:

| Port | Purpose |
|---|---|
| `ICurrentUserService` | `UserId`, `UserName` off the HTTP principal |
| `IIdentityService` | `LoginAsync`, `RegisterAsync`, `RefreshTokenAsync`, `ChangePasswordAsync`, `RedeemResetCodeAsync` |
| `IActiveSessionService` | `StartSessionAsync`, `IsCurrentAsync`, `ClearSessionAsync`, `SessionClaimType` |
| `IUserAdminService` | list/create/update users, `SetRoleAsync`, `ResetPasswordAsync`, `IssueResetCodeAsync`, `GetFullNameAsync` |
| `IRoleAdminService` / `IRoleCatalog` | create/rename/delete roles; list role names; existence check |
| `IRolePermissionService` | `PermissionsForAsync`, `GetMatrixAsync`, `SetPermissionsAsync`, `ResetPermissionsAsync` |
| `IOrderNumberGenerator` / `IInvoiceNumberGenerator` | `NextAsync` |
| `IInvoiceShareTokenService` | `Create(invoiceId)`, `TryRead(token, out id)` |
| `IWhatsAppSender` | `SendTextMessageAsync` → `WhatsAppSendResult(Success, ProviderMessageId, ErrorMessage)` |
| `IEntityChangeCollector` | `Drain()` → `EntityChange(Entity, Field, From, To)[]` |

### 8.4 Complete use-case inventory

Every folder below is one use case holding a command/query, a handler, and usually a validator.

**Auth** — `Login`, `Register`, `RefreshAccessToken` (`IUnloggedCommand`), `ChangePassword`,
`RedeemResetCode`.

**Customers** — Commands: `Create`, `Update`, `Delete`, `Import` (+ `PreviewCustomerImportQuery`,
`CustomerImportPreviewDto`, `CustomerImportDuplicateDto`). Queries: `GetById`, `Search`
(term + religion filter), `ListAll`, `FindDuplicates`. DTOs: `CustomerDto`, `CustomerDuplicateDto`.

**Measurements** — Commands: `Create`, `UpdateValues`. Queries: `ByCustomer`, `GetById`, `History`.
Templates: `GetMeasurementTemplatesQuery`, `SetMeasurementTemplateCommand`,
`ResetMeasurementTemplateCommand`, plus `MeasurementPointDto` (+ its JSON converter),
`MeasurementTemplateDto`, `MeasurementTemplateDefaults`, `MeasurementTemplateKeys`,
`GarmentCatalogKeys`.

**Employees** — Commands: `Create`, `Update`, `Retire`, `Import`. Queries: `GetById`, `Search`,
`ListAll`, `OrderHistory` (→ `EmployeeOrderDto`).

**Orders** — Commands: `Create` (with `CreateOrderItemInput` / `CreateOrderItemFabricInput` and
their validators), `Update`, `Delete`, `AddItem`, `UpdateItem`, `RemoveItem`, `SetItemFabric`,
`AssignEmployee`, `TransitionStatus`. Queries: `GetById`, `Search`, `Export`,
`PreviousForCustomer`. DTOs: `OrderDto`, `OrderItemDto`, `FabricDetailsDto`. (45 types — the
largest module.)

**Billing** — Commands: `Create`, `RecordPayment`, `Void`. Queries: `GetById`, `Search`,
`GetShareToken`, `GetPublicInvoice`. DTOs: `InvoiceDto`, `PaymentDto`, `PublicInvoiceDto`,
`PublicInvoiceItemDto`, `InvoiceShareTokenDto`.

**Pricing** — Commands: `Create`, `Update`, `Delete`, `Import`. Queries: `GetById`, `Search`, `ListAll`.

**Inventory** — Command: `Receive`. Queries: `Search` (receipts), `Stock` (→ `StockSummaryDto`,
`StockQuantityDto`). Read model: `ClothStockRow`.

**Occasions** — Command: `RecordContact`. Query: `Search` (`OccasionScope` = `Upcoming` | `Contacted`).
DTOs: `OccasionRowDto`, `RecordOccasionContactDto`.

**WhatsApp** — Commands: `Send`, `RecordShare`. Queries: `GetById`, `Search`.

**Reports** — Queries: `Revenue`, `OrderCollections`, `OrderStatusSummary`, `OutstandingInvoices`.
DTOs in `ReportDtos.cs`.

**Settings** — Commands: `Upsert`, `Delete`. Queries: `GetByKey`, `List`.

**Activity** — Queries: `Search`, `Filters`. Plus `ActivityDescriptor` (namespace → screen,
PascalCase → action), `ActivityDescriptionBuilder`, `ActivityValues`, `EntityChange`.

**Authorization** — `RolePermissionService` (cached settings-backed override of the built-in sets),
`RolePermissionsDto`, `ScreenPermissionsDto`, `ScreenPermissionDto`, `RolePermissionMatrixDto`.

**Common** — `ImportResultDto(Created, Updated, Errors)` + `ImportRowErrorDto(RowNumber, Message)`;
`ContactRules` and `GarmentTypeRules` (shared FluentValidation rule sets).

---

## 9. Infrastructure layer (`src/Infrastructure`)

### 9.1 `ApplicationDbContext`

Extends `IdentityDbContext<ApplicationUser, ApplicationRole, Guid>` so Identity and the product's
own entities share one database and one migration history.

`DbSet`s: `RefreshTokens, Customers, OccasionContacts, Measurements, MeasurementHistory, Employees,
Orders, OrderItems, FabricDetails, Invoices, Payments, WhatsAppMessages, Settings, ClothPrices,
ClothReceipts, ActivityLogs`.

`OnModelCreating` does four things:
1. `ApplyConfigurationsFromAssembly` — picks up all 17 `IEntityTypeConfiguration`s.
2. **`RenameIdentityTables`** — `AspNetUserRoles` → `UserRoles`, etc., to match the PascalCase
   naming standard.
3. **`ApplySoftDeleteQueryFilters`** — builds `e => !e.IsDeleted` by expression tree for *every*
   entity implementing `ISoftDeletable`. A new entity gets the filter simply by implementing the
   interface.
4. **`ConfigureClientGeneratedKeys`** — sets `ValueGenerated.Never` on every `Guid` primary key in
   the `MathilensERP.Domain` namespace. Without it, EF's default "generated on add" convention makes
   graph-fixup misread a new child discovered via a collection navigation (the `Payment` that
   `Invoice.RecordPayment` adds) as pre-existing, producing a no-op UPDATE and a spurious
   `DbUpdateConcurrencyException`.

### 9.2 Interceptors

- **`AuditableEntitySaveChangesInterceptor`** — stamps `SetCreationAudit`/`SetModificationAudit` on
  every `IAuditable` entry, using `ICurrentUserService.UserId ?? SystemUsers.SystemUserId`.
- **`EntityChangeSaveChangesInterceptor`** — reads the change tracker *during* `SaveChanges` (the one
  moment both the original and the new value exist) and records `{entity, field, from, to}` into the
  scoped `EntityChangeCollector`, which `ActivityLogBehavior` drains after the handler returns. The
  audit footprint and the soft-delete flags are excluded (they change on every edit and say nothing a
  reader wants), and it caps at 25 changes per request. Drained even when nothing will be written, so
  one request's changes cannot be attributed to the next.

### 9.3 Repositories

One per aggregate under `Persistence/<Module>/`: `CustomerRepository`, `OccasionRepository`,
`EmployeeRepository`, `OrderRepository`, `InvoiceRepository`, `MeasurementRepository`,
`ClothPriceRepository`, `ClothReceiptRepository`, `SettingRepository`, `WhatsAppMessageRepository`,
`ActivityLogRepository`, `ReportRepository`. All LINQ-over-EF; the only raw SQL in the codebase is
the two number generators below.

### 9.4 Identity

- **`ApplicationUser`** / **`ApplicationRole`** — `IdentityUser<Guid>` / `IdentityRole<Guid>` plus
  `FullName`, `MobileNumber`, `IsDeleted`.
- **`IdentityService`** — the whole auth flow (§11).
- **`UserAdminService`** (398 lines) — user CRUD, role assignment, temporary passwords, reset codes.
- **`RoleAdminService`** / **`RoleCatalog`** — two classes rather than one, because `RoleAdminService`
  needs the settings store (to carry a renamed role's rights across) while `RolePermissionService`
  needs the catalogue; folding them together would be an unresolvable DI cycle.
- **`ActiveSessionService`** — one signed-in place per account, stored in Identity's `UserTokens`
  table (no migration needed, cascades with the user) and fronted by `IMemoryCache` written
  *through* on every sign-in, with a 10-minute expiry as a restart backstop. Caveat stated in the
  source: the cache is per process, so more than one instance would need a shared cache.
- **`PasswordResetCodes`** / **`TemporaryPasswords`** — hashed codes and the `MustChangePassword`
  token, both stored as Identity authentication tokens.
- **`JwtOptions`** — `SectionName = "Jwt"`, `SigningKey`, `Issuer`, `Audience`,
  `AccessTokenExpiryMinutes` (15 in dev), `RefreshTokenExpiryDays` (30). Bound with
  `ValidateDataAnnotations().ValidateOnStart()`.

### 9.5 Numbering

- **`OrderNumberGenerator`** — reads the prefix from `Orders.NumberPrefix` (fallback `ORD`), then
  `SELECT nextval('"OrderNumberSequence"')`. A Postgres **sequence**, because `MAX+1` or a counter
  row is only correct while one order is taken at a time. Gaps are accepted deliberately: "a missing
  number is a curiosity, a duplicated one is a dispute at the counter."
- **`InvoiceNumberGenerator`** — `INV-2026-0001`, restarting each January. A **counter table**
  (`InvoiceNumberCounters`) rather than a sequence, claimed in one statement:
  `INSERT … ON CONFLICT ("Year") DO UPDATE SET "LastNumber" = "LastNumber" + 1 RETURNING`. Executed
  with no LINQ composed onto it, because composition would wrap a data-modifying statement in a
  subquery and Postgres would reject it.

### 9.6 Invoice share tokens

**`InvoiceShareTokenService`** — AES-GCM encrypts the invoice `Guid` (12-byte nonce ‖ 16-byte
ciphertext ‖ 16-byte tag), rendered base64url so it survives a URL path and a WhatsApp message.
Encrypted rather than signed so the internal id is *absent*, not merely unforgeable; GCM
authenticates, so a single edited character fails to open rather than opening the wrong invoice. The
key is `SHA256("MathilensERP.InvoiceShareToken.v1|" + (InvoiceSharing:Key ?? Jwt:SigningKey))` — a
purpose-separated derivation so the feature cannot silently 404 in an environment where nobody added
a second secret. No expiry; revocation is a key rotation.

### 9.7 WhatsApp

**`MetaWhatsAppSender`** — typed `HttpClient` against the Meta Cloud API, base URL and credentials
from `WhatsAppOptions` (`WhatsApp:` section). Note that the *product's* actual messaging path is the
frontend's manual click-to-chat share (§15.7); this sender backs the API-side `Send` command.

---

## 10. API layer (`src/Api`)

### 10.1 Wire contracts

- **`ApiResponse<T>`** — `{ success: true, data, meta? }`.
- **`ApiErrorResponse`** — `{ success: false, error: { code, message, details } }`, with
  `ApiFieldError(field, message)`.
- **`PaginationMeta.From(pagedResult)`** — `{ page, pageSize, totalCount, totalPages }`.
- **`ApiControllerBase`** — `ToActionResult(Result)`, `ToActionResult(Result<T>)`,
  `ToPagedActionResult(Result<PagedResult<T>>)`, and the single `Error` → status-code mapping.
- Enums serialise as **names**, not integers (`JsonStringEnumConverter` added globally).
- Request records live in `Contracts/<Module>/` — deliberately separate from Application commands so
  the wire shape and the use case can diverge.

### 10.2 Export and import helpers (`Api/Common`)

- **`ExcelSheet` / `ExcelRow` / `SheetColumns` / `ImportLimits`** — a thin wrapper over
  **ClosedXML 0.105.1**, which does the spreadsheet reading and writing. The wrapper exists to keep
  column definitions and row limits in one place, not to replace the library.
- **`PdfTable`, `ExportResultFactory`, `EmbeddedFontResolver`, `ExportFormat`** — PDF table
  rendering over **PDFsharp-MigraDoc 6.2.4**, with an embedded font (`EmbeddedFontResolver`
  implements PdfSharp's `IFontResolver`), and the `FileResult` factory that names the download.
- **`GlobalExceptionHandler`** — `IExceptionHandler`, logs and returns the standard error envelope.

### 10.3 Every endpoint

Base route `api/v1`. Class-level policy in the header; action-level overrides noted per row.

**`AuthController`** — `[AllowAnonymous]`
| Method | Route | Notes |
|---|---|---|
| POST | `auth/login` | username + password |
| POST | `auth/register` | first-ever account becomes `Owner`, everyone after becomes `Tailor` |
| POST | `auth/redeem-reset-code` | email + code + new password |
| POST | `auth/refresh` | rotates the refresh token |

**`CustomersController`** — `Customers.View`
| Method | Route | Policy |
|---|---|---|
| POST | `customers` | `Customers.Create` |
| GET | `customers/{id}` | |
| GET | `customers` | search + paging |
| GET | `customers/export` | `?format=xlsx\|pdf` |
| POST | `customers/import` | `Customers.Import` |
| POST | `customers/import/preview` | `Customers.Import` |
| GET | `customers/duplicates` | phone/email/excludeId |
| PUT | `customers/{id}` | `Customers.Edit` |
| DELETE | `customers/{id}` | `Customers.Delete` |

**`OrdersController`** — `Orders.View`
| Method | Route | Policy |
|---|---|---|
| GET | `orders/export` | |
| POST | `orders` | `Orders.Create` |
| PUT | `orders/{id}` | `Orders.Edit` |
| DELETE | `orders/{id}` | `Orders.Delete` |
| GET | `orders/{id}` | |
| GET | `orders/{id}/previous` | the customer's earlier orders |
| GET | `orders` | |
| POST | `orders/{id}/items` | `Orders.Edit` |
| PUT | `orders/{id}/items/{itemId}` | `Orders.Edit` |
| DELETE | `orders/{id}/items/{itemId}` | `Orders.Edit` |
| PUT | `orders/{id}/items/{itemId}/fabric` | `Orders.Edit` |
| PUT | `orders/{id}/status` | `Orders.Status` |
| PUT | `orders/{id}/employee` | `Orders.Assign` |

**`InvoicesController`** — `Invoices.View`
| Method | Route | Policy |
|---|---|---|
| POST | `invoices` | `Invoices.Create` |
| GET | `invoices/{id}` | |
| GET | `invoices` | |
| POST | `invoices/{id}/payments` | `Invoices.Payment` |
| GET | `invoices/{id}/share-token` | |
| POST | `invoices/{id}/void` | `Invoices.Void` |

**`PublicInvoicesController`** — `[AllowAnonymous]`, `GET public/invoices/{token}`. A separate
controller on purpose: an anonymous hole punched through a class-level `[Authorize]` is easy to
overlook in review.

**`EmployeesController`** — `Employees.View`: `GET export`, `POST import` (`Employees.Import`),
`POST` (`Create`), `GET {id}`, `GET` (search), `PUT {id}` (`Edit`), `POST {id}/retire` (`Retire`),
`GET {id}/orders`.

**`MeasurementsController`** — `Measurements.View`, route `api/v1`:
`POST customers/{customerId}/measurements` (`Create`), `GET customers/{customerId}/measurements`,
`GET measurements/{id}`, `PUT measurements/{id}` (`Edit`), `GET measurements/{id}/history`,
`GET measurements/templates`, `PUT measurements/templates/{garmentType}` (`Settings.Edit`),
`DELETE measurements/templates/{garmentType}` (`Settings.Edit`).

**`ClothPricesController`** — `Pricing.View`: `GET export`, `POST import` (`Import`), `POST`
(`Create`), `GET {id}`, `GET`, `PUT {id}` (`Edit`), `DELETE {id}` (`Delete`).

**`InventoryController`** — `Inventory.View`: `POST inventory/cloth-receipts` (`Inventory.Create`),
`GET inventory/cloth-receipts`, `GET inventory/stock`.

**`OccasionsController`** — `Reports.View`: `GET occasions`, `GET occasions/export`,
`POST occasions/contacts` (`Customers.Edit`).

**`ReportsController`** — `Reports.View`: `GET reports/export`, `reports/revenue`,
`reports/order-collections`, `reports/order-status-summary`, `reports/outstanding-invoices`.

**`SettingsController`** — `Settings.View`: `PUT settings/{key}` (`Settings.Edit`),
`GET settings/{key}`, `GET settings`, `DELETE settings/{key}` (`Settings.Edit`).

**`ActivityLogsController`** — `Activity.View`: `GET activity-logs`, `GET activity-logs/filters`.

**`WhatsAppMessagesController`** — `WhatsApp.View`: `POST whatsapp-messages/share-opened`,
`POST whatsapp-messages` (`WhatsApp.Send`), `GET whatsapp-messages/{id}`, `GET whatsapp-messages`.

**`UsersController`** — class-level `[Authorize]` only (any signed-in user), per-action policies:
| Method | Route | Policy |
|---|---|---|
| GET | `users/me` | — (any signed-in user) |
| GET | `users` | `Users.View` |
| GET | `users/roles` | `Users.View` |
| GET | `users/roles/details` | `Users.Roles` |
| POST/PUT/DELETE | `users/roles[/{id}]` | `Users.Roles` |
| POST | `users` | `Users.Create` |
| PUT | `users/{id}`, `users/{id}/role` | `Users.Edit` |
| POST | `users/{id}/password`, `users/{id}/reset-code` | `Users.Password` |
| GET | `users/role-permissions` | `Users.View` |
| PUT/DELETE | `users/role-permissions/{role}` | `Users.Rights` |
| POST | `users/me/password` | — (any signed-in user) |

`Users.Rights` is deliberately distinct from `Settings.Manage`, so a Manager cannot grant themselves
the right to hand out access.

### 10.4 Startup behaviour worth knowing

In **every environment except Development**, `Program.cs` before serving a request:
1. `await dbContext.Database.MigrateAsync()` — unguarded, so a broken migration fails the deploy
   loudly instead of serving traffic against a mismatched schema. (This exists because migrations
   were once left to a manual step and stopped being run.)
2. Seeds the four built-in roles if absent.
3. **One-time backfill**: if *no user holds any role at all* — precisely the upgrading-from-the-old-
   world state, and never true again once it has run — every existing user is made `Owner`. Without
   it, the shop owner would be locked out the moment permission checks shipped.

Integration tests pin `ASPNETCORE_ENVIRONMENT=Development` specifically to stay out of this path.

---

## 11. Authentication and authorization

### 11.1 Sign in

`POST /auth/login` → `LoginCommand` → `IdentityService.LoginAsync`:
`FindByNameAsync` (case-insensitive via Identity's normalised column) → reject if missing or
`IsDeleted` → `CheckPasswordSignInAsync(lockoutOnFailure: true)` → distinct `Auth.LockedOut` vs
`Auth.InvalidCredentials` → `IssueTokensAsync`.

Password policy (`AddIdentityCore`): minimum 8 characters, non-alphanumeric not required, lockout
after 5 failures for 15 minutes, unique email required.

### 11.2 Token issuance

`IssueTokensAsync`:
- A **session id** — new `Guid("N")` on sign-in; on refresh, the *existing* session is carried
  forward (rotating it would evict every screen every quarter hour).
- **Access token** — JWT HS256 with `NameIdentifier`, `Email`, `Jti`, the `session` claim, and one
  `Role` claim per role. Expiry `AccessTokenExpiryMinutes`.
- **Refresh token** — 64 random bytes, base64. **Only the SHA-256 hash is persisted.**
- The rotated-from token is revoked and linked via `ReplacedByTokenId`.
- `StartSessionAsync` is called *after* the tokens exist, so a failure cannot record a session for a
  sign-in that never completed.
- `mustChangePassword` is read on **every** issue, not just sign-in — otherwise waiting on the
  change-password screen for fifteen minutes would let a token renewal through.

### 11.3 Refresh, rotation, replay

`RefreshTokenAsync` hashes the presented token and looks it up.
- **Not found** → `Auth.InvalidRefreshToken`.
- **Already revoked** → treated as a compromise: *every* active token for that user is revoked, and
  the caller gets `Auth.TokenReuseDetected`.
- **Expired** → `Auth.RefreshTokenExpired`.
- Otherwise → rotate.

The frontend dedupes concurrent refreshes into a single in-flight promise
([api-client.ts](web/src/lib/api-client.ts)), precisely because two simultaneous 401s redeeming the
same token would look like a replay and nuke the session.

### 11.4 Password changes and resets

- **`ChangePasswordAsync`** (self-service) — clears the `MustChangePassword` token *before* issuing
  tokens, updates the security stamp, revokes all refresh tokens, and hands back a fresh pair so the
  current screen keeps working.
- **Owner-issued reset code** (`POST users/{id}/reset-code`) — a hashed, expiring, single-use code
  stored as an Identity auth token. `RedeemResetCodeAsync` returns **one** indistinguishable failure
  for unknown email / no code / expired / wrong, so the anonymous endpoint cannot be used to
  enumerate accounts or discover who is mid-reset. On success: both code parts cleared, must-change
  cleared, security stamp updated, refresh tokens revoked, lockout and failed-count reset.
- **Owner-issued temporary password** (`POST users/{id}/password`) — sets `MustChangePassword`, which
  the frontend honours by forcing the choose-password screen.

### 11.5 Single active session

Signing in elsewhere supersedes the previous session. Enforced in the JWT `OnTokenValidated` event,
served from an in-process write-through cache so an ordinary request costs no database round trip,
and surfaced to the browser as `X-Session-Ended: superseded` → `/login?ended=superseded` (as opposed
to `?ended=expired`), so the user is told *why* rather than silently bounced.

### 11.6 Permissions

- One ASP.NET **policy per permission**, generated at startup from `Permissions.All`.
- `PermissionAuthorizationHandler` (registered **scoped**, because it reaches a scoped `DbContext`)
  reads the caller's role claims and asks `IRolePermissionService`.
- `RolePermissionService` layers the shop's own overrides — stored in the settings table under
  `Authorization.RolePermissions.<Role>` as a JSON array — over the built-in sets in `AppRoles`, and
  caches the whole map as one `IMemoryCache` entry (5-minute lifetime, dropped on write). It does
  *not* verify the role still exists: that would cost a database read per request to reach the same
  answer, since a deleted role resolves to nothing anyway.

Built-in role sets: **Owner** = everything. **Manager** = everything except Users create/edit/rights/roles.
**FrontDesk** = customers, measurements, orders, invoices, WhatsApp (manage) + pricing/inventory (view).
**Tailor** = customers/measurements view + orders view/manage.

---

## 12. Cross-cutting mechanisms

### 12.1 The activity trail

Written by `ActivityLogBehavior`, never by a handler. Recorded only when *all* of: the request is an
`ICommand<>`; it is not `IUnloggedCommand`; the result succeeded; and there is a real signed-in user
(a row attributed to "System" cannot answer "who did this", so it is not written at all).

Each row carries screen (namespace-derived), action (`TransitionOrderStatusCommand` →
"Transition Order Status"), the raw request type name, a human description
(`ActivityDescriptionBuilder`), and a JSON array of `{entity, field, from, to}` drained from the
change collector. Queried through `GET activity-logs` with `filters` supplying the screen and user
dropdowns.

### 12.2 Soft delete

`ISoftDeletable` + a global query filter generated per entity type. `AuditableEntity.SoftDelete`
records who and when; `Restore()` exists but is not exposed through the API. `Order.Items` filters
in memory so a loaded aggregate matches a reloaded one.

### 12.3 Audit fields

Stamped by interceptor on every `IAuditable` entry — `CreatedAtUtc/By`, `LastModifiedAtUtc/By`. No
handler sets them.

### 12.4 Validation

Two layers: FluentValidation in the pipeline for shape/format, and invariants inside the entity for
business rules. A validation failure never reaches the handler and never reaches the activity trail.
Model-binding failures produce the same envelope.

### 12.5 Errors

`Result` + `Error` all the way out; exceptions are for genuinely exceptional cases and are caught
centrally. Domain invariant violations *do* throw `InvalidOperationException` — handlers are expected
to check `CanTransitionTo` / `CanAcceptPayment` / `IsOpen` first and return a `Result` failure.

---

## 13. Numbering schemes

| Thing | Shape | Source | Configurable via |
|---|---|---|---|
| Order number | `MTLA-1111` → `MTLA-9999` → `MTLB-1111` … `MTLZ` → `MTLAA` | Postgres sequence `OrderNumberSequence` | `Orders.NumberPrefix` (fallback `ORD`) |
| Invoice number | `INV-2026-0001`, restarting each January | `InvoiceNumberCounters` table, single upsert-returning statement | `Invoice.NumberPrefix` (fallback `INV`, upper-cased) |

Both accept gaps by design — a number is spent whether or not the record that took it is saved.

---

## 14. The settings store

One table, `Settings`, key/value strings. Most keys are written and read by a single frontend screen,
so they live only in the frontend; the server-side exceptions are in `SettingKeys`.

Key families in use ([web/src/lib/api/](web/src/lib/api/)):

| Prefix / key | Screen | Purpose |
|---|---|---|
| `Orders.NumberPrefix` | Settings › Order Number | order number prefix |
| `Orders.DefaultDueDateDurationDays` | Settings › Order Duration | default collection date |
| `Invoice.NumberPrefix`, `Invoice.FooterNote`, `Invoice.TaxRatePercent` | Settings › Invoice | invoice format and tax |
| `Shop.Name`, `Shop.Address`, `Shop.Tagline`, `Shop.ContactNumber` | Branding | printed on invoices |
| `Branding.LogoUrl`, `Branding.PrimaryColor` | Branding | applied as CSS variables app-wide |
| `Shop.BusinessMode` | Settings › Business Mode | `tailoring` \| `tailoringFabric` |
| `Shop.WeeklyOffDays`, `Shop.Holidays` | Settings › Working Days | which days a due date may land on |
| `Garment.<name>` | Settings › Garments | the shop's garment catalogue |
| `Tailoring.Rate.<garment>` | Settings › Tailoring Cost | default stitching price per garment |
| `Measurements.Template.<garment>` | Settings › Measurement | measurement points per garment |
| `Authorization.RolePermissions.<role>` | User Rights | permission overrides |
| `WhatsApp.PreferredApp` | Branding | `business` \| `standard` |
| `User.Photo.<userId>` | Profile | avatar as a data URI |

Storing configuration as settings rows rather than schema is a deliberate, repeated pattern: it is
tiny, per-shop, and needs no migration.

---

## 15. Frontend (`web/`)

### 15.1 Shape

Next.js App Router, **statically exported** and served by Azure Static Web Apps. Because dynamic
routes cannot be server-rendered, each `[id]` route is a thin `page.tsx` that renders a
`PageClient.tsx`, and [staticwebapp.config.json](web/staticwebapp.config.json) rewrites
`/dashboard/orders/*` → `/dashboard/orders/_.html`. `useRouteId(offsetFromEnd)` reads the id off the
URL instead of relying on route params.

Everything under `/dashboard` is a client component. There is no server-side session: the shell
checks `isAuthenticated()` on mount and redirects to `/login`.

### 15.2 API client (`lib/api-client.ts`)

`apiGet`, `apiGetPaged`, `apiPost`, `apiPut`, `apiDelete`, `apiPutNoContent`, `apiPostNoContent`,
`apiDeleteFor`, `apiGetFile`, `apiPostFile`. All unwrap the `{ success, data, meta }` envelope and
throw `ApiError(status, code, message, details)` — `details` is what forms bind to their fields.

`fetchWithAuthRetry` is the important part: on a 401 *with* a token it checks
`X-Session-Ended: superseded` first (→ `/login?ended=superseded`, no pointless refresh), otherwise
redeems the refresh token **once** (shared in-flight promise) and retries; if that fails, clears
tokens and hard-navigates to `/login?ended=expired`. A 401 on a request made *without* a token is
never retried — that is bad credentials, not an expired session.

Base URL is `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:5232`), baked in at build time.

### 15.3 Auth storage (`lib/auth.ts`)

`localStorage` under `mathilens.accessToken` / `mathilens.refreshToken`. The file itself flags this
as a pragmatic Phase 1 choice rather than a final security posture — an httpOnly-cookie BFF is the
noted follow-up.

### 15.4 Permission gating

`usePermissions()` fetches `/users/me` and exposes `{ user, isLoaded, can(permission) }`. The
dashboard shell filters `NAV_ITEMS` through it: a leaf with `permission: null` is visible to
everyone; a group survives only if at least one child does; nothing renders until `/me` answers, so
links the user turns out not to hold never flash on screen. A few screens are deliberately routable
but off the menu (`/dashboard/branding`, `/dashboard/whatsapp`, `/dashboard/settings/advanced`,
`/dashboard/settings/change-password`).

### 15.5 API modules (`lib/api/*.ts`)

One per backend area, each exporting the wire types plus thin functions: `activity`, `auth`,
`billing`, `branding`, `business-mode`, `clothPrices`, `customers`, `employees`, `garments`,
`import-export`, `inventory`, `invoice-settings`, `measurements`, `occasions`, `order-invoices`,
`orders`, `public-invoice`, `reports`, `settings`, `shop-calendar`, `tailoring-rates`,
`user-profile`, `users`, `whatsapp`.

Some carry real logic rather than just transport:
- **`order-invoices.ts`** — `findInvoicesForOrder`, `activeInvoiceOf`, `payableInvoiceOf`,
  `deliveryFactsFor(order, invoices, taxRate)`: what the delivery dialog needs to know about money.
- **`shop-calendar.ts`** — `isShopClosed`, `nextOpenDay`: due dates skip weekly offs and holidays.
- **`invoice-settings.ts`** — `taxAmountFor(subtotal, ratePercent)`, invoice date formatting.
- **`garments.ts`** — the shop's garment list with `normaliseGarmentName`, `garmentNameError`,
  `renameGarment`, `seedGarments`.
- **`users.ts`** — the `PERMISSIONS` constant mirroring the backend catalogue, `displayNameOf`.

### 15.6 Shared components (`components/`)

**UI** — `Button`, `Input`/`Textarea`, `Modal`/`ModalActions`, `ConfirmDialog`, `DateInput`,
`DatePartsInput`, `PhoneNumberInput`, `Pagination`, `RowMenu`, `SearchPicker`, `StatusBadge`,
`ToastProvider`/`useToast`, `ExportButton`, `ImportExportButtons`.

Two of these carry policy worth knowing:
- **`Input`/`Textarea`** auto-capitalise as you type — words for inputs, sentences for textareas —
  driven by the standard `autoCapitalize` attribute. Email/tel/password/number/date/url/search types
  and numeric input modes are skipped automatically; search boxes opt out with
  `autoCapitalize="none"`. The value is rewritten on the element and the caret restored by hand
  before the caller's `onChange` sees it.
- **`DateInput`** is a text field showing `DD-MM-YYYY` over an invisible native date input, because
  `<input type="date">` renders in the *browser's* locale and nothing in HTML changes that.
  **`DatePartsInput`** is the alternative for dates far from today (birthdays): separate day / month
  / year grids, all options visible at once, with the last ten years plus an "Earlier years…" list.

**Domain components** — `MeasurementForm`, `MeasurementPointInput`, `MeasurementValuesEditor`,
`OrderItemsEditor`, `DeliveryDialog`, `InvoiceDocument`, `InvoicePrintModal`, `PaymentMethodPicker`,
`DuplicateWarningModal`, `OrderStatusCounts`, `ShareViaWhatsAppButton`, `ChangePasswordForm`,
`ThemeProvider`.

**Hooks** — `useBranding`, `useDebouncedValue`, `useMeasurementTemplates` / `useMeasurementFields`,
`usePermissions`, `useRouteId`, `useToast`.

### 15.7 WhatsApp sharing

The shop messages customers from **its own phone**, not through a provider: `lib/whatsapp/provider.ts`
builds click-to-chat / Android-intent / share URLs (`business` or `standard` app), and
`whatsapp-service.ts` composes the messages (`buildInvoiceMessage`, `buildReadyMessage`,
`buildDeliveredMessage`), resolves the number, and reports why a share is blocked. Invoice shares
carry the public `/invoice/view/{token}` link. The API is told afterwards via
`POST whatsapp-messages/share-opened`. The provider-sent path (`POST whatsapp-messages`) still
exists but the WhatsApp screens are off the menu.

### 15.8 Route inventory

`/` · `/login` (+ `ChoosePasswordForm`, `ResetCodeForm`, `SessionEndedNotice`, `LoginBackdrop`) ·
`/register` · `/invoice/view/[token]` (public) ·
`/dashboard` · `orders` · `orders/[id]` · `orders/new` (kind chooser) · `orders/new/{fabric,tailoring,fabric-tailoring}` ·
`customers` · `customers/new` · `customers/[id]` · `measurements/[id]/history` ·
`employees` · `employees/new` · `employees/[id]` · `employee/[id]` ·
`invoices` · `invoices/[id]` · `price-detail` · `inventory` · `stock` ·
`reports/{revenue,order-collections,order-status,outstanding-invoices,birthday,wedding}` ·
`whatsapp` · `whatsapp/new` · `whatsapp/[id]` ·
`users` · `user-roles` · `user-rights` · `activity` · `profile` · `branding` ·
`settings/{business-mode,order-duration,working-days,garments,tailoring-cost,order-number,invoice,measurement-templates,appearance,change-password,advanced}`.

---

## 16. End-to-end business flows

### 16.1 Taking an order

1. **What kind?** `/dashboard/orders/new` reads `Shop.BusinessMode`. A tailoring-only shop has one
   possible answer and is redirected straight to `/new/tailoring` — "a question with one option is
   not a question". A fabric-trading shop is offered three cards:

   | Kind | Whose cloth | What is billed |
   |---|---|---|
   | `fabric` | shop's | cloth only — no garment, no tailor, no collection date |
   | `tailoring` | customer's | stitching only |
   | `fabricTailoring` | shop's | cloth **and** stitching |

   `effectiveBusinessMode(kind)` decides how the form prices and renders — a tailoring order prices
   as tailoring-only even in a fabric shop, so the item rows never ask whose cloth it is when the
   screen has already answered.
2. **Customer** — searched inline, or added through the shared `CustomerForm` in a dialog (the same
   form as Customers › New, so a customer added at the counter arrives complete rather than with
   three fields).
3. **Items** — `OrderItemsEditor`; garment, quantity, unit price, and for shop cloth a code resolved
   against the catalogue.
4. **Due date** — pre-filled from `Orders.DefaultDueDateDurationDays` and pushed to `nextOpenDay`
   using `Shop.WeeklyOffDays` / `Shop.Holidays`.
5. **`POST /orders`** → `CreateOrderCommandHandler`: verify customer exists → verify employee exists
   → **only then** take an order number (so a number is not spent on an order that was never going
   to be created) → `Order.Create` or `Order.CreateFabricSale` → add items → for each fabric, look up
   the `ClothCode` in the catalogue and attach `ClothPriceId` if matched (an unmatched code is kept
   as typed — the field has always taken free text) → for a fabric sale, `SealAsSale` *after* the
   lines are on → save.

### 16.2 Working an order

`PUT /orders/{id}/status` walks `Received → InProgress → ReadyForDelivery → Delivered`, stamping
`WorkStartedAtUtc` and `WorkCompletedAtUtc` on first arrival. `InProgress` needs an assigned employee
(`PUT /orders/{id}/employee`). `Delivered` needs an explicit handover date. Any non-terminal status
can go to `Cancelled`. Once `Delivered`/`Cancelled`/`Sold`, the order is frozen: details, items and
fabric all refuse edits.

### 16.3 Billing and delivery

1. `POST /invoices` with `orderId`, `taxAmount`, `discountAmount`. Subtotal comes from the order's
   items; the invoice validates `subtotal - discount + tax > 0`. Tax is computed on the client from
   `Invoice.TaxRatePercent`.
2. `POST /invoices/{id}/payments` — amount must be positive and ≤ remaining balance; status
   recomputes; payments are only ever added, never overwritten.
3. `DeliveryDialog` uses `deliveryFactsFor(...)` to show what is outstanding and collect the final
   payment as the garment is handed over, then transitions the order to `Delivered`.
4. `GET /invoices/{id}/share-token` → an AES-GCM token → `/invoice/view/{token}` is readable by the
   customer with no account, and is what the WhatsApp message links to.
5. `POST /invoices/{id}/void` — only while nothing has been paid.
6. `InvoiceDocument` + `InvoicePrintModal` render the printable bill in the browser (branding, shop
   details and `Invoice.FooterNote` all come from settings).

### 16.4 Measurements

A `Measurement` is the *current* truth per customer per garment; editing it first calls
`MeasurementHistory.CaptureSnapshot` so the previous values remain queryable
(`GET measurements/{id}/history`). Which points a garment has comes from a template stored under
`Measurements.Template.<garment>` — `MeasurementTemplateDefaults` ships a starting set, the shop
customises it on Settings › Measurement, and `ResetMeasurementTemplateCommand` puts it back. Values
are a name→`MeasurementValue` map serialised as plain JSON text, where each value is a number, a
boolean or a string.

### 16.5 Inventory and stock

Stock is **derived, not stored**. `POST /inventory/cloth-receipts` records cloth in, keyed to a
`ClothPrice` (the catalogue entry). `GET /inventory/stock` groups by `(ClothPriceId, Unit)` and
computes: received (summed from `ClothReceipts`) minus used (summed from `FabricDetails` rows whose
`ClothPriceId` matches) = available. Cloth that has been *used* but never *received* still appears,
as a row with zero received — otherwise consumption against an unrecorded delivery would vanish from
the screen. This is why the order handler resolves `ClothCode` → `ClothPriceId` rather than trusting
the request: that id is what makes cloth come off stock.

### 16.6 Occasions (birthday / anniversary follow-ups)

`Customer.DateOfBirth` and `WeddingDate` feed `AnnualOccurrence.Next` to produce upcoming occasions.
`GET /occasions` returns either `Upcoming` or already-`Contacted` rows for a window;
`POST /occasions/contacts` upserts an `OccasionContact` for that customer/occasion/**year**, so the
same birthday is not logged twice. Surfaced as the Birthday and Wedding reports, with export.

### 16.7 Import / export

Export: `GET .../export?format=xlsx|pdf` on customers, employees, cloth prices, orders, occasions and
reports. The API sets `Content-Disposition`; CORS exposes that header explicitly, otherwise the
browser hides it and every download falls back to a generic name.

Import: `POST .../import` with a multipart file. Customers additionally offer
`POST customers/import/preview`, which reports what would be created, updated and which rows look
like duplicates, before anything is written. Results come back as
`ImportResultDto(Created, Updated, Errors[])` with per-row messages.

### 16.8 User administration

An Owner creates users (username + email + full name + mobile + role), assigns roles, and can either
reset to a **temporary password** (setting `MustChangePassword`, which forces the choose-password
screen on next sign-in) or issue a short-lived **reset code** the user redeems anonymously. Roles
beyond the four built-ins can be created, renamed (their rights row is carried across) and deleted.
User Rights edits `Authorization.RolePermissions.<role>` and takes effect on the very next request.

---

## 17. Database

- **Provider**: PostgreSQL only. All access through EF Core LINQ except the two number generators.
- **Naming**: PascalCase tables and columns, including the renamed Identity tables (`UserRoles`,
  `UserClaims`, `UserLogins`, `UserTokens`, `RoleClaims`).
- **Keys**: `Guid`, assigned in application code, `ValueGenerated.Never`.
- **Audit**: every `IAuditable` carries created/modified by+at; every `ISoftDeletable` carries
  `IsDeleted`/`DeletedAtUtc`/`DeletedBy` and a global query filter.
- **Configurations** (17): `ActivityLog, ApplicationRole, ApplicationUser, ClothPrice, ClothReceipt,
  Customer, Employee, FabricDetails, Invoice, Measurement, MeasurementHistory, OccasionContact,
  Order, OrderItem, Payment, RefreshToken, Setting, WhatsAppMessage`.
- **Migrations**: 27 under `src/Infrastructure/Persistence/Migrations`, latest
  `20260820034238_AddMeasurementNotes`. Extra database objects created by migration:
  `OrderNumberSequence` (sequence) and `InvoiceNumberCounters` (table), both seeded past their
  backfills.
- **Applied**: automatically at startup outside Development; by hand (`dotnet ef database update`)
  in Development and in CI.

---

## 18. Tests

**`tests/UnitTests`** (~100 files, xUnit):
- `Domain/` — the invariants: `OrderTests`, `OrderFabricSaleTests`, `OrderWorkTimestampTests`,
  `InvoiceTests`, `CustomerTests`, `EmployeeTests`, `MeasurementTests`, `MeasurementHistoryTests`,
  `RefreshTokenTests`, `OccasionContactTests`, `AnnualOccurrenceTests`, `AuditableEntityTests`,
  `SettingTests`, `WhatsAppMessageTests`.
- `Application/` — a handler test and a validator test per use case, plus `SenderTests`,
  `ValidationBehaviorTests`, `ActivityLogBehaviorTests`, `ActivityDescriptorTests`,
  `RolePermissionServiceTests`.
- `Shared/` — `GuardTests`, `ResultTests`, `IndianPhoneNumberTests`, `EmailAddressTests`,
  `OrderNumberFormatTests`.
- `Infrastructure/` — `InvoiceShareTokenServiceTests`.

**`tests/IntegrationTests`** — `CustomWebApplicationFactory` boots the real host (environment pinned
to Development so it does not migrate) with `TestAuthentication`; endpoint suites for Auth,
Authorization (`PermissionEnforcementTests`, `PolicyRegistrationTests`), Customers, Employees,
Orders, Billing, Measurements, Reports, Settings, Users, WhatsApp, plus `PdfTableTests`.

No frontend test framework is configured — `web/package.json` has `dev`, `build`, `start`, `lint`.

---

## 19. Build, CI, deployment, local development

### Build
```
dotnet build MathilensERP.slnx          # solution (slnx format)
dotnet test  MathilensERP.slnx
cd web && npm run dev | npm run build | npx eslint | npx tsc --noEmit
```

### CI — `.github/workflows/ci.yml`
On push/PR to `main`: .NET 10 restore/build/test against a **postgres:18** service container. It
installs `dotnet-ef` and applies migrations explicitly, because the integration tests pin
Development (so the host does not migrate) yet authorization queries the database on every
authenticated request — a running Postgres alone is not enough.

### Deployment
- **API** → `deploy-api.yml`: publish `src/Api` → `azure/webapps-deploy` → App Service
  `api-mathilens-erp`. Triggered by changes under `src/**`. Migrations run at startup.
- **Web** → `azure-static-web-apps-swa-mathilens-erp.yml`: static export → Azure Static Web Apps,
  with `staticwebapp.config.json` supplying the rewrites for dynamic routes.
- Parallel `*-test.yml` workflows target a test slot; `deploy/test-server/` holds nginx + systemd
  assets for a self-hosted test box.
- `docker/Dockerfile.api` and `Dockerfile.web` exist; `docker-compose.yml` is still a placeholder.

### Configuration
- `appsettings.json` — logging and allowed hosts only, no secrets.
- `appsettings.Development.json` — local connection string, dev JWT settings, CORS origin, empty
  WhatsApp credentials.
- Environment/secret keys: `ConnectionStrings__Default`, `Jwt:SigningKey|Issuer|Audience|
  AccessTokenExpiryMinutes|RefreshTokenExpiryDays`, `Cors:FrontendOrigin` (comma-separated),
  `WhatsApp:AccessToken|PhoneNumberId|BaseUrl`, optional `InvoiceSharing:Key`.
- Frontend build-time: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_CUSTOMER_NAME` (the wordmark on the
  login screen).

### Local development — `scripts/start-local.ps1`
Starts a **portable** PostgreSQL (`C:\Users\kutty\pgsql-portable`, no Windows service), then the API
on `:5232` and the web app on `:3000`, each only if the port is free. It sets
`ConnectionStrings__Default` explicitly because `src/Api` has a `UserSecretsId` pointing at the Azure
*test* database, and user secrets outrank `appsettings.Development.json` — without the override,
"local" development silently reads and writes test data.

```
http://localhost:3000        admin@mathilens.local / Admin@12345
http://192.168.1.5:3000      same machine, from a phone on the same Wi-Fi
```

---

## 20. Conventions and gotchas

**Things that will bite you if you do not know them:**

1. **Comments carry the reasoning.** This codebase's comments explain *why*, often citing the
   decision they overturn. Match that register when editing; do not strip them.
2. **Handlers never validate manually, never log manually, never stamp audit fields.** Those are
   pipeline behaviors and interceptors. Adding a use case gets all three for free.
3. **Nothing is registered by hand in Application.** Handlers and validators are found by assembly
   scan — but only if they implement the closed interface. A misnamed generic argument fails at
   runtime with "no service for type", not at compile time.
4. **Behavior order matters**: validation before activity logging, so a rejected command is not
   recorded as something that happened.
5. **Guid keys are `ValueGenerated.Never`.** Do not "fix" this — see the `Payment` graph-fixup note
   in `ApplicationDbContext`.
6. **`Order.Items` filters soft-deleted items in memory**; the backing list still holds them until a
   reload.
7. **Permissions are resolved per request, not stamped into the token.** That is intentional and is
   why `PermissionAuthorizationHandler` is scoped and `RolePermissionService` caches.
8. **`Permissions.Expand`** means a stored `X.Manage` still grants every action of X. Removing that
   would silently strip rights from every pre-existing override.
9. **The API migrates itself on startup everywhere except Development.** A migration that throws
   fails the deploy — deliberately.
10. **Integration tests must stay on `ASPNETCORE_ENVIRONMENT=Development`**, or they will try to
    migrate a database they do not have.
11. **`Content-Disposition` must stay in the CORS exposed headers**, or every export downloads under
    a fallback filename (and a PDF arrives named `.xlsx`).
12. **The frontend refresh must stay deduped.** Two concurrent refreshes look like a replay to the
    backend and revoke the whole token family.
13. **`ActiveSessionService`'s cache is per process.** More than one API instance needs a shared
    cache, not a longer expiry.
14. **Order/invoice numbers may have gaps.** That is the accepted cost of never issuing a duplicate.
15. **Settings are stringly typed by design**, but the two keys the *server* reads are constants in
    `SettingKeys` — a typo there would silently fall back to a default.
16. **Static export constrains routing.** A new dynamic route needs a matching rewrite in
    `staticwebapp.config.json`, or it 404s in production while working locally.
17. **`web/AGENTS.md` is regenerated by `next dev`** and warns that this Next.js version differs from
    training data — read `node_modules/next/dist/docs/` before writing framework-level code.
