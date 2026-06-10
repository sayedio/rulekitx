import { describe, it, expect, vi, beforeEach } from 'vitest';
import { composePrompt } from '../composer.js';
import * as loader from '../loader.js';
import { SkillDefinition } from '../types.js';

vi.mock('../loader.js');

describe('composer', () => {
  const rootDir = '/fake';
  
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should compose prompt deterministically: core -> skills -> standards -> task', async () => {
    vi.mocked(loader.loadCore).mockResolvedValue('CORE CONTENT');
    vi.mocked(loader.resolveSkills).mockResolvedValue({
      found: [{ name: 'architect', category: 'engineering', path: 'path', command: '/rulekitx-architect' } as SkillDefinition],
      unknown: []
    });
    vi.mocked(loader.loadSkill).mockResolvedValue('ARCHITECT CONTENT');


    const result = await composePrompt({
      rootDir,
      skills: ['architect'],
      task: 'build auth'
    });

    expect(result.warnings).toHaveLength(0);
    expect(result.layers).toHaveLength(3);
    
    // Check order
    expect(result.layers[0].type).toBe('core');
    expect(result.layers[1].type).toBe('skill');
    expect(result.layers[2].type).toBe('task');

    // Check XML injection structure
    expect(result.context).toContain('<RULEKIT_SYSTEM_PROMPT version="2.0" priority="MAXIMUM">');
    expect(result.context).toContain('<MANDATORY_INSTRUCTIONS>');
    expect(result.context).toContain('<CORE_RULES priority="CRITICAL">');
    expect(result.context).toContain('CORE CONTENT');
    expect(result.context).toContain('<ACTIVE_SKILLS>');
    expect(result.context).toContain('<SKILL name="architect" priority="HIGH" mandatory="true">');
    expect(result.context).toContain('ARCHITECT CONTENT');

    expect(result.context).toContain('<COMPLIANCE_CHECK>');
    expect(result.context).toContain('☐ ALL rules from CORE_RULES');
    expect(result.context).toContain('<USER_TASK>');
    expect(result.context).toContain('build auth');
  });

  it('should handle missing skills safely without failing composition', async () => {
    vi.mocked(loader.loadCore).mockResolvedValue('CORE CONTENT');
    vi.mocked(loader.resolveSkills).mockResolvedValue({
      found: [],
      unknown: ['banana']
    });


    const result = await composePrompt({
      rootDir,
      skills: ['banana'],
      task: 'do thing'
    });

    expect(result.warnings).toContain('banana');
    expect(result.layers).toHaveLength(2); // core + task
    expect(result.context).not.toContain('banana');
    expect(result.context).not.toContain('<ACTIVE_SKILLS>');
  });

  it('should fail if core fails to load', async () => {
    vi.mocked(loader.loadCore).mockRejectedValue(new Error('ENOENT'));

    await expect(composePrompt({
      rootDir,
      skills: [],
      task: 'task'
    })).rejects.toThrow('Failed to load RuleKit core');
  });
});
