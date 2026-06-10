import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import { loadCore, loadSkill, discoverSkills, resolveSkills, getCompletionItems } from '../loader.js';
import * as path from 'path';

// Mock fs/promises
vi.mock('fs/promises');

describe('loader', () => {
  const rootDir = '/fake/root/.rulekitx';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('loadCore', () => {
    it('should load core.md successfully', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('core content');

      const result = await loadCore(rootDir);
      expect(result).toBe('core content');
      expect(fs.readFile).toHaveBeenCalledWith(path.join(rootDir, 'core.md'), 'utf-8');
    });

    it('should throw if core.md does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      await expect(loadCore(rootDir)).rejects.toThrow('Critical: core.md not found');
    });
  });


  describe('discoverSkills', () => {
    it('should return empty array if skills dir does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      
      const result = await discoverSkills(rootDir);
      expect(result).toEqual([]);
    });

    it('should walk category subdirectories and find skills', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('**Primary Dimension:** Great stuff');
      
      const mockCategories = [
        { name: 'engineering', isDirectory: () => true },
        { name: 'design', isDirectory: () => true },
        { name: 'not-a-dir', isDirectory: () => false }
      ] as any[];

      // Mock the first readdir call (categories)
      vi.mocked(fs.readdir).mockImplementationOnce(() => Promise.resolve(mockCategories));
      
      // Mock the subsequent readdir calls (skill files)
      vi.mocked(fs.readdir).mockImplementationOnce(() => Promise.resolve(['architect.md', 'reviewer.md'] as any));
      vi.mocked(fs.readdir).mockImplementationOnce(() => Promise.resolve(['premium-ui.md', 'not-md.txt'] as any));

      const result = await discoverSkills(rootDir);
      
      expect(result).toHaveLength(3);
      expect(result).toContainEqual({
        name: 'architect',
        command: '/rulekitx-architect',
        category: 'engineering',
        path: path.posix.join('skills', 'engineering', 'architect.md'),
        description: 'Great stuff'
      });
      expect(result).toContainEqual({
        name: 'premium-ui',
        command: '/rulekitx-premium-ui',
        category: 'design',
        path: path.posix.join('skills', 'design', 'premium-ui.md'),
        description: 'Great stuff'
      });
    });

    it('should parse YAML frontmatter for description', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('---\nname: architect\ndescription: "My cool architect skill description"\n---\n# Architect');
      
      const mockCategories = [{ name: 'engineering', isDirectory: () => true }] as any[];
      vi.mocked(fs.readdir).mockImplementationOnce(() => Promise.resolve(mockCategories));
      vi.mocked(fs.readdir).mockImplementationOnce(() => Promise.resolve(['architect.md'] as any));

      const result = await discoverSkills(rootDir);
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('My cool architect skill description');
    });
  });

  describe('resolveSkills', () => {
    it('should split requested skills into found and unknown', async () => {
      // Create a mock discoverSkills response
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockImplementationOnce(() => Promise.resolve([
        { name: 'engineering', isDirectory: () => true }
      ] as any));
      vi.mocked(fs.readdir).mockImplementationOnce(() => Promise.resolve(['architect.md'] as any));
      vi.mocked(fs.readFile).mockResolvedValue('');

      const result = await resolveSkills(rootDir, ['architect', 'banana', 'apple']);
      
      expect(result.found).toHaveLength(1);
      expect(result.found[0].name).toBe('architect');
      expect(result.unknown).toEqual(['banana', 'apple']);
    });
  });

  describe('loadSkill', () => {
    it('should load a resolved skill by path', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('skill content');

      const skill = { 
        name: 'architect', 
        command: '/rulekitx-architect',
        category: 'engineering', 
        path: path.posix.join('skills', 'engineering', 'architect.md') 
      };
      const result = await loadSkill(rootDir, skill);
      
      expect(result).toBe('skill content');
      expect(fs.readFile).toHaveBeenCalledWith(path.join(rootDir, skill.path), 'utf-8');
    });

    it('should strip YAML frontmatter from skill content', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('---\nname: architect\ndescription: test\n---\n# Actual Content');

      const skill = { 
        name: 'architect', 
        command: '/rulekitx-architect',
        category: 'engineering', 
        path: path.posix.join('skills', 'engineering', 'architect.md') 
      };
      const result = await loadSkill(rootDir, skill);
      
      expect(result).toBe('# Actual Content');
    });
  });

  describe('getCompletionItems', () => {
    it('should return completion items including core', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockImplementationOnce(() => Promise.resolve([
        { name: 'engineering', isDirectory: () => true }
      ] as any));
      vi.mocked(fs.readdir).mockImplementationOnce(() => Promise.resolve(['architect.md'] as any));
      vi.mocked(fs.readFile).mockResolvedValue('**Primary Dimension:** Great stuff');

      const result = await getCompletionItems(rootDir);
      
      expect(result).toHaveLength(2); // core + architect
      expect(result[0].command).toBe('/rulekitx');
      expect(result[0].category).toBe('core');
      expect(result[1].command).toBe('/rulekitx-architect');
      expect(result[1].description).toBe('Great stuff');
    });
  });
});
