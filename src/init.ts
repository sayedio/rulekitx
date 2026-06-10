// src/init.ts
// Scaffolds a new RuleKit installation — globally or locally

import * as fs from 'fs/promises';
import * as path from 'path';
import { InitResult } from './types.js';
import { getTemplateManifest } from './scanner.js';
import { getGlobalRulekitDir, getLocalRulekitDir } from './global-resolver.js';
import { syncIdeSnippets, syncAgentConfigs } from './ide-sync.js';
import { extractSkillDescription, stripFrontmatter } from './loader.js';
import { generateProjectMemory } from './project-memory.js';
import { upsertBlockInFile } from './managed-block.js';

/** Filename for the always-on Layer 3 project memory file. */
const PROJECT_MEMORY_FILE = 'project-memory.md';

/**
 * Builds a Cursor `.mdc` file. The frontmatter type controls how Cursor loads
 * the rule:
 *  - alwaysApply: true            → always-on (Layer 1 core, Layer 3 memory)
 *  - description only (no globs)  → Agent Requested; loaded only when relevant
 */
export function buildMdc(opts: {
  description: string;
  body: string;
  alwaysApply: boolean;
}): string {
  const front = opts.alwaysApply
    ? `---\ndescription: ${opts.description}\nalwaysApply: true\n---`
    : `---\ndescription: ${opts.description}\n---`;
  return `${front}\n\n${opts.body.trim()}\n`;
}

export interface InitOptions {
  /** If true, initialize in the local project directory (.rulekit/) instead of global (~/.rulekit/) */
  local?: boolean;
  /** Override the project directory for local init. Defaults to process.cwd(). */
  projectDir?: string;
}

/**
 * Initializes a new RuleKit installation.
 * 
 * By default, installs to the global directory: ~/.rulekit/
 * With --local flag, installs to the project directory: .rulekit/
 */
export async function initRuleKit(options: InitOptions = {}): Promise<InitResult> {
  const rulekitDir = options.local 
    ? getLocalRulekitDir(options.projectDir)
    : getGlobalRulekitDir();
  
  let alreadyExisted = false;
  try {
    const stats = await fs.stat(rulekitDir);
    if (stats.isDirectory()) {
      alreadyExisted = true;
    }
  } catch {
    // Directory doesn't exist, which is what we want
  }

  // Ensure root rulekit directory exists
  await fs.mkdir(rulekitDir, { recursive: true });

  const templates = await getTemplateManifest();
  const createdFiles: string[] = [];
  const ownedPaths = new Set(templates.map((t) => t.relativePath));

  for (const template of templates) {
    const fullPath = path.join(rulekitDir, template.relativePath);
    const dirName = path.dirname(fullPath);

    // Ensure the subdirectory exists (e.g. skills/engineering/)
    await fs.mkdir(dirName, { recursive: true });

    // Write the template content
    await fs.writeFile(fullPath, template.content, 'utf-8');
    createdFiles.push(template.relativePath);
  }

  // ─────────────────────────────────────────────────────────────
  // Local initialization: generate the 3-layer project delivery.
  //   Layer 1 (core)          → .cursor/rules/rulekit-core.mdc (alwaysApply)
  //   Layer 2 (domain skills) → .cursor/rules/rulekit-<skill>.mdc (Agent Requested)
  //   Layer 3 (project memory)→ .rulekit/project-memory.md + alwaysApply .mdc
  // Plus a managed block (core + memory) in project CLAUDE.md / AGENTS.md.
  // ─────────────────────────────────────────────────────────────
  if (options.local) {
    const projectDir = options.projectDir ?? process.cwd();
    const coreTemplate = templates.find((t) => t.relativePath === 'core.md');
    const coreBody = coreTemplate ? stripFrontmatter(coreTemplate.content) : '';

    // Layer 3: project memory file (auto-detected + placeholders), generated
    // only when it does not already exist so user edits are preserved.
    const memoryPath = path.join(rulekitDir, PROJECT_MEMORY_FILE);
    let memoryBody = '';
    try {
      const existing = await fs.readFile(memoryPath, 'utf-8');
      memoryBody = stripFrontmatter(existing);
    } catch {
      try {
        const generated = await generateProjectMemory(projectDir);
        await fs.writeFile(memoryPath, generated, 'utf-8');
        createdFiles.push(PROJECT_MEMORY_FILE);
        memoryBody = stripFrontmatter(generated);
      } catch {
        // Detection failed — continue without a memory file.
      }
    }

    // Cursor rules: branch frontmatter by layer.
    const cursorRulesDir = path.join(projectDir, '.cursor', 'rules');
    try {
      await fs.mkdir(cursorRulesDir, { recursive: true });

      for (const template of templates) {
        const baseName = path.basename(template.relativePath, '.md');
        const mdcPath = path.join(cursorRulesDir, `rulekitx-${baseName}.mdc`);
        const description =
          extractSkillDescription(template.content) ?? `RuleKitX rule: ${baseName}`;

        const mdcContent = buildMdc({
          description,
          body: stripFrontmatter(template.content),
          alwaysApply: baseName === 'core',
        });

        await fs.writeFile(mdcPath, mdcContent, 'utf-8');
        createdFiles.push(path.join('.cursor', 'rules', `rulekitx-${baseName}.mdc`));
      }

      // Layer 3 always-on rule for Cursor.
      if (memoryBody) {
        const memMdcPath = path.join(cursorRulesDir, 'rulekitx-project-memory.mdc');
        await fs.writeFile(
          memMdcPath,
          buildMdc({
            description: 'Project-scoped memory: stack, architecture, conventions, business rules.',
            body: memoryBody,
            alwaysApply: true,
          }),
          'utf-8',
        );
        createdFiles.push(path.join('.cursor', 'rules', 'rulekitx-project-memory.mdc'));
      }
    } catch {
      // Ignore local cursor rules generation errors
    }

    // Managed always-on block (core + project memory) for agent CLI files.
    // These files are always loaded by Claude Code / OpenCode, so the block
    // gives those tools an always-on Layer 1 + Layer 3 even without Cursor.
    const blockBody = [
      '# RuleKitX — always-on rules (managed, do not edit between markers)',
      '',
      coreBody,
      memoryBody ? `\n---\n\n${memoryBody}` : '',
    ].join('\n');

    for (const agentFile of ['CLAUDE.md', 'AGENTS.md']) {
      try {
        await upsertBlockInFile(path.join(projectDir, agentFile), blockBody, true);
        createdFiles.push(agentFile);
      } catch {
        // best-effort
      }
    }
  }

  // Prune stale .md files in directories we own that are no longer in the
  // template manifest. This keeps ~/.rulekit/ in sync with the current
  // source-of-truth when templates are removed between releases.
  const removedFiles = await pruneStaleRulekitFiles(rulekitDir, ownedPaths);

  // Try to sync IDE snippets globally (fail silently if it fails, as this is an enhancement)
  try {
    await syncIdeSnippets(rulekitDir);
  } catch {
    // Ignore IDE sync errors during init
  }

  // Try to sync into known AI agent config dirs (OpenCode, Claude).
  // Silently skipped when those tools aren't installed.
  try {
    await syncAgentConfigs(rulekitDir);
  } catch {
    // Ignore agent config sync errors during init
  }

  return {
    rootDir: rulekitDir,
    createdFiles,
    removedFiles,
    alreadyExisted
  };
}

/**
 * Removes any .md file under `skills/` or `standards/` in `rulekitDir`
 * whose relative path is not in `ownedPaths`. This keeps the installed
 * rulekit dir clean when templates are removed.
 */
async function pruneStaleRulekitFiles(
  rulekitDir: string,
  ownedPaths: Set<string>,
): Promise<string[]> {
  const removed: string[] = [];
  const ownedSubdirs = ["skills", "standards"];

  for (const subdir of ownedSubdirs) {
    const baseDir = path.join(rulekitDir, subdir);
    let categories;
    try {
      categories = await fs.readdir(baseDir, { withFileTypes: true });
    } catch {
      continue;
    }
    if (!Array.isArray(categories)) continue;

    for (const cat of categories) {
      if (!cat.isDirectory()) continue;
      const catDir = path.join(baseDir, cat.name);
      let files;
      try {
        files = await fs.readdir(catDir);
      } catch {
        continue;
      }
      if (!Array.isArray(files)) continue;

      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        // Use posix-style separators so paths match the template manifest
        // on Windows (where path.join uses backslashes).
        const relPath = path.posix.join(subdir, cat.name, file);
        if (ownedPaths.has(relPath)) continue;

        try {
          await fs.unlink(path.join(catDir, file));
          removed.push(relPath);
        } catch {
          // best-effort cleanup
        }
      }
    }
  }

  return removed;
}
