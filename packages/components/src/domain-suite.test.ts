import { describe, expect, test } from 'bun:test';

const domainSuiteModules = [
  ['chat', './components/chat/index.ts'],
  ['diff-viewer', './components/diff-viewer/index.ts'],
  ['surface', './components/surface/index.ts'],
  ['markdown-editor', './components/markdown-editor/index.ts'],
] as const;

describe('domain-suite public components', () => {
  for (const [name, importPath] of domainSuiteModules) {
    test(`${name} imports as a Svelte component`, async () => {
      const module = (await import(importPath)) as { default?: unknown };

      expect(typeof module.default).toBe('function');
    });
  }
});
