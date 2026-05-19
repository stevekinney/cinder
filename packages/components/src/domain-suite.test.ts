import { describe, expect, test } from 'bun:test';

const domainSuiteModules = [
  ['chat', './components/chat.svelte'],
  ['diff-viewer', './components/diff-viewer.svelte'],
  ['surface', './components/surface/index.ts'],
  ['markdown-editor', './components/markdown-editor.svelte'],
] as const;

describe('domain-suite public components', () => {
  for (const [name, importPath] of domainSuiteModules) {
    test(`${name} imports as a Svelte component`, async () => {
      const module = (await import(importPath)) as { default?: unknown };

      expect(typeof module.default).toBe('function');
    });
  }
});
