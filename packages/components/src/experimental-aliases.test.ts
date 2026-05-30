/// <reference lib="dom" />
/**
 * Acceptance tests for the deprecated `cinder/experimental/<name>` import
 * aliases left behind when these components were promoted out of the
 * experimental tree.
 *
 * Each alias must:
 *   1. Resolve to the SAME component module as the new `cinder/<name>` path.
 *   2. Appear in package.json#exports under both the old and new keys.
 *   3. Emit a one-time dev deprecation warning when imported.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { DEPRECATED_EXPERIMENTAL_ALIASES } from '../scripts/generate-exports.ts';

const ROOT = join(import.meta.dir, '..');

type AliasModule = { default: unknown };

describe('deprecated experimental aliases', () => {
  for (const { name } of DEPRECATED_EXPERIMENTAL_ALIASES) {
    test(`cinder/experimental/${name} resolves to the same module as cinder/${name}`, async () => {
      const aliasModule = (await import(
        `./components/experimental/${name}/index.ts`
      )) as AliasModule;
      const promotedModule = (await import(`./components/${name}/index.ts`)) as AliasModule;

      expect(aliasModule.default).toBeDefined();
      expect(aliasModule.default).toBe(promotedModule.default);
    });

    test(`both ./experimental/${name} and ./${name} are present in package.json#exports`, async () => {
      const packageJson = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8'));
      const exports = packageJson.exports as Record<string, unknown>;
      expect(exports[`./experimental/${name}`]).toBeDefined();
      expect(exports[`./${name}`]).toBeDefined();
    });
  }

  test('importing an alias emits a one-time dev deprecation warning', async () => {
    const original = console.warn;
    const messages: string[] = [];
    console.warn = (...args: unknown[]) => {
      messages.push(args.map(String).join(' '));
    };
    try {
      // Build the specifier from a variable so the module registry treats the
      // cache-busting query as a distinct module and re-evaluates the shim
      // (the deprecation warning fires once at module evaluation). The dynamic
      // specifier also keeps `tsc` from trying to statically resolve the
      // query-suffixed path.
      const specifier = './components/experimental/message/index.ts?warn-check';
      await import(/* @vite-ignore */ specifier);
    } finally {
      console.warn = original;
    }

    const deprecationWarnings = messages.filter(
      (message) =>
        message.includes('cinder/experimental/message') && message.includes('deprecated'),
    );
    expect(deprecationWarnings.length).toBe(1);
    expect(deprecationWarnings[0]).toContain('cinder/message');
  });
});
