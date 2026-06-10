---
name: testing-standard
description: Write and structure tests to a consistent production standard — behavior-first, clear naming, a sane pyramid, and no implementation-coupled assertions.
---

# Testing Standard (Layer 2)

Extends core. Tests prove behavior. They do not describe implementation.

---

## Scope

- How tests are written, named, and structured.

## Out of Scope

- Deciding which paths a feature needs covered → comes from `safe-feature`.
- The universal verify/security floor → inherited from core.

---

## Philosophy

A test suite is correct when:
- A failing test means something is actually broken.
- A passing test suite means the system actually works.
- A developer can understand what a test verifies without reading the implementation.

Tests that only pass when the implementation is structured a specific way are tests of structure, not behavior. Delete them and rewrite them.

**Snapshot exception:** snapshot-style tests for UI components (rendered output, serialized markup) are acceptable in modern frameworks when the snapshot represents user-observable output and is reviewed on change. They must not be used to lock in internal structure or auto-updated without review.

---

## Test Hierarchy

```
Unit         ~70%  — single function or class in isolation, dependencies mocked
Integration  ~20%  — multiple real components working together, I/O boundaries real or stubbed
End-to-End   ~10%  — full system from entry point, production-like environment
```

- Unit tests are fast, isolated, and numerous. They test logic.
- Integration tests test contracts between components. They are slower but catch wiring failures.
- E2E tests test user-observable workflows. They are slow and brittle — keep them minimal.

Do not write E2E tests for things covered by unit tests. Do not unit-test things that are only meaningful at the integration level.

---

## Test Naming

Every test name must answer: **"what behavior does this verify, under what condition?"**

Pattern: `[unit] [expected behavior] when [condition]`

```
✅  calculateTotal returns zero when cart is empty
✅  login redirects to dashboard when credentials are valid
✅  createOrder throws ValidationError when email is missing
❌  test1
❌  should work
❌  handles error
```

A developer must be able to read the test name and know exactly what broke without opening the file.

---

## Test Structure

Every test follows Arrange–Act–Assert with clear separation:

```
Arrange:  set up inputs, mocks, and preconditions
Act:      call the unit under test — one call per test
Assert:   verify the outcome — one behavior per test
```

- One logical behavior asserted per test. Multiple assertions for the same behavior are fine.
- Do not test multiple behaviors in one test — split them.
- Test state and output, not how the implementation achieves it.

---

## Coverage Requirements

Minimum coverage is a floor, not a goal. 100% coverage with bad tests is worthless.

Required coverage regardless of percentage:
- Every success path documented in the feature contract
- Every failure mode and error path
- Boundary values: empty, null, zero, max, min, one, many
- Permission and authorization checks
- Any code path changed in a bug fix — regression test required before fix

Do not merge code without tests for new logic paths. Do not bypass this requirement for "hotfixes."

---

## What to Test vs. What Not to Test

**Test:**
- Business rules and domain logic
- Validation behavior
- Error handling paths
- Authorization decisions
- Data transformations

**Do not test:**
- Third-party library internals
- Getter/setter methods with no logic
- Private implementation methods directly — test through the public interface
- Framework wiring (the framework is already tested)

---

## Completion Checklist

- [ ] Every success path has a test
- [ ] Every error and failure mode has a test
- [ ] Boundary values tested (empty, null, zero, max, min)
- [ ] Auth and permission checks tested
- [ ] Test names describe behavior and condition
- [ ] No test asserts on implementation internals
- [ ] Existing tests pass after any change

---

## Anti-Patterns

- ❌ Tests named `test1`, `should work`, or `handleError`
- ❌ Tests that pass only because of implementation structure, not behavior
- ❌ Mocking everything including the unit under test
- ❌ Tests with no assertions — they always pass and prove nothing
- ❌ One test that verifies five different behaviors
- ❌ Only testing the happy path
- ❌ Tests written after the fact to achieve a coverage number
- ❌ E2E tests for logic that can be unit-tested — slow, brittle, and expensive