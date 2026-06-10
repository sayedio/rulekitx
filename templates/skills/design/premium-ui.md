---
name: premium-ui
description: Build professional, accessible, production-grade UIs — every state handled, WCAG AA, mobile-first, and consistent with the project's design system. Domain-invoked only.
---

# Premium UI (Layer 2)

Extends core. Every state is handled; every value is intentional. **Domain-invoked only** — never apply to non-UI tasks.

---

## Scope

- Building UI surfaces: states, accessibility, hierarchy, responsiveness.

## Out of Scope

- Non-UI tasks (do not load this for backend/API/infra work).
- Evolving an existing interface → defer to `redesign`.

---

## Respect the Existing Design System

The project's design system wins over the defaults below.

- If the project defines tokens, components, spacing, or type scales, follow them.
- Treat the rules below as the baseline when no project system exists, or to fill a gap in one.
- Record any deliberate deviation from the project system and why.

---

## Pre-Flight

- What is the user trying to accomplish on this surface?
- What are all states: loading, empty, error, success, disabled, partial?
- What breakpoints and devices matter?
- What design tokens / system constraints already exist?

An unhandled empty state is an incomplete UI.

---

## Token & Hierarchy Defaults

When no project system overrides them:
- **Color:** semantic tokens, not raw hex/rgb in component code.
- **Spacing:** 4px base grid (4, 8, 12, 16, 24, 32, 48, 64).
- **Typography:** a defined scale; body ≥ 16px, small ≥ 12px rendered.
- **Radius/Motion:** consistent per component; motion fast 100ms / default 200ms / slow 300ms.
- One primary action per screen; supporting actions subordinate.
- Hierarchy via size, weight, and space — never color alone.

---

## State Requirements

Every interactive surface handles all of these. "Not yet designed" fails completion.

| State | Requirement |
|---|---|
| **Loading** | Skeleton or spinner; indicate what is loading. Never a blank screen. |
| **Empty** | Explain why; offer a next action. Never just "No data." |
| **Error** | State what went wrong and what the user can do. Never expose internals. |
| **Success** | Confirm specifically. "Invoice saved", not "Done." |
| **Disabled** | Visually distinct; explain why if non-obvious. Never silently hidden. |

---

## Accessibility (WCAG AA — Non-Negotiable)

- Interactive elements keyboard-operable; tab order follows visual order.
- Every input, button, and icon has an accessible name.
- Focus indicators visible. Never `outline: none` without a replacement.
- Color is never the only indicator of state, error, or category.
- Form errors associated with their field programmatically.
- Dynamic content (modals, toasts, live regions) announced to screen readers.
- Touch targets ≥ 44×44px on mobile.

---

## Responsiveness

- Mobile-first; build the smallest layout first.
- Breakpoints content-driven, not device-named.
- No unintentional horizontal scroll on standard viewports.
- All interactions work without hover (touch parity).
- Verify at 375px width, keyboard-only, and 200% zoom.

---

## Completion Checklist

- [ ] All states handled: loading, empty, error, success, disabled
- [ ] Contrast meets WCAG AA on all text
- [ ] Interactive elements keyboard-accessible with visible focus
- [ ] Interactive elements have accessible names
- [ ] Color is not the sole indicator of meaning
- [ ] Dynamic content announced to assistive tech
- [ ] Touch targets ≥ 44×44px
- [ ] Values come from the project's design system (or documented baseline)
- [ ] Verified at 375px minimum width

---

## Anti-Patterns

- ❌ Building only the happy path — empty/error states are not optional
- ❌ Removing focus rings for aesthetics
- ❌ Ignoring an existing project design system in favor of these defaults
- ❌ Icon-only interactive elements without accessible labels
- ❌ Hover-only interactions that don't work on touch
- ❌ Using color alone to indicate meaning
- ❌ "We'll fix accessibility later" — it does not retrofit cleanly
