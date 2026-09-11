# 00 — Master Specification

**Mathilens Tailoring ERP**
**Document Status:** Authoritative — Single Source of Truth
**Version:** 2.1.0
**Owner:** Chief Software Architect, Mathilens Technologies
**Last Updated:** 2026-08-04

---

## How to Read This Document

This is the **engineering blueprint** for Mathilens Tailoring ERP — a commercial product to be sold to multiple tailoring businesses, not a demo, tutorial, or prototype. It is prescriptive: every architecture decision, database design, API contract, UI pattern, deployment pipeline, and coding convention used anywhere in this product must conform to what is written here.

Rules of precedence:

1. If code contradicts this document, the code is wrong.
2. If another doc in `/docs` or `/prompts` contradicts this document, this document wins and the other doc must be corrected.
3. Any deviation requires an explicit, recorded amendment to this document (or an Architecture Decision Record referenced from [01_ARCHITECTURE.md](./01_ARCHITECTURE.md)) — never a silent exception.

This document defines **standards and constraints**. It does not contain application code, database schemas, API endpoint lists, or business logic — those are built later, in conformance with what follows.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Product Scope](#2-product-scope)
3. [ERP Modules](#3-erp-modules)
4. [Engineering Principles](#4-engineering-principles)
5. [Technology Stack](#5-technology-stack)
6. [Development Rules](#6-development-rules)
7. [Coding Standards](#7-coding-standards)
8. [API Standards](#8-api-standards)
9. [UI Standards](#9-ui-standards)
10. [Security](#10-security)
11. [Performance](#11-performance)
12. [Testing](#12-testing)
13. [Deployment](#13-deployment)
14. [Documentation](#14-documentation)
15. [Definition of Done](#15-definition-of-done)

---

## 1. Product Vision

### 1.1 Vision Statement

To become the operating system of choice for tailoring and custom-garment businesses — the single platform a tailoring shop runs on, from the first customer measurement to the final delivered garment, and every payment, employee shift, and WhatsApp reminder in between.

### 1.2 Mission

Replace the fragmented mix of paper measurement books, WhatsApp chats, loose bill books, and spreadsheets that tailoring businesses run on today with one coherent, affordable, commercially licensable ERP — built to enterprise engineering standards from day one, so it scales from a single boutique to a multi-branch chain without a rewrite.

### 1.3 Business Goals

| # | Goal | Success Signal |
|---|------|-----------------|
| G1 | Digitize the full tailoring shop workflow (customer → measurement → order → billing → delivery) | A shop can run its entire daily operation inside the product, no external tools required |
| G2 | Build a recurring-revenue commercial product | Sellable/licensable to multiple independent tailoring businesses, not a one-off custom build |
| G3 | Meet enterprise engineering quality from the first commit | Every module satisfies the [Definition of Done](#15-definition-of-done) |
| G4 | Support the operational reality of tailoring businesses | Native WhatsApp-based customer communication, since that is the channel shops already use |
| G5 | Keep total cost of ownership low enough for small shops while remaining enterprise-grade | MVP infrastructure cost stays minimal (see [5. Technology Stack](#5-technology-stack)) without compromising the architecture's ability to scale |

### 1.4 Target Customers

| Segment | Description | Priority |
|---------|--------------|----------|
| Independent tailoring shops | Single-location, owner-operated, 1–10 employees | Primary (launch segment) |
| Boutique & custom-clothing studios | Design-led, higher-touch measurement and fitting workflows | Primary |
| Alteration shops | High order volume, fast turnaround, lower average order value | Secondary |
| Multi-branch tailoring chains | Multiple locations under one owner, shared customer base | Secondary (post-MVP) |
| Garment manufacturing units with retail counters | Hybrid B2B/B2C, higher order complexity | Future |

### 1.5 Target Market

- **Launch market:** India and South Asia — chosen for tailoring-shop density and because WhatsApp is the dominant customer-communication channel there, directly informing the WhatsApp module ([3. ERP Modules](#3-erp-modules)).
- **Expansion markets:** Middle East and Southeast Asia (similar tailoring-shop density and WhatsApp usage), followed by global markets.
- Market entry is geography-agnostic at the architecture level: currency, locale, tax rules, and communication channels must be configurable, never hardcoded to one region.

### 1.6 Product Philosophy

- **Commercial product first.** Every decision is made as if a paying customer will use it tomorrow — no shortcuts that only make sense for a demo.
- **Boring technology, correctly applied.** Proven, well-supported technology chosen for longevity and hireability, not novelty.
- **Enterprise quality at small-business price.** The engineering bar is enterprise-grade; the pricing and onboarding experience must remain accessible to a single-owner shop.
- **Workflow-first, not form-first.** Screens are designed around how a tailoring shop actually works, not around database tables.
- **Meet the customer on their channel.** WhatsApp is a first-class citizen, not a bolt-on integration.
- **No throwaway code.** Nothing built during the MVP is discarded during later phases; the architecture is chosen up front to make that true.

### 1.7 Core Values

| Value | Meaning |
|-------|---------|
| **Correctness** | The system is trusted with a shop's customers, money, and orders — it must be right before it is fast or pretty |
| **Clarity** | Code, data, and documentation are written for the next engineer, not just the one writing them today |
| **Ownership** | Every module has a clear owner and a clear standard it must meet before it ships |
| **Discipline** | Standards in this document are followed even when a shortcut would be faster in the moment |
| **Respect for the user's business** | A tailoring shop's data (customer measurements, orders, money) is treated with the same rigor as any enterprise system of record |

### 1.8 Success Criteria

The product is succeeding when:

- A tailoring shop can be fully onboarded and run its daily operations (customers, measurements, orders, billing, WhatsApp updates) without leaving the product.
- The engineering team can add a new module without touching or destabilizing existing modules, because the architecture enforces isolation ([4. Engineering Principles](#4-engineering-principles)).
- The product can be deployed, backed up, and recovered by following [13. Deployment](#13-deployment) without tribal knowledge.
- Every shipped module meets the [Definition of Done](#15-definition-of-done) — not "mostly done."

### 1.9 Future Vision

Beyond the modules committed in [3. ERP Modules](#3-erp-modules), the product is expected to grow into inventory/fabric stock management, a public-facing website and e-commerce presence, a self-service customer portal, and AI-assisted features (e.g., measurement suggestions, demand forecasting). These are named explicitly as **Future** in [3. ERP Modules](#3-erp-modules) so the architecture accounts for them without building them prematurely (see [YAGNI](#44-yagni)).

---

## 2. Product Scope

### 2.1 Included Features (MVP + Near-Term Commitment)

The modules listed as MVP or Phase 2 in [3. ERP Modules](#3-erp-modules) constitute the committed product charter: authentication, dashboard, customer management, measurement management, tailoring orders, fabric details, employee management, billing, WhatsApp communication, reports, and settings.

### 2.2 Excluded Features (Explicitly Out of Scope for Now)

These are recognized as valuable but are **not** part of the current committed scope. They must not be silently designed in "just in case," but the architecture must not actively block them later:

- Inventory / fabric stock tracking beyond basic fabric details capture
- Public website and e-commerce storefront
- Self-service customer portal
- AI-assisted features
- Payroll and attendance
- Point-of-sale / retail counter checkout
- Native mobile applications
- Third-party marketplace/integration ecosystem

### 2.3 Future Modules

See the **Future** rows in [3. ERP Modules](#3-erp-modules): Inventory, Website, E-Commerce, Customer Portal, AI Features. These live in [03_ROADMAP.md](./03_ROADMAP.md) once prioritized, not in this document's committed scope.

### 2.4 Phase Roadmap

Detailed and living tracking lives in [03_ROADMAP.md](./03_ROADMAP.md); this is the phase contract this spec commits to.

| Phase | Name | Contents |
|-------|------|----------|
| Phase 0 | Repository Preparation | Folder structure, docs, prompts, root governance files — **complete** |
| Phase 1 | Platform Foundation (MVP Core) | Solution scaffolding, authentication, dashboard shell, database foundation (PostgreSQL), CI/CD skeleton |
| Phase 2 | Core Operational Modules (MVP) | Customer Management, Measurement Management, Employee Management, Tailoring Orders, Fabric Details |
| Phase 3 | Commercial Modules (MVP) | Billing, WhatsApp, Reports, Settings |
| Phase 4 | Hardening & Launch Readiness | Security review, performance pass, full test coverage, production readiness validation, production deployment |
| Phase 5 | Expansion (Future Modules) | Inventory, Website, E-Commerce, Customer Portal, AI Features — reprioritized based on real customer feedback |

No phase begins before the previous phase satisfies the [Definition of Done](#15-definition-of-done) for everything it contains.

### 2.5 MVP Definition

The MVP is the smallest version of the product a real tailoring shop can run its daily operations on end-to-end, comprising the **MVP-tagged modules** in [3. ERP Modules](#3-erp-modules):

- Authentication (shop staff can securely log in)
- Dashboard (at-a-glance operational overview)
- Customer Management
- Measurement Management
- Tailoring Orders
- Fabric Details
- Employee Management
- Billing
- WhatsApp (order/delivery notifications at minimum)
- Reports (core operational reports)
- Settings (shop-level configuration)

The MVP is explicitly **not** feature-reduced engineering — every MVP module still meets the full [Definition of Done](#15-definition-of-done). "MVP" describes *scope* (which modules exist), never *quality* (how well they are built).

### 2.6 Definition of Success

A phase, module, or the MVP as a whole is successful when it satisfies its charter in this document **and** a real tailoring shop could be onboarded onto it without the engineering team needing to apologize for missing capability, broken workflows, or unfinished quality. Success is measured against [1.8 Success Criteria](#18-success-criteria), not against "it demos well."

---

## 3. ERP Modules

| Module | Description | Status | Working Prompt |
|--------|--------------|--------|-----------------|
| Authentication | Secure staff login, session/token management, role assignment | MVP | [03_AUTHENTICATION.md](../prompts/03_AUTHENTICATION.md) |
| Dashboard | At-a-glance business overview: orders in progress, revenue, pending deliveries | MVP | [11_DASHBOARD.md](../prompts/11_DASHBOARD.md) |
| Customer Management | Customer profiles, contact details, order/measurement history | MVP | [04_CUSTOMER_MODULE.md](../prompts/04_CUSTOMER_MODULE.md) |
| Measurement Management | Per-customer, per-garment-type measurement capture and history | MVP | [05_MEASUREMENT_MODULE.md](../prompts/05_MEASUREMENT_MODULE.md) |
| Tailoring Orders | Order lifecycle: creation, garment specification, status, delivery | MVP | [07_ORDER_MODULE.md](../prompts/07_ORDER_MODULE.md) |
| Fabric Details | Fabric/material details associated with an order (type, source, quantity) | MVP | _To be added to `/prompts`_ |
| Employee Management | Staff records, roles, order assignment | MVP | [06_EMPLOYEE_MODULE.md](../prompts/06_EMPLOYEE_MODULE.md) |
| Billing | Invoicing and payment tracking | MVP | [08_BILLING_MODULE.md](../prompts/08_BILLING_MODULE.md) |
| WhatsApp | Customer communication: order updates, reminders, delivery notices | MVP | [09_WHATSAPP_MODULE.md](../prompts/09_WHATSAPP_MODULE.md) |
| Reports | Operational and business reporting | MVP | [10_REPORTS.md](../prompts/10_REPORTS.md) |
| Settings | Shop-level configuration: profile, preferences, roles, integrations | MVP | _To be added to `/prompts`_ |
| Inventory | Fabric/material stock tracking beyond per-order details | Future | _Not yet scoped_ |
| Website | Public-facing marketing/shop website | Future | _Not yet scoped_ |
| E-Commerce | Online storefront and order placement | Future | _Not yet scoped_ |
| Customer Portal | Self-service portal for end customers | Future | _Not yet scoped_ |
| AI Features | AI-assisted measurement, forecasting, recommendations | Future | _Not yet scoped_ |

Every **MVP** and **Phase 2+** module must satisfy [16.1 Module Completion Checklist in 01_ARCHITECTURE.md's companion standard](#15-definition-of-done) before being considered part of the product — see [15. Definition of Done](#15-definition-of-done). **Future** modules are not designed or built until explicitly promoted out of Future status via an update to this document.

---

## 4. Engineering Principles

Mathilens Tailoring ERP is built on **Clean Architecture**, arranged as concentric layers with dependencies pointing strictly inward — see [01_ARCHITECTURE.md](./01_ARCHITECTURE.md) for the full diagrammed treatment. This section states the governing principles; 01_ARCHITECTURE.md states their concrete realization.

### 4.1 Clean Architecture

`Domain` is the core (entities, value objects, business rules, zero framework dependencies). `Application` orchestrates use cases against the domain via ports it defines. `Infrastructure` implements those ports (persistence, external services). `Api` is the thin outermost layer (HTTP concerns, composition root). `Shared` holds framework-agnostic cross-cutting primitives. Dependencies only point inward — never the reverse.

### 4.2 SOLID

| Principle | Applied As |
|-----------|-----------|
| **S**ingle Responsibility | One class, one reason to change ([4.10](#410-single-responsibility)) |
| **O**pen/Closed | New behavior added via new classes, not by editing stable, tested classes ([4.11](#411-open-closed-principle)) |
| **L**iskov Substitution | Any interface implementation must be substitutable without breaking callers' expectations |
| **I**nterface Segregation | Ports are narrow and role-specific, not a god-interface |
| **D**ependency Inversion | Application/Domain define interfaces; Infrastructure implements them; composition happens only in `Api`'s DI root |

### 4.3 DRY (Don't Repeat Yourself)

Shared logic is factored into `Shared`, base classes, or domain services — but DRY is subordinate to correctness and clarity, and to YAGNI ([4.4](#44-yagni)): do not extract an abstraction until a real second use case exists.

### 4.4 KISS (Keep It Simple)

Prefer the simplest design that correctly satisfies the requirement. Complexity (a new pattern, a new abstraction layer, a new library) must be justified by a real, current need — never a hypothetical future one.

### 4.5 YAGNI (You Aren't Gonna Need It)

Do not build configurability, extensibility points, or abstractions for requirements that are not in the current committed scope ([2.2 Excluded Features](#22-excluded-features-explicitly-out-of-scope-for-now), Future rows in [3. ERP Modules](#3-erp-modules)). Future-proofing happens at the level of *architecture choices*, not speculative code.

### 4.6 Repository Pattern

All persistence access goes through repository interfaces defined in `Application`/`Domain` and implemented in `Infrastructure`, exposing intention-revealing methods on aggregates — never a generic, arbitrary-query escape hatch.

### 4.7 CQRS (Command Query Responsibility Segregation)

Commands mutate state and are named as imperatives (`CreateOrderCommand`). Queries never mutate state and are shaped for their specific read use case (`GetOrderByIdQuery`). This is logical separation at launch, not physical (no separate read/write databases) — see [01_ARCHITECTURE.md](./01_ARCHITECTURE.md) for the full pattern treatment.

### 4.8 Mediator Pattern

`Api` controllers depend only on a single in-process mediator/dispatcher, never directly on handler classes — decoupling the presentation layer from the specific command/query handler that serves a request. Full detail in [01_ARCHITECTURE.md § Design Patterns Used](./01_ARCHITECTURE.md).

### 4.9 Dependency Injection

Constructor injection only. No service locator pattern, no static singletons for stateful services. Composition root lives exclusively in `Api`. Lifetimes are explicit and deliberate (Scoped/Singleton/Transient chosen per service's actual statefulness).

### 4.10 Single Responsibility

A class has one reason to change. A command handler performs exactly one use case; a controller holds no business logic; a repository only translates between the domain and persistence for its aggregate.

### 4.11 Open-Closed Principle

New behavior is added by adding new classes (new handlers, new strategies, new validators) rather than editing stable, already-tested classes — especially important as new modules ([3. ERP Modules](#3-erp-modules)) are added over time without destabilizing existing ones.

---

## 5. Technology Stack

The stack is fixed for the life of this product unless this document is explicitly amended. No module may introduce an alternate technology in the same category without an amendment here.

| Category | Choice | Rationale |
|----------|--------|-----------|
| **Frontend** | Next.js (React, TypeScript) | Server-side rendering + SPA ergonomics, strong ecosystem |
| **Backend** | ASP.NET Core (.NET, C#), LTS release | Mature, high-performance, strongly-typed, first-class Clean Architecture support |
| **Database** | PostgreSQL — the primary and only database provider for Version 1, accessed exclusively via EF Core (Code First, migration-based development) | Production-grade concurrency and a full standard SQL feature set from the first commit; used identically in every environment (local, CI, staging, production) so there is no interim database and no future database-migration risk — full detail in [02_DATABASE.md](./02_DATABASE.md) |
| **Authentication** | ASP.NET Core Identity + JWT bearer tokens (access + refresh token pair) | Industry-standard, integrates cleanly with RBAC |
| **Logging** | Serilog, structured logging, console + file (local), cloud sink (production) | Structured logs are queryable; dev-friendly locally, production-ready in the cloud |
| **Storage** | Abstracted file storage port backed by a cloud object store (e.g., Azure Blob Storage) | Measurement photos, invoice PDFs; provider-agnostic behind an interface |
| **Testing** | xUnit (with its built-in `Assert`), NSubstitute (mocking) | Fast, expressive, avoids brittle over-mocked tests. FluentAssertions was dropped during Phase 1 implementation: its license became commercial-only starting v8, which is an unacceptable risk to pin into a product built to be sold — xUnit's own `Assert` is free, sufficient, and already in use |
| **CI/CD** | GitHub Actions | Already scaffolded in [.github/workflows](../.github/workflows) |
| **Monitoring** | Structured Serilog logs + health check endpoints + APM (e.g., Application Insights) in production | Observability from day one |
| **Deployment** | Docker images to Azure (primary) with Railway as a lower-cost staging/alternate target | See [13. Deployment](#13-deployment) |

---

## 6. Development Rules

| # | Rule | Meaning |
|---|------|---------|
| 1 | Never duplicate code | Before writing a new helper, query, or component, check whether an equivalent already exists in `Shared`, the relevant module, or the component library, and reuse it |
| 2 | Reuse components | UI work consumes the shared component library; backend work consumes existing base classes, pipeline behaviors, and ports rather than reinventing them |
| 3 | Production ready | Every change is written as if it ships to a paying customer's shop today — no demo-quality shortcuts |
| 4 | Testable | Code is structured (small units, dependency-injected ports) so it can be tested without heroics |
| 5 | Maintainable | A future engineer with no prior context can understand and safely change the code, guided by [7. Coding Standards](#7-coding-standards) |
| 6 | Scalable | Design choices ([5. Technology Stack](#5-technology-stack), [02_DATABASE.md](./02_DATABASE.md)) do not block growth from one shop to thousands |
| 7 | Secure | Every change is evaluated against [10. Security](#10-security) before it ships |
| 8 | Reusable | Shared concerns (audit fields, soft delete, pagination) are implemented once, centrally, and reused across every module |
| 9 | Commercial quality | The bar is "sellable to a paying customer," not "works in a demo" |

---

## 7. Coding Standards

### 7.1 Naming

| Item | Convention | Example |
|------|-----------|---------|
| C# Project | `MathilensERP.<Layer>` | `MathilensERP.Domain` |
| C# Class / Interface | PascalCase, interfaces prefixed `I` | `OrderService`, `IOrderRepository` |
| C# Method | PascalCase, verb-first | `CreateOrderAsync` |
| C# Private field | `_camelCase` | `_orderRepository` |
| C# Local variable / parameter | camelCase | `orderId` |
| Command | `<Verb><Noun>Command` | `CreateOrderCommand` |
| Query | `Get<Noun>[By<Criteria>]Query` | `GetOrderByIdQuery` |
| DTO | `<Noun>Dto` | `OrderDto` |
| TypeScript file | kebab-case | `order-list.tsx` |
| TypeScript component | PascalCase | `OrderList` |
| Environment variable | `UPPER_SNAKE_CASE` | `DATABASE_CONNECTION_STRING` |

### 7.2 Namespaces

Root namespace `MathilensERP`. One namespace segment per folder level, no exceptions — a class's namespace always matches its physical path. No "misc"/"helpers"/"utils" catch-all namespaces inside a module; genuinely cross-cutting code belongs in `Shared`.

### 7.3 Methods

One method, one responsibility. Method length beyond ~40 lines is a signal to decompose. Prefer a small number of well-named parameters or a request object over long parameter lists.

### 7.4 Interfaces

Interfaces are defined by the consumer's needs, living in the layer that consumes them (`Application`/`Domain`), implemented in `Infrastructure`. No interface for a class with one implementation and no test-substitution need — repositories and external service clients are the standing exception, since they exist specifically to be substituted.

### 7.5 DTOs

DTOs cross layer boundaries (`Application` ⇄ `Api`, `Api` ⇄ client); domain entities never cross the `Api` boundary directly. DTOs are flat, serialization-friendly records.

### 7.6 Commands

Commands are immutable records named `<Verb><Noun>Command`, carrying only the data required to perform the mutation. A command handler performs exactly one use case.

### 7.7 Queries

Queries are immutable records named `Get<Noun>[Criteria]Query`, returning DTOs shaped for their specific read use case — never a reused generic entity DTO forced to fit every screen.

### 7.8 Validation

Input validation (shape, required fields, format) happens at the `Application` boundary via a validation pipeline behavior. Business-rule validation lives in the `Domain` layer, enforced by the entity itself. Validation failures are structured, field-level errors ([8.7 Error Model](#87-error-model)).

### 7.9 Comments

Code reads clearly enough that comments explaining *what* it does are unnecessary. Comments are reserved for *why* — a non-obvious business rule, a workaround, a warning about a subtle consequence. No commented-out code is ever committed.

### 7.10 XML Documentation

Public APIs at layer boundaries consumed outside their own project carry XML doc comments so generated Swagger/IntelliSense documentation is meaningful. Internal, self-explanatory implementation details do not require XML docs.

### 7.11 Async Standards

All I/O-bound operations are `async`/`await` throughout — no blocking on async code anywhere. Async method names end in `Async`. `CancellationToken` is accepted and propagated end-to-end.

### 7.12 Nullable References

Nullable Reference Types are enabled solution-wide. A nullable type is a deliberate statement that the value can be absent — never a default suppressed with `!` without a comment justifying why it is provably safe.

### 7.13 Error Handling

Exceptions represent genuinely exceptional, unexpected failures — not expected business outcomes (modeled as typed results or specific responses). A single global exception-handling middleware translates unhandled exceptions into the standard [Error Model](#87-error-model). No empty `catch` blocks; no silent swallowing.

---

## 8. API Standards

### 8.1 REST

The API is resource-oriented REST over HTTP/JSON. Resources are nouns (`/customers`, `/orders`); actions are HTTP verbs. A controller action's only job is to translate an HTTP request into a command/query, dispatch it via the mediator, and translate the result into an HTTP response.

### 8.2 Versioning

URL-segment versioning: `/api/v{n}/...`. A version is only incremented for breaking changes; additive, backward-compatible changes do not require a new version.

### 8.3 Pagination

All collection endpoints are paginated by default — no endpoint returns an unbounded list. Standard parameters: `page` (1-based), `pageSize` (bounded by a documented maximum). Response `meta` includes `page`, `pageSize`, `totalCount`, `totalPages`.

### 8.4 Filtering

Filtering uses explicit, documented query parameters per resource, validated the same way as any other input. An unknown or malformed filter is a `400`, not a silently ignored parameter.

### 8.5 Sorting

Standard `sort` query parameter (`?sort=createdAtUtc` / `?sort=-createdAtUtc` for descending). Each endpoint documents its whitelist of sortable fields.

### 8.6 Response Model

All successful responses use a consistent envelope:

```json
{
  "success": true,
  "data": { },
  "meta": { }
}
```

`data` holds the resource or collection; `meta` is present when relevant (pagination, timestamps) and omitted otherwise.

### 8.7 Error Model

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "email", "message": "Email is not a valid address." }
    ]
  }
}
```

`code` is a stable, machine-readable identifier distinct from the human-readable `message`. `details` is present for field-level validation errors. Error responses never leak internal detail (stack traces, SQL) outside local development.

### 8.8 Swagger

Every endpoint is documented via Swagger/OpenAPI, generated from XML doc comments and typed request/response DTOs — never hand-maintained separately. Swagger UI is available in non-production environments; production exposure is a deliberate, reviewed decision.

---

## 9. UI Standards

### 9.1 Responsive

Mobile-first layout: every screen is designed for small viewports first, then progressively enhanced for tablet and desktop — tailoring shop staff frequently work from phones/tablets on the shop floor.

### 9.2 Accessibility

Target WCAG 2.1 AA as the baseline. All interactive elements are keyboard-navigable and screen-reader labeled. Color is never the only signal.

### 9.3 Dark Mode / Light Mode

Both modes are first-class from the introduction of the component library, driven by a single design-token system — no screen hardcodes raw color values. Theme follows system preference by default, with a persisted user override.

### 9.4 Component Standards

One shared component library, used by every screen — no per-screen bespoke buttons/inputs/cards. Components are built and documented in isolation before being consumed by feature screens.

### 9.5 Forms

Consistent field-level validation UX tied to the [API error model](#87-error-model). Destructive actions always require explicit confirmation. Forms preserve user input on validation failure.

### 9.6 Tables

Data tables support sorting and pagination consistent with the [API pagination](#83-pagination)/[sorting](#85-sorting) contract. Defined empty state and loading state — never a blank screen.

### 9.7 Search

Every module with meaningful record volume (customers, orders) has a debounced, server-side search entry point — never a client-side filter over an unbounded fetched list.

### 9.8 Filters

Filters are visible and persistent while in use, clearly show what is currently active, and are trivially clearable.

### 9.9 Dashboard

Dashboard widgets are read-only summaries backed by dedicated, purpose-built queries — never reusing a detail-page query and discarding most of the data. Every widget has a loading and empty state.

### 9.10 Loading

Every asynchronous action (page load, form submit, search) has a visible, consistent loading indicator — no silent waits, no layout jumps when loading resolves.

### 9.11 Notifications

Success, warning, and error feedback use a consistent, non-blocking notification pattern (e.g., toast) — critical destructive-action confirmations use a blocking modal instead ([9.5 Forms](#95-forms)).

### 9.12 Validation

Client-side validation mirrors server-side validation rules for immediate feedback, but the server is always the authority — client-side validation is a UX convenience, never the only enforcement.

---

## 10. Security

### 10.1 Authentication

ASP.NET Core Identity backs user credentials; JWT bearer tokens (short-lived access token + longer-lived refresh token) authenticate API requests. Refresh tokens are single-use and rotated on every use; a reused refresh token revokes the whole token family.

### 10.2 Authorization

Every API endpoint declares its authorization requirement explicitly — no implicitly-public endpoint. Authorization is policy-based, checked centrally via middleware/filters — never ad hoc `if` checks scattered inside handlers.

### 10.3 RBAC

A fixed set of roles, each mapped to a set of permission claims. Authorization checks are against permissions, not raw role names, so the role→permission mapping can evolve without touching every authorization check.

### 10.4 Password Policy

Minimum length 8 characters, checked against a breached-password list where feasible. Passwords are hashed with ASP.NET Core Identity's default hasher — never reversible encryption. Account lockout after a defined number of failed attempts.

### 10.5 Encryption

All traffic is HTTPS/TLS only. Sensitive data at rest is encrypted at the storage layer where warranted. No sensitive data is ever logged.

### 10.6 Audit Logs

Every business-meaningful state change (order status change, billing action, employee/customer record change) is recorded: what changed, who changed it, when — distinct from the audit *fields* on each entity (see [02_DATABASE.md](./02_DATABASE.md)).

### 10.7 SQL Injection Prevention

All database access goes through EF Core with parameterized queries — no string-concatenated SQL, ever.

### 10.8 XSS Prevention

The frontend framework's default output encoding is relied upon; raw HTML injection is forbidden unless sanitized through an explicit, reviewed step.

### 10.9 CSRF Prevention

The API is token-authenticated (JWT bearer), which is inherently not CSRF-vulnerable in the classic sense; any cookie-based session mechanism introduced for any flow must carry anti-CSRF protections as a mandatory pairing.

### 10.10 Secrets

No secret is ever committed to source control. Local development uses gitignored secret stores; deployed environments use the hosting platform's secret store. A leaked secret is treated as compromised immediately.

---

## 11. Performance

### 11.1 Caching

Read-heavy, low-volatility data is cached with an explicit, documented invalidation trigger — never a cache with no invalidation story.

### 11.2 Pagination

Enforced at the API layer by default ([8.3](#83-pagination)) — every new collection endpoint is performance-safe by construction.

### 11.3 Query Optimization

No N+1 query patterns — EF Core queries use explicit projection/`Include` to fetch what's needed in one round trip, checked in code review.

### 11.4 Indexes

Every foreign key column is indexed; indexes are added deliberately, driven by real query patterns — see [02_DATABASE.md](./02_DATABASE.md) for the full indexing standard.

### 11.5 Logging

Structured logging throughout; log messages carry structured properties, never string-interpolated free text that can't be queried. No secrets in logs at any level.

### 11.6 Background Jobs

Long-running or deferred work (batch WhatsApp sends, report exports) runs as a background job, never inline in a request/response cycle. Jobs are idempotent and their failures are logged and surfaced.

---

## 12. Testing

### 12.1 Unit Tests

`Domain` and `Application` logic is unit tested in isolation — `Domain` tests exercise entities/value objects directly; `Application` handler tests substitute their port interfaces with test doubles. Fast, deterministic, no database/network/filesystem.

### 12.2 Integration Tests

`Infrastructure` and full `Api` request pipelines are tested against real dependencies where feasible (a real database engine, not an in-memory stand-in that hides real provider behavior).

### 12.3 Coverage Goals

| Layer | Target |
|-------|--------|
| `Domain` | ≥ 90% line coverage |
| `Application` | ≥ 85% line coverage |
| `Infrastructure` | ≥ 70% line coverage |
| `Api` | Every endpoint has ≥ 1 success-path and ≥ 1 error-path test |

Coverage is a floor, not the goal — meaningless assertions that hit a number still fail review.

### 12.4 Testing Rules

Tests are independent and order-agnostic. Test names state the scenario and expected outcome. Arrange/Act/Assert structure throughout. A failing test is a build failure — CI never merges on red tests.

---

## 13. Deployment

### 13.1 Environment Variables

All environment-specific configuration (connection strings, external API keys, feature toggles) is supplied via environment variables, never hardcoded, never committed. A documented, exhaustive list per component is maintained in [07_DEPLOYMENT.md](./07_DEPLOYMENT.md).

### 13.2 Azure

Azure is the primary production deployment target: containerized services, **Azure Database for PostgreSQL (Flexible Server)** as the managed database host ([02_DATABASE.md § 2.3 Hosting Strategy](./02_DATABASE.md#23-hosting-strategy)), managed secret store, and an APM for monitoring.

### 13.3 Railway

Railway is the designated lower-cost target for staging/preview environments and early-stage cost control, running the same Docker images as production against **Railway's managed PostgreSQL** add-on — no environment-specific code branching between Railway and Azure, only a different connection string.

### 13.4 Docker

Every deployable component has its own Dockerfile producing a minimal, production-only image. `docker-compose.yml` defines the full local development stack, including **PostgreSQL running as a containerized service** so local development runs against the same database engine as production. Images are never built with secrets baked in. Self-hosted PostgreSQL (on-premise or a cost-sensitive VM-based deployment) is a supported fallback hosting option using the identical schema and EF Core provider — see [02_DATABASE.md § 2.3 Hosting Strategy](./02_DATABASE.md#23-hosting-strategy) for the full comparison of all four PostgreSQL hosting options.

### 13.5 Configuration

Non-secret, environment-agnostic defaults live in committed configuration files; environment-specific overrides are layered on top; secrets never appear in either, only environment variable/secret-store references.

### 13.6 Backup

The production PostgreSQL database is backed up on an automated, defined schedule (daily at minimum, with point-in-time recovery via continuous WAL archiving), stored separately from the primary database's infrastructure. See [02_DATABASE.md § 11 Backup Strategy](./02_DATABASE.md#11-backup-strategy) for the full backup and point-in-time recovery strategy.

### 13.7 Recovery

A documented Recovery Time Objective (RTO) and Recovery Point Objective (RPO) is set before production launch, and the backup/deployment strategy is validated against it. Backup restore is periodically tested.

---

## 14. Documentation

| Document | Purpose |
|----------|---------|
| README | Front door: what the product is, how to get a local environment running, where to find the rest of the documentation |
| API Docs | Swagger/OpenAPI-generated, always in sync with deployed code by construction |
| Architecture | [01_ARCHITECTURE.md](./01_ARCHITECTURE.md) — the concrete realization of [4. Engineering Principles](#4-engineering-principles) |
| Database | [02_DATABASE.md](./02_DATABASE.md) — schema design standards and entity documentation |
| Deployment | [07_DEPLOYMENT.md](./07_DEPLOYMENT.md) — operational runbook: environment variables, deployment/rollback/backup/recovery steps |
| Release Notes | [10_RELEASE_NOTES.md](./10_RELEASE_NOTES.md) (narrative) + [CHANGELOG.md](../CHANGELOG.md) (strict chronological record) |

A change that affects behavior described in any of these documents updates that document in the same change — documentation drift is treated as a defect.

---

## 15. Definition of Done

A module, feature, or task is **complete** only when every item below is true. Partial completion is not completion.

- [ ] **Build succeeds** — the full solution builds with zero errors.
- [ ] **No compile errors** — across all projects (`Api`, `Application`, `Domain`, `Infrastructure`, `Shared`, and the frontend).
- [ ] **Tests pass** — the full automated test suite is green, including the new tests the change required ([12. Testing](#12-testing)).
- [ ] **Documentation updated** — relevant `/docs`, `/prompts`, [CHANGELOG.md](../CHANGELOG.md), and [03_ROADMAP.md](./03_ROADMAP.md) reflect the change.
- [ ] **Feature complete** — UI, API, validation, business rules, logging, authorization, testing, documentation, error handling, and audit logging are all present for the feature (see the Module Completion Checklist in [01_ARCHITECTURE.md](./01_ARCHITECTURE.md)).
- [ ] **Production ready** — meets [10. Security](#10-security) and [11. Performance](#11-performance) standards, not merely "works on my machine."

---

## Related Documents

- [01_ARCHITECTURE.md](./01_ARCHITECTURE.md)
- [02_DATABASE.md](./02_DATABASE.md)
- [03_ROADMAP.md](./03_ROADMAP.md)
- [04_FEATURES.md](./04_FEATURES.md)
- [05_UI_GUIDELINES.md](./05_UI_GUIDELINES.md)
- [06_API_GUIDELINES.md](./06_API_GUIDELINES.md)
- [07_DEPLOYMENT.md](./07_DEPLOYMENT.md)
- [08_SECURITY.md](./08_SECURITY.md)
- [09_CODING_STANDARDS.md](./09_CODING_STANDARDS.md)
- [10_RELEASE_NOTES.md](./10_RELEASE_NOTES.md)
- [../prompts/00_MASTER_PROMPT.md](../prompts/00_MASTER_PROMPT.md)
