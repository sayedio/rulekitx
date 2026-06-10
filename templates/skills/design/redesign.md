---
name: redesign
description: Improve an existing interface without disrupting the workflows and mental models users already rely on — audit first, preserve what works, justify every change.
---

# Redesign (Layer 2)

Extends core. Evolves **existing UI**. Preserves what users already know.

---

## Scope

- Auditing and improving existing interfaces and flows.
- Protecting established user mental models while removing friction.

## Out of Scope

- Building net-new UI quality from scratch → use `premium-ui` (this skill references its standards rather than restating them).
- System/module structure → defer to `architect`.

---

## Core Constraint

A redesign that breaks existing workflows is a failed redesign. Users have mental models around the current interface; disrupting them has a cost. Justify that cost explicitly, or do not pay it.

---

## Phase 1 — Audit

Complete before proposing changes.

**Inventory:** every distinct surface/component in scope and the primary workflow on each.

**Issue categories:** inconsistency · accessibility violations · visual debt · broken/missing states · friction.

```
Surface:       [name]
User workflow: [what the user does here]
Issues found:  [categorized list]
Severity:      critical | major | minor
```

---

## Phase 2 — Preserve

State which elements must be preserved to protect mental models:
- Navigation structure and position
- Primary action locations
- Core workflow sequence
- Familiar terminology users have learned

Also state what is explicitly out of scope.

---

## Phase 3 — Recommend

For each change:
```
Change:    [what changes]
Current:   [how it works today]
Proposed:  [how it works after]
Rationale: [user benefit — not aesthetic preference]
Risk:      [what could confuse existing users]
```

"It looks cleaner" is not a rationale. User benefit is. New UI must stay **consistent with the existing system** and meet `premium-ui` quality bars (states, accessibility, tokens).

---

## Phase 4 — Change Log

```
[Surface / Component] — [what changed] — [rationale in one sentence]
```

---

## Output Format

```markdown
## Audit
[Per-surface findings]

## Findings Summary
[Systemic patterns across surfaces]

## Preserved Elements
[What was kept and why]

## Recommendations
[Per-change: current → proposed + rationale + risk]

## Redesign Plan
[Sequenced steps and why that order]

## Change Log
[Every change, one line each]

## Risks
[What needs testing, what needs a rollback plan]
```

---

## Anti-Patterns

- ❌ Redesigning before completing the audit
- ❌ Moving primary navigation without a documented rationale
- ❌ Changing learned terminology ("Settings" → "Preferences")
- ❌ Aesthetic-only rationale — state the user benefit
- ❌ Redesigning everything at once — sequence to contain blast radius
- ❌ No change log; no preserved-elements list (scope creep starts here)
