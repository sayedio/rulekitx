import { describe, it, expect } from 'vitest';
import { parsePrompt } from '../parser.js';

describe('parser', () => {
  describe('parsePrompt', () => {
    it('should extract a single skill and the task text', () => {
      const input = '/rulekit-architect build auth system';
      const result = parsePrompt(input);
      
      expect(result.skills).toEqual(['architect']);
      expect(result.task).toBe('build auth system');
      expect(result.coreInvoked).toBe(true);
    });

    it('should extract multiple skills', () => {
      const input = '/rulekit-reviewer /rulekit-collab-safe review payment flow';
      const result = parsePrompt(input);
      
      expect(result.skills).toEqual(['reviewer', 'collab-safe']);
      expect(result.task).toBe('review payment flow');
      expect(result.coreInvoked).toBe(true);
    });

    it('should handle /rulekit alone (core only)', () => {
      const input = '/rulekit build a thing';
      const result = parsePrompt(input);
      
      expect(result.skills).toEqual([]);
      expect(result.task).toBe('build a thing');
      expect(result.coreInvoked).toBe(true);
    });

    it('should handle multiline prompts with skills on first line', () => {
      const input = `/rulekit-premium-ui /rulekit-redesign
improve dashboard homepage
make it look like stripe`;
      const result = parsePrompt(input);
      
      expect(result.skills).toEqual(['premium-ui', 'redesign']);
      expect(result.task).toBe('improve dashboard homepage\nmake it look like stripe');
      expect(result.coreInvoked).toBe(true);
    });

    it('should deduplicate duplicate skills preserving order', () => {
      const input = '/rulekit-architect /rulekit-reviewer /rulekit-architect review auth';
      const result = parsePrompt(input);
      
      expect(result.skills).toEqual(['architect', 'reviewer']);
      expect(result.task).toBe('review auth');
      expect(result.coreInvoked).toBe(true);
    });

    it('should return empty skills array and coreInvoked=false if none detected', () => {
      const input = 'build auth system';
      const result = parsePrompt(input);
      
      expect(result.skills).toEqual([]);
      expect(result.task).toBe('build auth system');
      expect(result.coreInvoked).toBe(false);
    });

    it('should handle empty input gracefully', () => {
      const result1 = parsePrompt('');
      expect(result1.skills).toEqual([]);
      expect(result1.task).toBe('');
      expect(result1.coreInvoked).toBe(false);

      const result2 = parsePrompt('   ');
      expect(result2.skills).toEqual([]);
      expect(result2.task).toBe('');
      expect(result2.coreInvoked).toBe(false);
    });

    it('should not match file paths or urls', () => {
      const input = '/rulekit-architect review https://github.com/repo/file.ts and /etc/hosts';
      const result = parsePrompt(input);
      
      expect(result.skills).toEqual(['architect']);
      expect(result.task).toBe('review https://github.com/repo/file.ts and /etc/hosts');
      expect(result.coreInvoked).toBe(true);
    });
  });
});
