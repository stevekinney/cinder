import { describe, expect, test } from 'bun:test';

const domainSuiteModules = [['surface', './components/surface/index.ts']] as const;

describe('domain-suite public components', () => {
  for (const [name, importPath] of domainSuiteModules) {
    test(`${name} imports as a Svelte component`, async () => {
      const module = (await import(importPath)) as { default?: unknown };

      expect(typeof module.default).toBe('function');
    });
  }
});
