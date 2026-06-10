---
name: api-standard
description: Design and review HTTP APIs to a consistent production standard — resource naming, HTTP semantics, status codes, response envelope, errors, pagination, and versioning.
---

# API Standard (Layer 2)

Extends core. APIs are contracts: explicit, stable, consistent. Owns **API design and contracts only**.

---

## Scope

- HTTP resource design, semantics, status codes, response/error shape, pagination, versioning.

## Out of Scope

- UI, business logic, or system structure → defer to the relevant skill.
- General "verify the API exists in the installed version" → inherited from core.
- Review process and severity format → defer to `reviewer` (this skill supplies the API-specific contract rules it checks against).

---

## Pre-Flight

- Who are the consumers? (internal, mobile, third-party, public)
- What is the stability commitment? (experimental, versioned, stable)
- What existing APIs must this stay consistent with?

---

## Resource Naming

- Nouns, not verbs: `/invoices` not `/getInvoices`
- Collections plural: `/users`, `/orders`
- Nesting reflects ownership, max two levels deep
- Kebab-case: `/payment-methods`
- Non-CRUD actions as sub-resource: `POST /invoices/{id}/send`

## HTTP Semantics

- **GET** — retrieve, never mutates, idempotent
- **POST** — create or non-idempotent action
- **PUT** — replace full resource, idempotent
- **PATCH** — update partial fields
- **DELETE** — remove, idempotent

## Status Codes

```
200  Success with body
201  Created — include Location header
204  Success, no body
400  Invalid input — client can fix
401  Not authenticated
403  Authenticated, not permitted — never 404 to hide existence
404  Resource does not exist
409  State conflict (duplicate, version mismatch)
422  Valid syntax, failed business validation
429  Rate limited
500  Server fault — never expose internals
```

---

## Response Shape

Consistent envelope on every response:

```
Success:    { "data": { ... } }
List:       { "data": [...], "meta": { "total": N, "page": N, "per_page": N } }
Error:      { "error": { "code": "SCREAMING_SNAKE", "message": "...", "details": [...] } }
```

- `error.code` — stable, machine-readable
- `error.message` — human-readable, safe to surface
- `error.details` — field-level errors for validation failures
- Never return different shapes for the same endpoint

---

## Error Standards

Every error response: correct status code, stable namespaced `error.code`, human-readable `error.message`, and an `X-Request-ID` header for log correlation. Validation errors (422) identify which fields failed and why. Never expose stack traces, SQL errors, or internal paths.

---

## Pagination

- Offset: `?page=N&per_page=N` for stable datasets — always return `meta.total`.
- Cursor: `?after=<cursor>` for feeds or large mutable datasets.
- Default page size documented; maximum enforced server-side.

---

## Auth

- Authenticate before accessing any resource.
- Authorize for the specific resource, not just the user's role.
- 401 = identity unknown. 403 = identity known, access denied.

---

## Versioning and Compatibility

- Version in URL path: `/v1/`, `/v2/`
- Additive changes (new optional fields/endpoints) — no version bump
- Removals, type changes, new required fields — new version required
- Deprecation requires a documented notice period + migration path

---

## Anti-Patterns

- ❌ Verbs in resource paths: `/getUser`, `/createOrder`
- ❌ `200 OK` with an error body
- ❌ Different shapes for the same endpoint in different conditions
- ❌ 404 to hide a forbidden resource — use 403
- ❌ No `X-Request-ID` for log correlation
- ❌ Stack traces or internal errors exposed to clients
- ❌ Breaking existing response contracts without a version bump
- ❌ Unbounded pagination without a server-enforced maximum
