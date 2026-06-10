# RuleKitX

> Composable AI Engineering Governance System with `/rulekitx-*` commands and bulletproof LLM injection.

RuleKitX is a lightweight, global engineering governance layer for AI coding agents. It installs once and gives every AI tool you use—**OpenCode**, **Claude Code**, **VS Code**, **Cursor**, **JetBrains**—the same set of `/rulekitx-*` slash-command skills and a strict, XML-wrapped system prompt that forces models to follow your engineering rules.

---

## 3-Layer Memory Architecture

RuleKitX is organized so that **only the rules relevant to your prompt are loaded** — your context window (and token budget) stays lean.

| Layer | What it is | When it loads |
|---|---|---|
| **Layer 1 — Core Memory** | A small, always-on reasoning + safety kernel (`core.md`). | Always. |
| **Layer 2 — Domain Skills** | Focused skills (api, architect, premium-ui, ...). Each owns ONE concern. | On demand — only when the prompt is relevant to that skill. |
| **Layer 3 — Project Memory** | Project-scoped context: stack, architecture, conventions, business rules (`.rulekitx/project-memory.md`). | Always, for that project. Auto-detected from your repo, then you fill in the rest. |

### How each tool loads the layers

- **Cursor:** `core` + `project-memory` are written as `.mdc` rules with `alwaysApply: true`; each domain skill is an "Agent Requested" `.mdc` (description only) so Cursor pulls it in only when relevant.
- **OpenCode / Claude Code:** domain skills are agent-requested `SKILL.md` files; Core (and Project Memory, locally) are injected as a managed block into the always-loaded instruction file (`CLAUDE.md` / `AGENTS.md`) between `<!-- RULEKITX:START -->` / `<!-- RULEKITX:END -->` markers.
- **VS Code / JetBrains / Neovim (fallback):** no always-on hook exists, so skills are available as `/rulekitx-*` snippets / live-templates plus the `rulekitx compose` command. Missing tools are skipped silently.

## Key Features

- **Only relevant rules activate:** layered delivery means UI rules load for UI tasks, API rules for API tasks — not everything, everywhere.
- **One install, every agent:** Skills auto-register with OpenCode, Claude Code, Cursor, and the generic `~/.agents/skills/` directory.
- **Project Memory:** `rulekitx init --local` auto-detects your stack and scaffolds `.rulekitx/project-memory.md` so the assistant stops guessing your conventions.
- **Composable:** Combine multiple skills in one prompt: `/rulekitx-architect /rulekitx-reviewer build a new auth flow`.
- **Safe fallbacks:** if a tool isn't installed, RuleKitX skips it silently — never creating stray config.
- **Always in sync:** Adding, removing, or editing a skill in `templates/` automatically syncs across all IDEs and agents.

---

## Quick Start

```bash
# 1. Install globally (auto-initializes ~/.rulekitx/)
npm install -g rulekitx

# 2. Try a skill (returns composed XML-wrapped context)
rulekitx compose "/rulekitx-architect build a new feature"
```

To use project-specific rules and enable native Cursor auto-read:
```bash
# Initialize inside your project directory
rulekitx init --local
```

---

## Available Skills (Layer 2)

Each skill owns exactly one concern and declares its own Scope / Out of Scope so they don't overlap.

| Command | Category | Concern |
|---|---|---|
| `/rulekitx` | core | The always-on Layer 1 kernel |
| `/rulekitx-architect` | engineering | System structure, grounded in the existing codebase |
| `/rulekitx-reviewer` | engineering | Read-only production-risk review (never rewrites code) |
| `/rulekitx-refactor` | engineering | Structure changes without behavior changes |
| `/rulekitx-safe-feature` | engineering | Feature **planning + safety** (contract, callers, rollback) |
| `/rulekitx-exec-complete` | execution | **Implementation/runtime** discipline (errors, config, logging) |
| `/rulekitx-premium-ui` | design | Accessible, production UI (respects the project design system) |
| `/rulekitx-redesign` | design | Evolve existing UI without breaking user workflows |
| `/rulekitx-api` | standards | HTTP API design and contracts |
| `/rulekitx-testing` | standards | Behavior-first test structure and naming |

`safe-feature` plans a change; `exec-complete` implements it. `reviewer` finds issues; `refactor` fixes structure. `architect` owns system shape; `redesign` owns UI evolution. Core's safety/security baseline is inherited by all, never duplicated.

---

## How It Works

1. **Templates:** Rules are Markdown files with YAML frontmatter under `templates/` (core + skills), scanned dynamically by `src/scanner.ts`.
2. **Scaffolding:** `rulekitx init` copies templates to `~/.rulekitx/` (global) or `./.rulekitx/` (local). `--local` also generates Layer 3 Project Memory and the layered `.cursor/rules/*.mdc`.
3. **Syncing:** `rulekitx install-ide` registers native skills for OpenCode/Claude, injects the always-on core block into their instruction files, and adds autocomplete snippets for VS Code, Cursor, and JetBrains.
4. **Custom Skills:** You can author your own project-specific skills by placing markdown files with `name`/`description` frontmatter into your `.rulekitx/skills/` directory and running `rulekitx install-ide`.

---

## CLI Reference

| Command | Description |
|---|---|
| `rulekitx init` | Scaffold `~/.rulekitx/` (use `--local` for project-level + Project Memory) |
| `rulekitx memory` | Generate/refresh `.rulekitx/project-memory.md` from the detected stack (`--force` to overwrite) |
| `rulekitx install-ide` | Re-sync IDE snippets and agent skills globally |
| `rulekitx uninstall` | Remove all RuleKitX files, snippets, and lock entries |
| `rulekitx list` | List all available `/rulekitx-*` skills |
| `rulekitx parse "<prompt>"` | Show which skills a prompt invokes |
| `rulekitx compose "<prompt>"` | Output the full XML-wrapped prompt context |
| `rulekitx doctor` | Check RuleKitX installation health and configured layers |
| `rulekitx completions` | Output commands as JSON for IDE extension consumption |

---
