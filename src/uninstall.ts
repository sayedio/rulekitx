// src/uninstall.ts
// Removes everything RuleKit wrote into the user's home directory and
// agent config dirs. Safe-by-default: only touches files/dirs that we
// own (identified by the .rulekit-owned marker, the `rulekit-` prefix,
// or the canonical filenames like rulekit.code-snippets).

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { getGlobalRulekitDir, getLocalRulekitDir } from "./global-resolver.js";
import { hasBlock, stripBlockFromFile } from "./managed-block.js";

export interface UninstallOptions {
  /** If true, uninstall from the local project directory instead of global. */
  local?: boolean;
  /** Override the project directory for local uninstall. Defaults to process.cwd(). */
  projectDir?: string;
}

export interface UninstallLockRemoval {
  lockFile: string;
  entries: string[];
}

export interface UninstallResult {
  /** The rulekit dir that was located (or attempted). */
  rulekitDir: string;
  /** Whether the rulekit dir was found on disk. */
  rulekitDirFound: boolean;
  /** Whether the rulekit dir was actually removed. */
  rulekitDirRemoved: boolean;
  /** Skill subdirs removed from each agent config dir. */
  removedSkillDirs: string[];
  /** IDE snippet / template files removed. */
  removedSnippetFiles: string[];
  /** Agent files (CLAUDE.md / AGENTS.md) the managed block was stripped from. */
  removedManagedBlocks: string[];
  /** Lock-file entries that were removed, grouped by lock file. */
  removedLockEntries: UninstallLockRemoval[];
  /** Non-fatal warnings (e.g. could not read a lock file). */
  warnings: string[];
  /** Hard errors encountered. */
  errors: string[];
}

const OWNERSHIP_MARKER = ".rulekit-owned";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/** Returns true if the given directory name was created by RuleKit
 *  (either the core `rulekit` or any `rulekitx-*` skill). */
function isRulekitOwnedName(name: string): boolean {
  return name === "rulekit" || name.startsWith("rulekitx-");
}

/** Removes all rulekit-owned subdirectories of `skillsDir`. */
async function removeRulekitSkillsFromDir(
  skillsDir: string,
): Promise<{ removed: string[]; errors: string[] }> {
  const removed: string[] = [];
  const errors: string[] = [];

  if (!(await directoryExists(skillsDir))) {
    return { removed, errors };
  }

  let entries;
  try {
    entries = await fs.readdir(skillsDir, { withFileTypes: true });
  } catch (err: any) {
    errors.push(`Failed to read ${skillsDir}: ${err.message}`);
    return { removed, errors };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!isRulekitOwnedName(entry.name)) continue;

    const skillDir = path.join(skillsDir, entry.name);
    // Only remove if we actually own it (marker present) or it follows our
    // naming convention. The marker check is an extra safety net in case
    // the user has a personal skill with a `rulekit-` prefix.
    if (!(await fileExists(path.join(skillDir, OWNERSHIP_MARKER)))) {
      continue;
    }

    try {
      await fs.rm(skillDir, { recursive: true, force: true });
      removed.push(skillDir);
    } catch (err: any) {
      errors.push(`Failed to remove ${skillDir}: ${err.message}`);
    }
  }

  return { removed, errors };
}

/** Removes IDE snippet / template files that RuleKit wrote. */
async function removeIdeSnippets(
  homedir: string,
  platform: NodeJS.Platform,
): Promise<{ removed: string[]; errors: string[] }> {
  const removed: string[] = [];
  const errors: string[] = [];

  const candidateFiles: string[] = [];

  // VS Code / Cursor snippets
  let configBase = "";
  if (platform === "win32") {
    const appdata =
      process.env.APPDATA || path.join(homedir, "AppData", "Roaming");
    configBase = appdata;
  } else if (platform === "darwin") {
    configBase = path.join(homedir, "Library", "Application Support");
  } else {
    configBase =
      process.env.XDG_CONFIG_HOME || path.join(homedir, ".config");
  }

  for (const ide of ["Code", "Cursor"]) {
    candidateFiles.push(path.join(configBase, ide, "User", "snippets", "rulekit.code-snippets"));
  }

  // JetBrains: walk every <ide>/templates/rulekit.xml
  const jbBase = path.join(configBase, "JetBrains");
  if (await directoryExists(jbBase)) {
    try {
      const dirs = await fs.readdir(jbBase, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          candidateFiles.push(
            path.join(jbBase, d.name, "templates", "rulekit.xml"),
          );
        }
      }
    } catch {
      // ignore
    }
  }

  // Rulekit-specific root file
  candidateFiles.push(path.join(homedir, ".rulekit", "rulekit-snippets.json"));

  for (const file of candidateFiles) {
    if (!(await fileExists(file))) continue;
    try {
      await fs.unlink(file);
      removed.push(file);
    } catch (err: any) {
      errors.push(`Failed to remove ${file}: ${err.message}`);
    }
  }

  return { removed, errors };
}

interface SkillLockFileShape {
  version?: number;
  skills?: Record<string, unknown>;
  dismissed?: Record<string, boolean>;
  lastSelectedAgents?: string[];
}

async function removeRulekitEntriesFromLock(
  lockFilePath: string,
): Promise<UninstallLockRemoval> {
  const result: UninstallLockRemoval = { lockFile: lockFilePath, entries: [] };
  if (!(await fileExists(lockFilePath))) return result;

  let lock: SkillLockFileShape;
  try {
    const content = await fs.readFile(lockFilePath, "utf-8");
    lock = JSON.parse(content);
  } catch {
    return result;
  }
  if (!lock.skills) return result;

  for (const key of Object.keys(lock.skills)) {
    if (isRulekitOwnedName(key)) {
      delete lock.skills[key];
      result.entries.push(key);
    }
  }

  if (result.entries.length === 0) return result;

  try {
    await fs.writeFile(
      lockFilePath,
      JSON.stringify(lock, null, 2) + "\n",
      "utf-8",
    );
  } catch {
    // best-effort
  }

  return result;
}

/** Returns the list of paths that WOULD be removed by an uninstall.
 *  Useful for the CLI confirmation prompt (and for tests). */
export async function previewUninstall(
  options: UninstallOptions = {},
): Promise<UninstallResult> {
  // Reuse the same logic as the real uninstall, but skip the destructive
  // step of actually deleting things. We do this by running the real
  // uninstall and then re-creating what we removed from the result.
  // Simpler: we expose a `dryRun: true` flag.
  return runUninstall(options, true);
}

export async function uninstallRuleKit(
  options: UninstallOptions = {},
): Promise<UninstallResult> {
  return runUninstall(options, false);
}

async function runUninstall(
  options: UninstallOptions,
  dryRun: boolean,
): Promise<UninstallResult> {
  const rulekitDir = options.local
    ? getLocalRulekitDir(options.projectDir)
    : getGlobalRulekitDir();

  const result: UninstallResult = {
    rulekitDir,
    rulekitDirFound: false,
    rulekitDirRemoved: false,
    removedSkillDirs: [],
    removedSnippetFiles: [],
    removedManagedBlocks: [],
    removedLockEntries: [],
    warnings: [],
    errors: [],
  };

  result.rulekitDirFound = await directoryExists(rulekitDir);

  const homedir = os.homedir();
  const platform = os.platform();

  // 1) Agent skill dirs
  const skillsDirs = [
    path.join(homedir, ".agents", "skills"),
    path.join(homedir, ".config", "opencode", "skills"),
    path.join(homedir, ".claude", "skills"),
  ];

  for (const dir of skillsDirs) {
    if (dryRun) {
      if (!(await directoryExists(dir))) continue;
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!isRulekitOwnedName(entry.name)) continue;
        const skillDir = path.join(dir, entry.name);
        if (await fileExists(path.join(skillDir, OWNERSHIP_MARKER))) {
          result.removedSkillDirs.push(skillDir);
        }
      }
    } else {
      const r = await removeRulekitSkillsFromDir(dir);
      result.removedSkillDirs.push(...r.removed);
      result.errors.push(...r.errors);
    }
  }

  // 2) IDE snippet files
  if (dryRun) {
    // For preview, we just re-use the same scanner but skip the unlink.
    // Easier: actually call removeIdeSnippets in a no-op way by computing
    // the candidate list ourselves.
    const candidates: string[] = [];
    let configBase = "";
    if (platform === "win32") {
      configBase =
        process.env.APPDATA || path.join(homedir, "AppData", "Roaming");
    } else if (platform === "darwin") {
      configBase = path.join(homedir, "Library", "Application Support");
    } else {
      configBase =
        process.env.XDG_CONFIG_HOME || path.join(homedir, ".config");
    }
    for (const ide of ["Code", "Cursor"]) {
      candidates.push(
        path.join(configBase, ide, "User", "snippets", "rulekit.code-snippets"),
      );
    }
    const jbBase = path.join(configBase, "JetBrains");
    if (await directoryExists(jbBase)) {
      try {
        const dirs = await fs.readdir(jbBase, { withFileTypes: true });
        for (const d of dirs) {
          if (d.isDirectory()) {
            candidates.push(
              path.join(jbBase, d.name, "templates", "rulekit.xml"),
            );
          }
        }
      } catch {
        // ignore
      }
    }
    candidates.push(path.join(rulekitDir, "rulekit-snippets.json"));
    for (const f of candidates) {
      if (await fileExists(f)) result.removedSnippetFiles.push(f);
    }
  } else {
    const r = await removeIdeSnippets(homedir, platform);
    result.removedSnippetFiles.push(...r.removed);
    result.errors.push(...r.errors);
  }

  // 3) Lock files: remove rulekit entries
  const lockFiles = [
    path.join(homedir, ".agents", ".skill-lock.json"),
    path.join(homedir, ".config", "opencode", ".skill-lock.json"),
  ];
  for (const lock of lockFiles) {
    if (dryRun) {
      if (!(await fileExists(lock))) continue;
      let parsed: SkillLockFileShape;
      try {
        parsed = JSON.parse(await fs.readFile(lock, "utf-8"));
      } catch {
        continue;
      }
      if (!parsed.skills) continue;
      const entries: string[] = [];
      for (const k of Object.keys(parsed.skills)) {
        if (isRulekitOwnedName(k)) entries.push(k);
      }
      if (entries.length > 0) {
        result.removedLockEntries.push({ lockFile: lock, entries });
      }
    } else {
      const r = await removeRulekitEntriesFromLock(lock);
      if (r.entries.length > 0) result.removedLockEntries.push(r);
    }
  }

  // 5) Local Cursor rules (if local is true)
  if (options.local) {
    const cursorRulesDir = path.join(options.projectDir ?? process.cwd(), '.cursor', 'rules');
    if (await directoryExists(cursorRulesDir)) {
      try {
        const files = await fs.readdir(cursorRulesDir);
        for (const file of files) {
          if (file.startsWith('rulekitx-') && file.endsWith('.mdc')) {
            const filePath = path.join(cursorRulesDir, file);
            if (dryRun) {
              result.removedSnippetFiles.push(filePath);
            } else {
              await fs.unlink(filePath);
              result.removedSnippetFiles.push(filePath);
            }
          }
        }
      } catch (err: any) {
        result.warnings.push(`Failed to clean up local Cursor rules: ${err.message}`);
      }
    }
  }

  // 6) Strip RuleKit managed blocks from always-loaded agent files.
  //    Global: ~/.claude/CLAUDE.md and ~/.config/opencode/AGENTS.md.
  //    Local:  project CLAUDE.md and AGENTS.md.
  const managedFiles: string[] = options.local
    ? [
        path.join(options.projectDir ?? process.cwd(), "CLAUDE.md"),
        path.join(options.projectDir ?? process.cwd(), "AGENTS.md"),
      ]
    : [
        path.join(homedir, ".claude", "CLAUDE.md"),
        path.join(homedir, ".config", "opencode", "AGENTS.md"),
      ];

  for (const file of managedFiles) {
    if (dryRun) {
      let content = "";
      try {
        content = await fs.readFile(file, "utf-8");
      } catch {
        continue;
      }
      if (hasBlock(content)) result.removedManagedBlocks.push(file);
    } else {
      try {
        if (await stripBlockFromFile(file)) {
          result.removedManagedBlocks.push(file);
        }
      } catch (err: any) {
        result.warnings.push(
          `Failed to strip managed block from ${file}: ${err.message}`,
        );
      }
    }
  }

  // 4) The rulekit dir itself (only at the end, so we can still read
  // rulekit-snippets.json from inside it above).
  if (!dryRun && result.rulekitDirFound) {
    try {
      await fs.rm(rulekitDir, { recursive: true, force: true });
      result.rulekitDirRemoved = true;
    } catch (err: any) {
      result.errors.push(`Failed to remove ${rulekitDir}: ${err.message}`);
    }
  }

  return result;
}
