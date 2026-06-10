import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import { detectProjectContext, buildProjectMemory } from '../project-memory.js';

vi.mock('fs/promises');

describe('project-memory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('infers stack from package.json dependencies', async () => {
    vi.mocked(fs.readFile).mockImplementation((p: any) => {
      if (String(p).endsWith('package.json')) {
        return Promise.resolve(
          JSON.stringify({
            dependencies: {
              next: '15.0.0',
              react: '19.0.0',
              tailwindcss: '4.0.0',
              '@tanstack/react-query': '5.0.0',
              stripe: '17.0.0',
            },
            devDependencies: {
              typescript: '5.0.0',
              vitest: '2.0.0',
            },
          }),
        );
      }
      return Promise.reject(new Error('ENOENT'));
    });
    // No lockfiles / config files exist.
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

    const ctx = await detectProjectContext('/proj');

    expect(ctx.languages).toContain('TypeScript');
    expect(ctx.frameworks).toContain('Next.js');
    expect(ctx.frameworks).toContain('React');
    expect(ctx.styling).toContain('Tailwind CSS');
    expect(ctx.dataState).toContain('React Query');
    expect(ctx.services).toContain('Stripe');
    expect(ctx.testing).toContain('Vitest');
  });

  it('detects the package manager from the lockfile', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(fs.access).mockImplementation((p: any) =>
      String(p).endsWith('pnpm-lock.yaml')
        ? Promise.resolve(undefined as any)
        : Promise.reject(new Error('ENOENT')),
    );

    const ctx = await detectProjectContext('/proj');
    expect(ctx.packageManager).toBe('pnpm');
  });

  it('builds a memory file with detected values and placeholders for the rest', async () => {
    const md = buildProjectMemory({
      languages: ['TypeScript'],
      frameworks: ['Next.js'],
      styling: ['Tailwind CSS'],
      dataState: [],
      services: [],
      testing: ['Vitest'],
      packageManager: 'pnpm',
      monorepo: false,
    });

    expect(md).toContain('name: project-memory');
    expect(md).toContain('TypeScript');
    expect(md).toContain('Next.js');
    expect(md).toContain('pnpm');
    // Sections without detected values get a fill-in placeholder
    expect(md).toContain('<!-- fill in -->');
    // Architecture / business rules are always placeholders
    expect(md).toContain('## Architecture');
    expect(md).toContain('## Business Rules');
  });
});
