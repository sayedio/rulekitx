// src/types.ts
// Shared type definitions for the RuleKit v2 system

/**
 * Result of parsing a user prompt for /rulekit slash-command skills.
 */
export interface ParseResult {
  /** Detected skill names (without /rulekit- prefix), deduplicated, in order of appearance */
  skills: string[];
  /** The remaining user task text after skill commands are extracted */
  task: string;
  /** The original raw input string */
  raw: string;
  /** Whether /rulekit was invoked (always true if any /rulekit-* command is present) */
  coreInvoked: boolean;
}

/**
 * Metadata for a discovered skill file.
 */
export interface SkillDefinition {
  /** Skill name (e.g., "architect") */
  name: string;
  /** Full command name for IDE display (e.g., "/rulekit-architect") */
  command: string;
  /** Category directory (e.g., "engineering", "design", "execution") */
  category: string;
  /** Relative path within the rulekit directory (e.g., "skills/engineering/architect.md") */
  path: string;
  /** Optional one-line description extracted from the skill file */
  description?: string;
}

/**
 * A single composed layer in the final prompt context.
 */
export interface ComposedLayer {
  /** The type of this layer */
  type: 'core' | 'skill' | 'task';
  /** Display name for this layer (e.g., "architect", "core") */
  name: string;
  /** The full markdown content of this layer */
  content: string;
}

/**
 * Result of composing a full prompt context.
 */
export interface ComposeResult {
  /** The fully composed context string with XML-wrapped bulletproof injection, ready for LLM */
  context: string;
  /** Structured metadata about each layer included in the composition */
  layers: ComposedLayer[];
  /** Skill names that were requested but not found */
  warnings: string[];
}

/**
 * Options for the compose function.
 */
export interface ComposeOptions {
  /** Root directory of the rulekit installation (resolved via global-resolver) */
  rootDir: string;
  /** Parsed skill names to load */
  skills: string[];
  /** The user's task text */
  task: string;
}

/**
 * Result of the init scaffolding operation.
 */
export interface InitResult {
  /** Root directory where rulekit was initialized */
  rootDir: string;
  /** List of all files created (relative paths) */
  createdFiles: string[];
  /** List of stale files removed during init (relative paths) */
  removedFiles: string[];
  /** Whether an existing installation was detected */
  alreadyExisted: boolean;
}

/**
 * A template file entry in the manifest.
 */
export interface TemplateEntry {
  /** Relative file path within rulekit dir (e.g., "skills/engineering/architect.md") */
  relativePath: string;
  /** The full markdown content */
  content: string;
}

/**
 * Skill completion item for IDE integrations.
 */
export interface SkillCompletionItem {
  /** The full slash command (e.g., "/rulekit-architect") */
  command: string;
  /** Short description for the completion popup */
  description: string;
  /** Category for grouping (e.g., "engineering", "design") */
  category: string;
}
