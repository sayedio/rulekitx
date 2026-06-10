---
name: safe-feature
description: Plan and de-risk a new feature inside an existing system before any code is written — feature contract, caller analysis, rollback, and risk.
---

# Safe Feature (Layer 2)

Extends core. Owns the **planning and safety** of adding a feature. Hand the implementation to `exec-complete`.

---

## Scope

- Defining what the feature is and is not.
- Confirming it does not break existing callers.
- Deciding how it is validated, rolled back, and de-risked — before coding.

## Out of Scope

- Runtime implementation discipline (error handling, logging, retries, config) → defer to `exec-complete`.
- Restructuring existing code → defer to `refactor`.
- The universal safety/security floor → inherited from core, not repeated here.

---

## Pre-Flight

Do not write implementation code until all of the following exist.

**Feature contract:**
```
Feature:
Trigger:        [what invokes this — user action, event, schedule, API call]
Inputs:         [each input, type, constraints, required/optional]
Output:         [return value or side effect, type, shape]
Success:        [observable result when it works]
Failure modes:  [each way it can fail and the expected behavior]
Out of scope:   [explicitly excluded behaviors]
```

**Caller analysis** — for every existing caller of touched code:
- List each caller and what it currently expects.
- Confirm the change does not alter observable behavior for existing callers.
- If a caller must change, that is a separate change — not part of this feature.

**Rollback plan:**
- How is the feature disabled without a redeploy (flag, config, toggle)?
- If no toggle exists, how is it reverted (migration down, deployment rollback)?

---

## Scope Discipline

- Build exactly what the contract defines. Nothing more.
- Do not improve adjacent code, refactor, or add abstraction for hypothetical future use.
- If the contract is ambiguous, resolve the ambiguity before coding.

---

## Validation Intent

Decide, per input in the contract, before implementation:
- What makes it valid (presence, type, format, range, constraint).
- That validation belongs at the trust boundary, not deep in business logic.
- That invalid input returns a defined error and never silently corrupts state.

(The runtime mechanics of enforcing this live in `exec-complete`.)

---

## Risk Assessment

Produce before handing off to implementation:
```
Data risk:        [reads/writes/deletes data? impact if wrong?]
Performance risk: [adds latency, load, or resource pressure?]
Dependency risk:  [introduces or changes a dependency?]
Blast radius:     [what breaks if this fails at runtime?]
Mitigation:       [what reduces each risk above?]
```

---

## Planning Checklist

- [ ] Feature contract written
- [ ] Caller analysis complete — no existing behavior changed
- [ ] Validation rules defined per input
- [ ] Rollback mechanism confirmed
- [ ] Risk assessment produced

---

## Anti-Patterns

- ❌ Coding before the feature contract is written
- ❌ Adding unrequested functionality ("while I'm here...")
- ❌ No rollback plan ("we'll just redeploy")
- ❌ Modifying callers as part of the feature change
- ❌ Abstract interfaces for hypothetical future consumers
