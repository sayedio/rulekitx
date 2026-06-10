// src/managed-block.ts
// Helpers to insert/update/remove a RuleKitX-managed block inside an
// always-loaded agent instruction file (CLAUDE.md, AGENTS.md). The block is
// delimited by markers so user content around it is never touched.

import * as fs from "fs/promises";

export const BLOCK_START = "<!-- RULEKITX:START -->";
export const BLOCK_END = "<!-- RULEKITX:END -->";

/** Builds the full managed block (markers included) from a body string. */
export function buildManagedBlock(body: string): string {
  return `${BLOCK_START}\n${body.trim()}\n${BLOCK_END}`;
}

/**
 * Returns `content` with the RuleKitX block replaced (or appended if absent).
 * Pure string operation — no I/O — so it is easy to test.
 */
export function upsertBlock(content: string, body: string): string {
  const block = buildManagedBlock(body);
  const startIdx = content.indexOf(BLOCK_START);
  const endIdx = content.indexOf(BLOCK_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + BLOCK_END.length);
    return `${before}${block}${after}`;
  }

  // Append, keeping a blank line of separation from any existing content.
  const trimmed = content.replace(/\s*$/, "");
  return trimmed.length > 0 ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

/**
 * Returns `content` with the RuleKitX block removed. If no block is present
 * the content is returned unchanged (aside from trailing-whitespace cleanup).
 */
export function stripBlock(content: string): string {
  const startIdx = content.indexOf(BLOCK_START);
  const endIdx = content.indexOf(BLOCK_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return content;
  }
  const before = content.slice(0, startIdx).replace(/\s*$/, "");
  const after = content.slice(endIdx + BLOCK_END.length).replace(/^\s*/, "");
  if (before && after) return `${before}\n\n${after}`;
  return `${before}${after}`.replace(/^\s*\n/, "");
}

/** Returns true if the file contains a RuleKitX managed block. */
export function hasBlock(content: string): boolean {
  const startIdx = content.indexOf(BLOCK_START);
  const endIdx = content.indexOf(BLOCK_END);
  return startIdx !== -1 && endIdx !== -1 && endIdx > startIdx;
}

/**
 * Upserts the managed block into a file on disk. Creates the file if it does
 * not exist (when `createIfMissing` is true); otherwise leaves a missing file
 * untouched and returns false.
 */
export async function upsertBlockInFile(
  filePath: string,
  body: string,
  createIfMissing: boolean,
): Promise<boolean> {
  let existing = "";
  let fileThere = true;
  try {
    existing = await fs.readFile(filePath, "utf-8");
  } catch {
    fileThere = false;
  }
  if (!fileThere && !createIfMissing) return false;

  const next = upsertBlock(existing, body);
  await fs.writeFile(filePath, next, "utf-8");
  return true;
}

/**
 * Removes the managed block from a file on disk. If removing the block leaves
 * the file empty, the file is deleted. Returns true if the file was changed.
 */
export async function stripBlockFromFile(filePath: string): Promise<boolean> {
  let existing = "";
  try {
    existing = await fs.readFile(filePath, "utf-8");
  } catch {
    return false;
  }
  if (!hasBlock(existing)) return false;

  const next = stripBlock(existing);
  if (next.trim().length === 0) {
    try {
      await fs.unlink(filePath);
    } catch {
      await fs.writeFile(filePath, "", "utf-8");
    }
    return true;
  }
  await fs.writeFile(filePath, next.endsWith("\n") ? next : next + "\n", "utf-8");
  return true;
}
