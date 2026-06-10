// src/loader.ts
// Loads core rules, skills, and standards from the rulekit directory

import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillDefinition, SkillCompletionItem } from './types.js';

/**
 * Checks if a file/directory exists.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Strips YAML frontmatter from markdown content if present.
 */
export function stripFrontmatter(content: string): string {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('---')) {
    const secondDashIndex = trimmed.indexOf('---', 3);
    if (secondDashIndex !== -1) {
      return trimmed.substring(secondDashIndex + 3).trimStart();
    }
  }
  return content;
}

/**
 * Loads the core.md file.
 */
export async function loadCore(rootDir: string): Promise<string> {
  const corePath = path.join(rootDir, 'core.md');
  if (!(await fileExists(corePath))) {
    throw new Error(`Critical: core.md not found in ${rootDir}`);
  }
  const content = await fs.readFile(corePath, 'utf-8');
  return stripFrontmatter(content);
}


/**
 * Discovers all available skills in the rulekit directory.
 * Scans the skills/ directory one level deep to find categories.
 * Each skill gets a /rulekit-<name> command.
 */
export async function discoverSkills(rootDir: string): Promise<SkillDefinition[]> {
  const skillsDir = path.join(rootDir, 'skills');
  if (!(await fileExists(skillsDir))) {
    return [];
  }

  const skills: SkillDefinition[] = [];
  const categories = await fs.readdir(skillsDir, { withFileTypes: true });

  for (const category of categories) {
    if (category.isDirectory()) {
      const categoryPath = path.join(skillsDir, category.name);
      const skillFiles = await fs.readdir(categoryPath);
      
      for (const file of skillFiles) {
        if (file.endsWith('.md')) {
          const skillName = file.replace('.md', '');
          const skillPath = path.join(categoryPath, file);
          
          // Extract description from first meaningful line
          let description: string | undefined;
          try {
            const content = await fs.readFile(skillPath, 'utf-8');
            description = extractSkillDescription(content);
          } catch {
            // Silently skip description extraction failures
          }

          skills.push({
            name: skillName,
            command: `/rulekitx-${skillName}`,
            category: category.name,
            path: path.posix.join('skills', category.name, file),
            description
          });
        }
      }
    }
  }

  return skills;
}

/**
 * Extracts a one-line description from skill markdown content.
 * Parses YAML frontmatter if present, otherwise falls back to looking for
 * the "Primary Dimension" line or the first blockquote.
 */
export function extractSkillDescription(content: string): string | undefined {
  const trimmed = content.trim();
  if (trimmed.startsWith('---')) {
    const secondDashIndex = trimmed.indexOf('---', 3);
    if (secondDashIndex !== -1) {
      const frontmatter = trimmed.substring(3, secondDashIndex);
      const lines = frontmatter.split('\n');
      for (const line of lines) {
        const cleanLine = line.trim();
        const match = cleanLine.match(/^description:\s*(.+)$/);
        if (match) {
          let desc = match[1].trim();
          if ((desc.startsWith('"') && desc.endsWith('"')) || (desc.startsWith("'") && desc.endsWith("'"))) {
            desc = desc.substring(1, desc.length - 1);
          }
          return desc;
        }
      }
    }
  }

  const lines = content.split('\n');
  
  // Try to find "Primary Dimension:" line
  for (const line of lines) {
    if (line.includes('Primary Dimension:')) {
      const match = line.match(/Primary Dimension:\*?\*?\s*(.+)/);
      if (match) return match[1].trim();
    }
  }

  // Fallback: first blockquote line
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('> ') && t.length > 10) {
      return t.replace(/^>\s*/, '').trim();
    }
  }

  return undefined;
}

/**
 * Resolves requested skill names against available skills.
 */
export async function resolveSkills(
  rootDir: string, 
  requestedSkills: string[]
): Promise<{ found: SkillDefinition[], unknown: string[] }> {
  const available = await discoverSkills(rootDir);
  const availableMap = new Map(available.map(s => [s.name, s]));

  const found: SkillDefinition[] = [];
  const unknown: string[] = [];

  for (const skill of requestedSkills) {
    const definition = availableMap.get(skill);
    if (definition) {
      found.push(definition);
    } else {
      unknown.push(skill);
    }
  }

  return { found, unknown };
}

/**
 * Loads the content of a specific skill.
 */
export async function loadSkill(rootDir: string, skill: SkillDefinition): Promise<string> {
  const fullPath = path.join(rootDir, skill.path);
  const content = await fs.readFile(fullPath, 'utf-8');
  return stripFrontmatter(content);
}

/**
 * Generates completion items for IDE integration.
 * Returns a list of all /rulekitx-* commands with descriptions.
 */
export async function getCompletionItems(rootDir: string): Promise<SkillCompletionItem[]> {
  const skills = await discoverSkills(rootDir);
  
  const items: SkillCompletionItem[] = [
    {
      command: '/rulekitx',
      description: 'Load core engineering governance rules only',
      category: 'core'
    },
    ...skills.map(skill => ({
      command: skill.command,
      description: skill.description ?? `${skill.category} skill: ${skill.name}`,
      category: skill.category
    }))
  ];

  return items;
}
