---
name: refactor
description: Improve code structure and maintainability without changing behavior — test-first, named Fowler operations, one step at a time.
---

# Refactor (Layer 2)

Extends core. Changes **structure**. Never changes behavior.

---

## Scope

- Restructuring existing code for maintainability while preserving observable behavior.

## Out of Scope

- Adding features → defer to `safe-feature` / `exec-complete`.
- Reviewing someone else's diff → defer to `reviewer`.

---

## Hard Preconditions

Stop if either condition is unmet. Do not proceed.

1. **Tests exist** that cover the code being refactored. If they do not exist, write them first — that is the first deliverable, not the refactor.
2. **Behavior is defined** — you can state exactly what the code does today before touching it.

**Emergency override:** in a genuine incident where tests cannot be written first, you may proceed only if you (a) state explicitly that the override is in effect and why, (b) keep the change to the smallest possible scope, and (c) add the missing tests immediately after. This is the documented exception, not a default.

---

## Pre-Flight

Before planning operations:
- Read the code fully. State its current behavior in plain terms.
- Identify the specific problem: complexity, duplication, naming, cohesion, size.
- Define the measurable improvement: what will be cleaner, and how will you know?
- List every test that covers the affected code.

---

## Refactor Operations

Name every operation using Fowler-style terminology. Do not describe vague "cleanups."

Common operations (use the correct name):
- **Extract Method** — move a code block into a named function
- **Inline Method** — replace a single-use function with its body
- **Rename** — rename a variable, function, class, or module to better reflect intent
- **Extract Variable** — name an expression to clarify its purpose
- **Move Function/Field** — relocate a responsibility to the correct owner
- **Replace Conditional with Polymorphism** — replace a type-switch with proper dispatch
- **Extract Class** — split a class doing too much into focused classes
- **Introduce Parameter Object** — replace a long parameter list with a named struct/object
- **Replace Magic Literal** — name a hardcoded constant
- **Decompose Conditional** — extract complex condition logic into named predicates

Each operation in the refactor plan must:
- Have a name from the above list (or a clear Fowler-equivalent)
- State the before and after in one sentence each
- Be independent enough to commit and verify separately

---

## Refactor Plan Format

```
## Refactor Plan

Problem: [what makes this code hard to maintain]
Improvement: [what will be measurably better after]

Operations (in order):
1. [Operation Name] — [one sentence: what moves, what it becomes]
2. [Operation Name] — [one sentence]
...

Behavior preserved by: [list the tests that will verify no regression]
```

---

## Execution Rules

- Execute one operation at a time.
- Run tests after each operation. A failing test stops the sequence.
- Do not combine operations in a single step.
- Do not add functionality during a refactor step. If a bug is found, log it and continue.
- Do not change business logic. Observed behavior must be identical before and after.
- A refactor is complete only when all tests pass and behavior is verified unchanged.

---

## Output Format

```
## Refactor Plan
[plan as above]

## Operations Applied
[numbered list of each operation with before/after]

## Behavior Preserved
[which tests passed, confirming no regression]

## Risks
[any areas of uncertainty or side effects to watch]
```

---

## Anti-Patterns

- ❌ Refactoring without tests — this is rewriting, not refactoring
- ❌ Multiple operations in one commit — makes rollback and review impossible
- ❌ Adding a feature "while cleaning up" — always a separate commit
- ❌ Changing observable behavior and calling it a refactor
- ❌ Vague operations like "cleaned up the handler" — name the operation
- ❌ Stopping halfway — a half-refactored module is worse than the original
- ❌ Renaming for personal preference with no clarity gain