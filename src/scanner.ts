import * as fs from 'fs/promises';
import * as path from 'path';
import { TemplateEntry } from './types.js';

async function scanTemplatesDir(dir: string, baseDir: string = dir): Promise<TemplateEntry[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const templates: TemplateEntry[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subTemplates = await scanTemplatesDir(fullPath, baseDir);
      templates.push(...subTemplates);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const relativePath = path.relative(baseDir, fullPath).split(path.sep).join('/');
      const content = await fs.readFile(fullPath, 'utf-8');
      templates.push({
        relativePath,
        content
      });
    }
  }

  return templates;
}

const isTemplatesDir = async (dir: string) => {
  try {
    await fs.access(path.join(dir, 'core.md'));
    return true;
  } catch {
    return false;
  }
};

export async function getTemplateManifest(): Promise<TemplateEntry[]> {
  const currentDir = __dirname;
  
  // Try ../templates (from dist/ or src/)
  let templatesDir = path.resolve(currentDir, '../templates');
  if (await isTemplatesDir(templatesDir)) {
    return scanTemplatesDir(templatesDir);
  }
  
  // Try ../../templates
  templatesDir = path.resolve(currentDir, '../../templates');
  if (await isTemplatesDir(templatesDir)) {
    return scanTemplatesDir(templatesDir);
  }

  throw new Error(`Critical: templates directory not found starting from ${currentDir}`);
}
