---
name: core
description: Always-on reasoning and safety kernel for every task. Defines the decision hierarchy, verify-first protocol, minimal-change safety, and security baseline. Domain skills extend this; do not apply domain-specific reasoning from this file alone.
---

# Core Memory (Layer 1)

The universal floor for every task. Small, always active, never domain-specific. Domain skills add the specifics.

---

## Decision Priority

Apply in order. No lower level overrides a higher one.

1. **Correctness** — Does it verifiably work?
2. **Safety** — Does it preserve existing behavior?
3. **Security** — Does it meet the security baseline?
4. **Clarity** — Is intent readable without reverse-engineering?
5. **Simplicity** — Least complex solution satisfying the above.
6. **Performance** — Only after all above pass.
7. **Style** — Never overrides anything above.

---

## Verify First

- Treat the installed codebase and its lock files as the source of truth — not latest, not training data, not blog posts.
- Verify APIs, signatures, and config keys against the installed version before using them.
- Declare what is confirmed, what is assumed, and what is unknown before coding.
- If something cannot be verified: mark it explicitly as an assumption and proceed — unless it is critical (see below).

---

## Warn First, Stop Only If Critical

Default to warning and proceeding with an explicit, labelled assumption.

Hard STOP and report only when proceeding could be destructive or unsafe:

- Data loss, irreversible migrations, or deletion of code that may still be reachable.
- A security boundary cannot be verified.
- A version/compatibility conflict that would silently break existing behavior.

```
⚠️ Assumption: [what + why]    →  continue
⛔ Blocked: [critical reason]   →  stop and report
```

---

## Modify Safely

- Make the smallest change that satisfies the requirement.
- One concern per change — never bundle refactor, bugfix, and feature.
- Add before replacing; verify the addition works before removing the original.
- Audit call sites before changing any signature or public interface.
- If a change touches more than three unrelated surfaces, reassess scope.

---

## Security Baseline

Apply by default. Do not wait to be asked.

- Treat all external input as untrusted; validate and sanitize at the trust boundary.
- Never concatenate untrusted input into queries, commands, markup, or shell.
- Never hardcode secrets; never log them or place them in error messages.
- Escape output for its target context (HTML, SQL, shell, JSON, URL).
- Request only the permissions and store only the data the task requires.

---

## Execution Principle

- Prefer existing project patterns over inventing new ones.
- Do not introduce architecture without evidence it is needed.

---

## Forbidden (hard stops)

- ❌ Hardcoding any secret, key, token, or credential
- ❌ Concatenating untrusted input into queries, commands, or markup
- ❌ Deleting code without confirming it is unreachable and unused
- ❌ Treating an assumption as a confirmed fact in output
