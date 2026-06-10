// src/project-memory.ts
// Layer 3 — Project Memory. Detects the project's stack/tooling from the
// repo and builds a project-scoped memory file with the detected context
// filled in and clearly-marked placeholders for the rest.

import * as fs from "fs/promises";
import * as path from "path";

export interface DetectedContext {
  /** Detected language(s), e.g. ["TypeScript", "JavaScript"] */
  languages: string[];
  /** Detected package manager (npm/pnpm/yarn/bun) or undefined */
  packageManager?: string;
  /** Detected frameworks/runtimes, e.g. ["Next.js", "React"] */
  frameworks: string[];
  /** Detected styling/UI libraries, e.g. ["Tailwind CSS", "Flowbite"] */
  styling: string[];
  /** Detected data/state libraries, e.g. ["React Query", "Zustand"] */
  dataState: string[];
  /** Detected auth/payment/backend services, e.g. ["Firebase", "Stripe"] */
  services: string[];
  /** Detected testing tools, e.g. ["Vitest", "Playwright"] */
  testing: string[];
  /** True if a monorepo workspace setup was detected */
  monorepo: boolean;
}

/** Maps a dependency name to a human-readable label, grouped by category. */
const DEP_MAP: Record<string, { label: string; group: keyof DetectedContext }> = {
  // Frameworks / runtimes
  next: { label: "Next.js", group: "frameworks" },
  react: { label: "React", group: "frameworks" },
  "react-dom": { label: "React", group: "frameworks" },
  vue: { label: "Vue", group: "frameworks" },
  svelte: { label: "Svelte", group: "frameworks" },
  "@angular/core": { label: "Angular", group: "frameworks" },
  express: { label: "Express", group: "frameworks" },
  fastify: { label: "Fastify", group: "frameworks" },
  "@nestjs/core": { label: "NestJS", group: "frameworks" },
  "react-native": { label: "React Native", group: "frameworks" },
  astro: { label: "Astro", group: "frameworks" },
  // Styling / UI
  tailwindcss: { label: "Tailwind CSS", group: "styling" },
  "styled-components": { label: "styled-components", group: "styling" },
  "@mui/material": { label: "Material UI", group: "styling" },
  "@chakra-ui/react": { label: "Chakra UI", group: "styling" },
  flowbite: { label: "Flowbite", group: "styling" },
  "flowbite-react": { label: "Flowbite", group: "styling" },
  bootstrap: { label: "Bootstrap", group: "styling" },
  // Data / state
  "@tanstack/react-query": { label: "React Query", group: "dataState" },
  "react-query": { label: "React Query", group: "dataState" },
  redux: { label: "Redux", group: "dataState" },
  "@reduxjs/toolkit": { label: "Redux Toolkit", group: "dataState" },
  zustand: { label: "Zustand", group: "dataState" },
  swr: { label: "SWR", group: "dataState" },
  "@apollo/client": { label: "Apollo Client", group: "dataState" },
  // Services (auth/payments/backend)
  firebase: { label: "Firebase", group: "services" },
  "firebase-admin": { label: "Firebase Admin", group: "services" },
  "@supabase/supabase-js": { label: "Supabase", group: "services" },
  stripe: { label: "Stripe", group: "services" },
  "@stripe/stripe-js": { label: "Stripe", group: "services" },
  "next-auth": { label: "NextAuth", group: "services" },
  "@prisma/client": { label: "Prisma", group: "services" },
  mongoose: { label: "Mongoose", group: "services" },
  // Testing
  vitest: { label: "Vitest", group: "testing" },
  jest: { label: "Jest", group: "testing" },
  "@playwright/test": { label: "Playwright", group: "testing" },
  playwright: { label: "Playwright", group: "testing" },
  cypress: { label: "Cypress", group: "testing" },
  "@testing-library/react": { label: "Testing Library", group: "testing" },
  mocha: { label: "Mocha", group: "testing" },
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe(filePath: string): Promise<any | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch {
    return undefined;
  }
}

function pushUnique(arr: string[], value: string): void {
  if (!arr.includes(value)) arr.push(value);
}

/**
 * Inspects the project directory and infers stack/tooling. Best-effort:
 * anything it cannot detect is simply left out (and surfaced as a
 * placeholder in the generated memory file).
 */
export async function detectProjectContext(
  projectDir: string,
): Promise<DetectedContext> {
  const ctx: DetectedContext = {
    languages: [],
    frameworks: [],
    styling: [],
    dataState: [],
    services: [],
    testing: [],
    monorepo: false,
  };

  const pkg = await readJsonSafe(path.join(projectDir, "package.json"));
  if (pkg) {
    const deps: Record<string, string> = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    for (const name of Object.keys(deps)) {
      const mapping = DEP_MAP[name];
      if (mapping) {
        const target = ctx[mapping.group];
        if (Array.isArray(target)) pushUnique(target, mapping.label);
      }
      if (name === "typescript") pushUnique(ctx.languages, "TypeScript");
    }

    // Monorepo signals
    if (pkg.workspaces) ctx.monorepo = true;
  }

  // Package manager from lockfile
  if (await fileExists(path.join(projectDir, "pnpm-lock.yaml"))) {
    ctx.packageManager = "pnpm";
  } else if (await fileExists(path.join(projectDir, "yarn.lock"))) {
    ctx.packageManager = "yarn";
  } else if (await fileExists(path.join(projectDir, "bun.lockb"))) {
    ctx.packageManager = "bun";
  } else if (await fileExists(path.join(projectDir, "package-lock.json"))) {
    ctx.packageManager = "npm";
  }

  // TypeScript / JavaScript baseline
  if (await fileExists(path.join(projectDir, "tsconfig.json"))) {
    pushUnique(ctx.languages, "TypeScript");
  }
  if (pkg && ctx.languages.length === 0) {
    pushUnique(ctx.languages, "JavaScript");
  }

  // Monorepo tool signals
  if (
    (await fileExists(path.join(projectDir, "turbo.json"))) ||
    (await fileExists(path.join(projectDir, "nx.json"))) ||
    (await fileExists(path.join(projectDir, "pnpm-workspace.yaml")))
  ) {
    ctx.monorepo = true;
  }

  return ctx;
}

function renderList(items: string[], placeholder: string): string {
  if (items.length === 0) return `<!-- ${placeholder} -->`;
  return items.join(", ");
}

const FILL = "fill in";

/**
 * Builds the Project Memory markdown. Detected sections are pre-filled;
 * everything that needs human judgment is left as a clearly-marked
 * `<!-- fill in -->` placeholder.
 */
export function buildProjectMemory(ctx: DetectedContext): string {
  const detectedBits: string[] = [];
  if (ctx.languages.length) detectedBits.push(...ctx.languages);
  if (ctx.frameworks.length) detectedBits.push(...ctx.frameworks);
  const stackSummary =
    detectedBits.length > 0 ? detectedBits.join(" + ") : `<!-- ${FILL} -->`;

  return `---
name: project-memory
description: Project-scoped context for this repository — stack, architecture, conventions, and business rules. Always loaded alongside core for this project. Auto-generated by RuleKit; edit freely.
---

# Project Memory (Layer 3)

Real context for THIS project. Always loaded so the assistant stops guessing the
stack, inventing libraries, or breaking established conventions. RuleKit
pre-filled what it could detect; replace every \`<!-- ${FILL} -->\` with the truth.

> Stack summary: ${stackSummary}

---

## Stack

- **Language(s):** ${renderList(ctx.languages, FILL)}
- **Framework(s):** ${renderList(ctx.frameworks, FILL)}
- **Styling / UI:** ${renderList(ctx.styling, FILL)}
- **Data / state:** ${renderList(ctx.dataState, FILL)}
- **Services (auth / payments / backend):** ${renderList(ctx.services, FILL)}

## Tooling

- **Package manager:** ${ctx.packageManager ?? `<!-- ${FILL} -->`}
- **Testing:** ${renderList(ctx.testing, FILL)}
- **Monorepo:** ${ctx.monorepo ? "yes" : "no"}

---

## Architecture

<!-- ${FILL}: key architectural decisions, layering, folder structure, where logic lives -->

## API Conventions

<!-- ${FILL}: route patterns, auth on protected routes, response/error shape, naming -->

## UI Rules

<!-- ${FILL}: preferred component library, when to build custom, charts/icons, design tokens -->

## Business Rules

<!-- ${FILL}: domain rules that must always hold (e.g. payment must be verified before X) -->

## Conventions & Gotchas

<!-- ${FILL}: naming, commit style, things that have bitten the team before -->
`;
}

/**
 * Convenience: detect + build in one call.
 */
export async function generateProjectMemory(
  projectDir: string,
): Promise<string> {
  const ctx = await detectProjectContext(projectDir);
  return buildProjectMemory(ctx);
}
