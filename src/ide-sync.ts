// src/ide-sync.ts
// Generates global snippets for VS Code, Cursor, and JetBrains

import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import { createHash } from "crypto";
import {
  getCompletionItems,
  loadCore,
  loadSkill,
  resolveSkills,
} from "./loader.js";
import { resolveRulekitDir } from "./global-resolver.js";
import { upsertBlockInFile } from "./managed-block.js";

/**
 * Builds the body for a single skill's SKILL.md. Core (`/rulekit`) returns the
 * core content; every other command returns ONLY that skill's content. Core is
 * no longer embedded into each skill — it is delivered as its own always-on
 * layer — which keeps each skill self-contained and removes large duplication.
 */
async function composeSkillBody(
  rootDir: string,
  command: string,
): Promise<string> {
  if (command === "/rulekitx") {
    return loadCore(rootDir);
  }
  const skillName = command.replace(/^\/rulekitx-/, "");
  const { found } = await resolveSkills(rootDir, [skillName]);
  if (found.length > 0) {
    return loadSkill(rootDir, found[0]);
  }
  return `You are executing the **${command}** skill via RuleKit. Refer to ${rootDir} for rules.`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Hidden marker file placed in each skill dir we own. Used to safely prune
 *  stale rulekit skills without touching user-created skills that happen to
 *  share the `rulekit-` prefix. */
const OWNERSHIP_MARKER = ".rulekit-owned";

async function markSkillOwned(skillDir: string): Promise<void> {
  await fs.writeFile(path.join(skillDir, OWNERSHIP_MARKER), "", "utf-8");
}

async function isSkillOwned(skillDir: string): Promise<boolean> {
  return fileExists(path.join(skillDir, OWNERSHIP_MARKER));
}

/** Builds a SKILL.md file body that matches the format consumed by the
 *  opencode/`npx skills` skill loader (`name` + `description` in YAML
 *  frontmatter, plus a `# /<command>` heading for IDE display). */
function buildSkillMd(
  command: string,
  description: string,
  body: string,
): string {
  const escapedDesc = description.replace(/"/g, '\\"');
  const trimmedBody = body.trimStart();
  const heading = `# /${command}\n\n`;
  return `---
name: ${command}
description: "${escapedDesc}"
argument-hint: "[task]"
---

${heading}${trimmedBody}`;
}

/** Recursively collects all files under `currentDir` into `results` for
 *  hashing, skipping VCS / dependency dirs. */
async function collectFilesForHash(
  baseDir: string,
  currentDir: string,
  results: { relativePath: string; content: Buffer }[],
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await collectFilesForHash(baseDir, fullPath, results);
    } else if (entry.isFile()) {
      const content = await fs.readFile(fullPath);
      const relativePath = path
        .relative(baseDir, fullPath)
        .split(path.sep)
        .join("/");
      results.push({ relativePath, content });
    }
  }
}

/** SHA-256 of a skill folder, matching the algorithm used by the
 *  `npx skills` CLI so lock-file entries stay compatible. */
async function computeSkillFolderHash(skillDir: string): Promise<string> {
  const files: { relativePath: string; content: Buffer }[] = [];
  await collectFilesForHash(skillDir, skillDir, files);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.relativePath);
    hash.update(file.content);
  }
  return hash.digest("hex");
}

interface SkillLockEntry {
  source: string;
  sourceType: string;
  sourceUrl?: string;
  ref?: string;
  skillPath?: string;
  skillFolderHash: string;
  installedAt: string;
  updatedAt: string;
  pluginName?: string;
}

interface SkillLockFile {
  version: number;
  skills: Record<string, SkillLockEntry>;
  dismissed?: Record<string, boolean>;
  lastSelectedAgents?: string[];
}

const LOCK_FILE_NAME = ".skill-lock.json";
const LOCK_VERSION = 3;

async function readSkillLock(lockFilePath: string): Promise<SkillLockFile> {
  try {
    const content = await fs.readFile(lockFilePath, "utf-8");
    const parsed = JSON.parse(content);
    if (typeof parsed.version !== "number" || !parsed.skills) {
      return { version: LOCK_VERSION, skills: {} };
    }
    return parsed as SkillLockFile;
  } catch {
    return { version: LOCK_VERSION, skills: {} };
  }
}

async function writeSkillLock(
  lockFilePath: string,
  lock: SkillLockFile,
): Promise<void> {
  // Mirror the `npx skills` writeLocalLock sort: skill names alphabetical
  // for stable diffs across runs.
  const sortedSkills: Record<string, SkillLockEntry> = {};
  for (const key of Object.keys(lock.skills).sort()) {
    sortedSkills[key] = lock.skills[key];
  }
  const sorted: any = { version: lock.version, skills: sortedSkills };
  if (lock.dismissed) sorted.dismissed = lock.dismissed;
  if (lock.lastSelectedAgents) sorted.lastSelectedAgents = lock.lastSelectedAgents;
  await fs.mkdir(path.dirname(lockFilePath), { recursive: true });
  await fs.writeFile(
    lockFilePath,
    JSON.stringify(sorted, null, 2) + "\n",
    "utf-8",
  );
}

/** Adds or refreshes RuleKit skill entries in the agent's lock file
 *  (e.g. `~/.agents/.skill-lock.json` or `~/.config/opencode/.skill-lock.json`)
 *  so the opencode/`npx skills` skill picker shows them. Existing non-rulekit
 *  entries are preserved. */
export async function updateAgentSkillLock(
  lockFilePath: string,
  rulekitRoot: string,
  skillsDir: string,
  items: { command: string; description: string }[],
): Promise<{ updated: string[]; errors: string[] }> {
  const results = { updated: [] as string[], errors: [] as string[] };
  const lock = await readSkillLock(lockFilePath);
  const now = new Date().toISOString();
  const source = rulekitRoot;
  const sourceType = "local";

  for (const item of items) {
  const commandName = item.command.replace(/^\//, "");
  const skillDir = path.join(skillsDir, commandName);

  let hash = "";
  try {
    hash = await computeSkillFolderHash(skillDir);
  } catch (err: any) {
    results.errors.push(
      `Failed to hash ${skillDir}: ${err.message}`,
    );
    continue;
  }

  // skillPath is relative to the lock file's parent dir (where the
  // skills/ subdir lives), e.g. "skills/rulekitx-architect/SKILL.md".
  const skillPath = path
    .relative(path.dirname(lockFilePath), path.join(skillDir, "SKILL.md"))
    .split(path.sep)
    .join("/");

    const existing = lock.skills[commandName];
    lock.skills[commandName] = {
      source,
      sourceType,
      skillPath,
      skillFolderHash: hash,
      installedAt: existing?.installedAt ?? now,
      updatedAt: now,
    };
    results.updated.push(commandName);
  }

  try {
    await writeSkillLock(lockFilePath, lock);
  } catch (err: any) {
    results.errors.push(
      `Failed to write lock file ${lockFilePath}: ${err.message}`,
    );
  }

  return results;
}

/** Removes any rulekit-owned subdirectory of `skillsDir` whose name is not
 *  in `currentNames`. Returns the list of removed directory paths. */
async function pruneStaleSkills(
  skillsDir: string,
  currentNames: Set<string>,
): Promise<string[]> {
  const removed: string[] = [];
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(skillsDir, { withFileTypes: true });
  } catch {
    return removed;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (currentNames.has(entry.name)) continue;

    const skillDir = path.join(skillsDir, entry.name);
    if (!(await isSkillOwned(skillDir))) continue;

    try {
      await fs.rm(skillDir, { recursive: true, force: true });
      removed.push(skillDir);
    } catch {
      // best-effort cleanup
    }
  }

  return removed;
}

export async function syncIdeSnippets(
  rootDir?: string,
): Promise<{ created: string[]; skipped: string[]; errors: string[] }> {
  if (!rootDir) {
    try {
      rootDir = await resolveRulekitDir();
    } catch {
      // If we cannot resolve it, we cannot sync
      return {
        created: [],
        skipped: [],
        errors: [
          'RuleKit directory not found. Please run "rulekitx init" first.',
        ],
      };
    }
  }

  const items = await getCompletionItems(rootDir);
  const results = {
    created: [] as string[],
    skipped: [] as string[],
    errors: [] as string[],
  };

  // 1. Generate VS Code Snippets JSON
  const vsCodeSnippets: Record<string, any> = {};
  for (const item of items) {
    vsCodeSnippets[`RuleKitX: ${item.command}`] = {
      prefix: item.command,
      body: [item.command],
      description: item.description,
    };
  }
  const vsCodeJson = JSON.stringify(vsCodeSnippets, null, 2);

  // 2. Generate JetBrains Live Templates XML
  let jbXml = `<templateSet group="RuleKitX">\n`;
  for (const item of items) {
    const escapedDesc = item.description
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    jbXml += `  <template name="${item.command}" value="${item.command}" description="${escapedDesc}" toReformat="false" toShortenFQNames="true">\n`;
    jbXml += `    <context>\n`;
    jbXml += `      <option name="OTHER" value="true" />\n`;
    jbXml += `    </context>\n`;
    jbXml += `  </template>\n`;
  }
  jbXml += `</templateSet>`;

  // 3. Resolve Paths
  const homedir = os.homedir();
  const platform = os.platform();

  // VS Code / Cursor paths
  const vscodePaths: string[] = [];

  if (platform === "win32") {
    const appdata =
      process.env.APPDATA || path.join(homedir, "AppData", "Roaming");
    vscodePaths.push(path.join(appdata, "Code", "User", "snippets"));
    vscodePaths.push(path.join(appdata, "Cursor", "User", "snippets"));
  } else if (platform === "darwin") {
    const appSupport = path.join(homedir, "Library", "Application Support");
    vscodePaths.push(path.join(appSupport, "Code", "User", "snippets"));
    vscodePaths.push(path.join(appSupport, "Cursor", "User", "snippets"));
  } else {
    // Linux
    const config = process.env.XDG_CONFIG_HOME || path.join(homedir, ".config");
    vscodePaths.push(path.join(config, "Code", "User", "snippets"));
    vscodePaths.push(path.join(config, "Cursor", "User", "snippets"));
  }

  // Inject VS Code / Cursor
  for (const snipDir of vscodePaths) {
    if (await fileExists(snipDir)) {
      try {
        const targetFile = path.join(snipDir, "rulekit.code-snippets");
        await fs.writeFile(targetFile, vsCodeJson, "utf-8");
        results.created.push(targetFile);
      } catch (err: any) {
        results.errors.push(`Failed to write to ${snipDir}: ${err.message}`);
      }
    } else {
      results.skipped.push(snipDir);
    }
  }

  // JetBrains paths
  let jbBaseDir = "";
  if (platform === "win32") {
    // On windows JetBrains configs are usually directly in APPDATA or LocalAppData
    // Since ~2020.1 they are in %APPDATA%\JetBrains
    jbBaseDir = path.join(
      process.env.APPDATA || path.join(homedir, "AppData", "Roaming"),
      "JetBrains",
    );
  } else if (platform === "darwin") {
    jbBaseDir = path.join(
      homedir,
      "Library",
      "Application Support",
      "JetBrains",
    );
  } else {
    jbBaseDir = path.join(
      process.env.XDG_CONFIG_HOME || path.join(homedir, ".config"),
      "JetBrains",
    );
  }

  if (await fileExists(jbBaseDir)) {
    try {
      const jbDirs = await fs.readdir(jbBaseDir, { withFileTypes: true });
      for (const dir of jbDirs) {
        if (
          dir.isDirectory() &&
          (dir.name.includes("WebStorm") ||
            dir.name.includes("IntelliJ") ||
            dir.name.includes("PhpStorm") ||
            dir.name.includes("PyCharm") ||
            dir.name.includes("GoLand") ||
            dir.name.includes("Rider") ||
            dir.name.includes("CLion") ||
            dir.name.includes("RubyMine"))
        ) {
          const templatesDir = path.join(jbBaseDir, dir.name, "templates");
          try {
            await fs.mkdir(templatesDir, { recursive: true });
            const targetFile = path.join(templatesDir, "rulekit.xml");
            await fs.writeFile(targetFile, jbXml, "utf-8");
            results.created.push(targetFile);
          } catch (err: any) {
            results.errors.push(
              `Failed to write to ${templatesDir}: ${err.message}`,
            );
          }
        }
      }
    } catch (err: any) {
      results.errors.push(`Failed to read JetBrains directory: ${err.message}`);
    }
  } else {
    results.skipped.push(jbBaseDir);
  }

  // Generate generic rulekit-snippets.json in ~/.rulekit/ for Neovim users
  try {
    const genericFile = path.join(rootDir, "rulekit-snippets.json");
    await fs.writeFile(genericFile, vsCodeJson, "utf-8");
    results.created.push(genericFile);
  } catch (err: any) {
    results.errors.push(
      `Failed to write generic snippets to ${rootDir}: ${err.message}`,
    );
  }

  // 4. Generate native AI Skills for IDE Chat
  const agentsDir = path.join(homedir, ".agents", "skills");
  let agentsDirExists = await fileExists(agentsDir);
  if (!agentsDirExists) {
    try {
      await fs.mkdir(agentsDir, { recursive: true });
      agentsDirExists = true;
    } catch (err: any) {
      results.errors.push(
        `Failed to create agents directory ${agentsDir}: ${err.message}`,
      );
    }
  }

  if (agentsDirExists) {
    const currentNames = new Set(
      items.map((item) => item.command.replace(/^\//, "")),
    );

    for (const item of items) {
      const commandName = item.command.replace(/^\//, ""); // e.g. "rulekit" or "rulekit-architect"
      const skillDir = path.join(agentsDir, commandName);

      try {
        await fs.mkdir(skillDir, { recursive: true });
        const targetFile = path.join(skillDir, "SKILL.md");

        let body = "";
        try {
          body = await composeSkillBody(rootDir, item.command);
        } catch {
          body = `You are executing the **${item.command}** skill via RuleKit. Please refer to ${rootDir} for rules.`;
        }

        const mdContent = buildSkillMd(commandName, item.description, body);

        await fs.writeFile(targetFile, mdContent, "utf-8");
        await markSkillOwned(skillDir);
        results.created.push(targetFile);
      } catch (err: any) {
        results.errors.push(
          `Failed to write native skill ${commandName}: ${err.message}`,
        );
      }
    }

    // Prune stale rulekit-owned skills
    const removed = await pruneStaleSkills(agentsDir, currentNames);
    if (!("removed" in results)) {
      (results as any).removed = [] as string[];
    }
    (results as any).removed.push(...removed);

    // Register the skills in the global ~/.agents/.skill-lock.json so the
    // opencode / `npx skills` picker / autocomplete can discover them.
    const lockFilePath = path.join(agentsDir, "..", LOCK_FILE_NAME);
    const lockResult = await updateAgentSkillLock(
      lockFilePath,
      rootDir,
      agentsDir,
      items,
    );
    (results as any).errors.push(...lockResult.errors);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// AGENT CONFIGS — OpenCode (~/.config/opencode) & Claude (~/.claude)
// ═══════════════════════════════════════════════════════════════

interface AgentConfigTarget {
  /** Base config directory to detect (e.g. ~/.config/opencode) */
  baseDir: string;
  /** Subdirectory inside baseDir where skills live (e.g. "skills") */
  skillsSubdir: string;
  /** Human-readable label for logging */
  label: string;
  /** Always-loaded instruction file to inject the core block into. */
  alwaysOnFile: string;
}

/**
 * Detects known AI agent config directories (OpenCode, Claude) and injects
 * RuleKit skills into them. If the base config dir does not exist on disk,
 * the target is silently skipped — the user simply doesn't have that tool
 * installed, and we don't want to create empty stub directories.
 *
 * Skills previously written by RuleKit that no longer correspond to a
 * current rulekit template are removed (pruned) so the agent's skill list
 * stays in sync with the installed rulekit version.
 */
export async function syncAgentConfigs(
  rootDir?: string,
): Promise<{
  created: string[];
  removed: string[];
  skipped: string[];
  errors: string[];
}> {
  if (!rootDir) {
    try {
      rootDir = await resolveRulekitDir();
    } catch {
      return {
        created: [],
        removed: [],
        skipped: [],
        errors: [
          'RuleKit directory not found. Please run "rulekitx init" first.',
        ],
      };
    }
  }

  const items = await getCompletionItems(rootDir);
  const homedir = os.homedir();

  // Known agent config locations. All use homedir-relative paths so they
  // resolve identically on Linux, macOS, and Windows.
  const targets: AgentConfigTarget[] = [
    {
      baseDir: path.join(homedir, ".config", "opencode"),
      skillsSubdir: "skills",
      label: "OpenCode",
      alwaysOnFile: path.join(homedir, ".config", "opencode", "AGENTS.md"),
    },
    {
      baseDir: path.join(homedir, ".claude"),
      skillsSubdir: "skills",
      label: "Claude",
      alwaysOnFile: path.join(homedir, ".claude", "CLAUDE.md"),
    },
  ];

  // Global always-on core block injected into each agent's always-loaded file.
  let coreBlockBody = "";
  try {
    coreBlockBody = [
      "# RuleKitX — always-on core (managed, do not edit between markers)",
      "",
      await loadCore(rootDir),
    ].join("\n");
  } catch {
    coreBlockBody = "";
  }

  const results = {
    created: [] as string[],
    removed: [] as string[],
    skipped: [] as string[],
    errors: [] as string[],
  };

  const currentNames = new Set(
    items.map((item) => item.command.replace(/^\//, "")),
  );

  for (const target of targets) {
    // Silent skip when the tool's base config dir is not present
    if (!(await fileExists(target.baseDir))) {
      results.skipped.push(target.baseDir);
      continue;
    }

    // Inject the always-on core block into the agent's always-loaded file.
    if (coreBlockBody) {
      try {
        await upsertBlockInFile(target.alwaysOnFile, coreBlockBody, true);
        results.created.push(target.alwaysOnFile);
      } catch (err: any) {
        results.errors.push(
          `Failed to update ${target.alwaysOnFile}: ${err.message}`,
        );
      }
    }

    const skillsDir = path.join(target.baseDir, target.skillsSubdir);
    try {
      await fs.mkdir(skillsDir, { recursive: true });
    } catch (err: any) {
      results.errors.push(
        `Failed to create ${skillsDir}: ${err.message}`,
      );
      continue;
    }

    for (const item of items) {
      const commandName = item.command.replace(/^\//, "");
      const skillDir = path.join(skillsDir, commandName);

      try {
        await fs.mkdir(skillDir, { recursive: true });
        const targetFile = path.join(skillDir, "SKILL.md");

        let body = "";
        try {
          body = await composeSkillBody(rootDir, item.command);
        } catch {
          body = `You are executing the **${item.command}** skill via RuleKit. Please refer to ${rootDir} for rules.`;
        }

        const mdContent = buildSkillMd(commandName, item.description, body);

        await fs.writeFile(targetFile, mdContent, "utf-8");
        await markSkillOwned(skillDir);
        results.created.push(targetFile);
      } catch (err: any) {
        results.errors.push(
          `Failed to write ${target.label} skill ${item.command}: ${err.message}`,
        );
      }
    }

    // Prune stale rulekit-owned skills that are no longer in the manifest
    const removed = await pruneStaleSkills(skillsDir, currentNames);
    results.removed.push(...removed);

    // For OpenCode, also register the skills in its lock file so the
    // picker / autocomplete discovers them. Claude does not use a lock
    // file in the same way, so it's skipped here.
    if (target.label === "OpenCode") {
      const lockFilePath = path.join(target.baseDir, LOCK_FILE_NAME);
      const lockResult = await updateAgentSkillLock(
        lockFilePath,
        rootDir,
        skillsDir,
        items,
      );
      results.errors.push(...lockResult.errors);
    }
  }

  return results;
}
