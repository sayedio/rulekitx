import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { initRuleKit } from '../init.js';
import * as scanner from '../scanner.js';

vi.mock('fs/promises');
vi.mock('../scanner.js');

describe('init', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should scaffold directory correctly globally when it does not exist', async () => {
    // stat rejects indicating dir doesn't exist
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

    // Provide some fake templates
    vi.mocked(scanner.getTemplateManifest).mockResolvedValue([
      { relativePath: 'core.md', content: 'core' },
      { relativePath: 'skills/engineering/test.md', content: 'test' }
    ]);

    const result = await initRuleKit();

    expect(result.alreadyExisted).toBe(false);
    expect(result.createdFiles).toHaveLength(2);

    const expectedDir = path.join(homedir(), '.rulekit');
    expect(result.rootDir).toBe(expectedDir);

    // Should create root dir
    expect(fs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });

    // Should create subdirectories for nested templates
    const subDir = path.join(expectedDir, 'skills', 'engineering');
    expect(fs.mkdir).toHaveBeenCalledWith(subDir, { recursive: true });

    // Should write files
    expect(fs.writeFile).toHaveBeenCalledWith(path.join(expectedDir, 'core.md'), 'core', 'utf-8');
    expect(fs.writeFile).toHaveBeenCalledWith(path.join(expectedDir, 'skills', 'engineering', 'test.md'), 'test', 'utf-8');
  });

  it('should scaffold locally with layered .mdc frontmatter when --local is provided', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(scanner.getTemplateManifest).mockResolvedValue([
      { relativePath: 'core.md', content: '---\nname: core\ndescription: "Core rules"\n---\ncore content' },
      { relativePath: 'skills/engineering/test.md', content: '---\nname: test\ndescription: "Test skill"\n---\ntest body' }
    ]);

    const result = await initRuleKit({ local: true, projectDir: '/myproject' });

    expect(result.rootDir).toBe(path.join('/myproject', '.rulekit'));

    // Should create .cursor/rules directory
    expect(fs.mkdir).toHaveBeenCalledWith(path.join('/myproject', '.cursor', 'rules'), { recursive: true });

    // Layer 1 — core is always-on (alwaysApply: true, no globs)
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join('/myproject', '.cursor', 'rules', 'rulekit-core.mdc'),
      '---\ndescription: Core rules\nalwaysApply: true\n---\n\ncore content\n',
      'utf-8'
    );

    // Layer 2 — domain skill is Agent Requested (description only, no globs, no alwaysApply)
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join('/myproject', '.cursor', 'rules', 'rulekit-test.mdc'),
      '---\ndescription: Test skill\n---\n\ntest body\n',
      'utf-8'
    );

    // Layer 3 — a project memory file is generated
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join('/myproject', '.rulekit', 'project-memory.md'),
      expect.any(String),
      'utf-8'
    );
  });

  it('should report alreadyExisted when directory exists', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(scanner.getTemplateManifest).mockResolvedValue([]);

    const result = await initRuleKit();

    expect(result.alreadyExisted).toBe(true);
  });
});
