// src/global-resolver.ts
// Resolves the RuleKit configuration directory with local-first priority

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

/**
 * Returns the global RuleKit directory path: ~/.rulekit/
 */
export function getGlobalRulekitDir(): string {
  return path.join(homedir(), '.rulekit');
}

/**
 * Returns the local (project-level) RuleKit directory path: .rulekit/
 */
export function getLocalRulekitDir(projectDir?: string): string {
  return path.join(projectDir ?? process.cwd(), '.rulekit');
}

/**
 * Resolves the active RuleKit directory using priority chain:
 * 1. Local `.rulekit/` in the current project (if exists)
 * 2. Global `~/.rulekit/`
 * 
 * @param projectDir - Optional project directory to check for local config.
 *                     Defaults to process.cwd().
 * @returns The resolved absolute path to the rulekit directory
 * @throws If neither local nor global directory exists
 */
export async function resolveRulekitDir(projectDir?: string): Promise<string> {
  // Priority 1: Local project-level .rulekit/
  const localDir = getLocalRulekitDir(projectDir);
  if (await directoryExists(localDir)) {
    return localDir;
  }

  // Priority 2: Global ~/.rulekit/
  const globalDir = getGlobalRulekitDir();
  if (await directoryExists(globalDir)) {
    return globalDir;
  }

  throw new Error(
    `RuleKit not initialized. Run 'rulekit init' to set up global rules in ${globalDir}, ` +
    `or 'rulekit init --local' for project-level rules.`
  );
}

/**
 * Checks if a directory exists.
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
