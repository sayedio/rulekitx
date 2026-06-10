// src/parser.ts
// Parses user prompts to extract /rulekit and /rulekit-<skill> commands

import { ParseResult } from './types.js';

/**
 * Parses a user prompt to extract RuleKit slash-command skills and the remaining task text.
 * 
 * Command format:
 *   /rulekit           → Loads core rules only (no specific skill)
 *   /rulekit-architect → Loads core + architect skill
 *   /rulekit-premium-ui → Loads core + premium-ui skill
 * 
 * Multiple commands can be combined:
 *   /rulekit-architect /rulekit-premium-ui build auth system
 * 
 * @param input The raw prompt string
 * @returns ParseResult containing the extracted skills, core flag, and task
 */
export function parsePrompt(input: string): ParseResult {
  if (!input || input.trim() === '') {
    return { skills: [], task: '', raw: input, coreInvoked: false };
  }

  // Match /rulekit (core only) or /rulekit-<skill-name>
  // Must be at start of string or preceded by whitespace
  // Skill names: alphanumeric + hyphens, starting with a letter
  const rulekitRegex = /(?:^|\s)\/rulekit(?:-([a-zA-Z][a-zA-Z0-9-]*))?(?=\s|$)/g;
  
  const rawSkills: string[] = [];
  let coreInvoked = false;
  let match;

  // Extract all commands
  while ((match = rulekitRegex.exec(input)) !== null) {
    if (match[1]) {
      // /rulekit-<skill> → extract skill name
      rawSkills.push(match[1]);
    }
    // Any /rulekit or /rulekit-* match means core is invoked
    coreInvoked = true;
  }

  // Remove the matched commands from the text to get the actual task
  let task = input.replace(rulekitRegex, '').trim();

  // Deduplicate skills while preserving order of appearance
  const uniqueSkills = [...new Set(rawSkills)];

  return {
    skills: uniqueSkills,
    task,
    raw: input,
    coreInvoked
  };
}
