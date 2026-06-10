---
name: exec-complete
description: Implementation and runtime discipline — turn a plan into fully working, production-ready code with no stubs, complete error handling, config, and logging.
---

# Exec Complete (Layer 2)

Extends core. Owns **implementation and runtime discipline**. Assumes the plan already exists (see `safe-feature`). Nothing partial ships.

---

## Scope

- Making the code actually production-deployable: error handling, config, logging, retries/timeouts.
- Enforcing the validation rules a plan already defined.
- Proving completeness before handoff.

## Out of Scope

- Deciding what to build, contracts, caller analysis, rollback strategy → defer to `safe-feature`.
- API contract shape → defer to `api`.
- The universal safety/security floor → inherited from core.

---

## Definition of Complete

A senior engineer can deploy it to production without editing it first. That means none of:
- TODOs, FIXMEs, or placeholder comments
- Stubs returning hardcoded values
- Unhandled error paths
- Undocumented required configuration
- Missing tests on critical paths

If any are present, it is not complete.

---

## Implementation Requirements

**Error handling:**
- Every external call handles failure — network error, timeout, unexpected response.
- Every error produces a defined outcome: retry, fallback, propagate, or user-facing message.
- Errors are logged with enough context to diagnose without a debugger. No silent failures.

**Validation enforcement:**
- Enforce the contract's validation at entry — type, format, range, presence.
- Validation errors return actionable messages. No business logic runs on unvalidated data.

**Configuration:**
- Every environment variable is documented: name, purpose, format, required/optional, default.
- Missing required config fails fast at startup, not at first use.

**Logging:**
- Structured entries for significant events: start, completion, failure, retries.
- Include correlation/request IDs where applicable. Never log sensitive data.

**Retries and timeouts:**
- Explicit timeouts on all network calls.
- Retry with backoff and a max attempt count where appropriate; consider idempotency.

---

## Testing Requirements

- Cover every success path and every failure mode identified in the plan.
- Cover boundary values for all validated inputs.
- Exercise real integration points; do not mock everything away.

---

## Output Format

```markdown
## Implementation Status
[What was built — every function, endpoint, or module]

## Error Handling Coverage
[Per external call/failure mode: what happens when it fails]

## Configuration Reference
| Variable | Purpose | Format | Required | Default |
|---|---|---|---|---|
| [name] | [purpose] | [format] | yes/no | [default or N/A] |

## Deployment Readiness
- [ ] All error paths handled
- [ ] All inputs validated
- [ ] All env vars documented
- [ ] Timeouts on all external calls
- [ ] No TODOs or stubs in production paths
- [ ] Structured logging in place
- [ ] Critical paths tested
```

---

## Anti-Patterns

- ❌ `// TODO: handle error` in production code
- ❌ `return null` / `return {}` as an error handler
- ❌ Hardcoded timeouts or retry counts that should be configurable
- ❌ Tests that only cover the happy path
- ❌ Silent catch blocks: `catch (e) {}`
- ❌ Env vars discovered missing at runtime instead of startup
- ❌ Logging entire objects including tokens, passwords, or PII
