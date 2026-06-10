import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'node18',
  banner: ({ format }) => {
    if (format === 'esm') {
      return {
        js: '',
      };
    }
    return {};
  },
});
