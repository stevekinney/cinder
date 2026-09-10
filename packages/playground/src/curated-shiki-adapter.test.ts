import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CURATED_SHIKI_ADAPTER_PATH,
  curatedShikiAdapterPlugin,
} from './curated-shiki-adapter-plugin.ts';
import * as curatedAdapter from './curated-shiki-adapter.ts';

const here = dirname(fileURLToPath(import.meta.url));
const bundledAdapterPath = resolve(here, '../../components/src/highlighters/shiki/default.ts');

describe('the playground substitutes a curated Shiki adapter', () => {
  it('exposes every member the CodeBlock seam reaches for', async () => {
    // `code-block-default-highlighter.ts` awaits the adapter module and calls
    // `module_.shikiHighlighter()` with no arguments. A substitution missing
    // that member fails at runtime inside a `$effect`, where the only symptom
    // is a block that never highlights — so pin the surface here instead.
    const bundled = (await import(bundledAdapterPath)) as Record<string, unknown>;
    for (const member of Object.keys(bundled)) {
      expect(curatedAdapter).toHaveProperty(member);
    }
    expect(typeof curatedAdapter.shikiHighlighter).toBe('function');
  });

  it('resolves the bundled adapter to the curated one', async () => {
    const plugin = curatedShikiAdapterPlugin();
    let resolver: ((argument: { path: string }) => { path: string }) | undefined;
    plugin.setup({
      onResolve: (
        _options: unknown,
        callback: (argument: { path: string }) => { path: string },
      ) => {
        resolver = callback;
      },
    } as never);
    expect(resolver).toBeDefined();
    expect(resolver?.({ path: '../../highlighters/shiki/default.ts' })).toEqual({
      path: CURATED_SHIKI_ADAPTER_PATH,
    });
  });

  it('keeps the full registry out of the curated module', () => {
    // The whole point: neither barrel may reappear here. `shiki/langs` alone
    // is 253 grammars, ~9.8 MB of source, walked once per page bundle.
    const source = readFileSync(CURATED_SHIKI_ADAPTER_PATH, 'utf8');
    expect(source).not.toMatch(/from '(shiki\/langs|shiki\/themes)'/);
    expect(source).not.toMatch(/import\('(shiki\/langs|shiki\/themes)'\)/);
  });

  it('still names the two themes the bundled adapter defaults to', () => {
    // Narrowing the theme registry is only safe while it covers the defaults
    // the real adapter resolves by name.
    const source = readFileSync(CURATED_SHIKI_ADAPTER_PATH, 'utf8');
    expect(source).toContain("'github-light'");
    expect(source).toContain("'github-dark'");
    const bundled = readFileSync(bundledAdapterPath, 'utf8');
    expect(bundled).toContain('shiki/langs');
  });
});
