import { describe, it, expect } from 'vitest';
import {
  BLOCK_START,
  BLOCK_END,
  upsertBlock,
  stripBlock,
  hasBlock,
} from '../managed-block.js';

describe('managed-block', () => {
  it('appends a block to content that has none', () => {
    const out = upsertBlock('# My notes\n', 'core rules');
    expect(out).toContain('# My notes');
    expect(out).toContain(BLOCK_START);
    expect(out).toContain('core rules');
    expect(out).toContain(BLOCK_END);
  });

  it('replaces an existing block in place without touching surrounding content', () => {
    const initial = upsertBlock('# Top\n', 'first body');
    const updated = upsertBlock(initial, 'second body');

    expect(updated).toContain('# Top');
    expect(updated).toContain('second body');
    expect(updated).not.toContain('first body');
    // Only one block remains
    expect(updated.indexOf(BLOCK_START)).toBe(updated.lastIndexOf(BLOCK_START));
  });

  it('strips the block and preserves user content', () => {
    const withBlock = upsertBlock('# Keep me\n', 'managed body');
    expect(hasBlock(withBlock)).toBe(true);

    const stripped = stripBlock(withBlock);
    expect(stripped).toContain('# Keep me');
    expect(stripped).not.toContain('managed body');
    expect(hasBlock(stripped)).toBe(false);
  });

  it('upsert then strip round-trips back to the original user content', () => {
    const original = '# Project\n\nSome docs here.';
    const withBlock = upsertBlock(original, 'rulekit core');
    const stripped = stripBlock(withBlock).trim();
    expect(stripped).toBe(original.trim());
  });
});
