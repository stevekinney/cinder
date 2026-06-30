/**
 * Playground-side tests for the example-harness strip (#399). The transform
 * itself is owned by `packages/components` (the manifest generator shapes the
 * shipped `code` field with it); its fixture/unit suite lives there at
 * `scripts/lib/strip-example-harness.test.ts`. This file covers the two things
 * that need playground's own surroundings:
 *
 *   1. Route integration: {@link exampleSnippetResponse} turns a successful strip
 *      into a 200 and a fail-closed throw into a controlled 500.
 *   2. A parametrized sweep over EVERY real example file that contains the
 *      harness: strip it, assert no harness symbol survives, and compile the
 *      stripped output with `svelte/compiler` to prove it is still valid,
 *      copy-pasteable Svelte (catches any dangling derived-id reference a narrower
 *      string assertion would miss). Its count is cross-checked against the
 *      featured-example registry so a moved/renamed dir can't silently zero the
 *      sweep. This is also the canary the codex-advisor flagged: a new harness
 *      shape that the fail-closed parser can't handle would now break
 *      `components:generate`, so this corpus sweep must stay green.
 */

import { describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { compile } from 'svelte/compiler';

import { stripExampleHarness } from '../../components/scripts/lib/strip-example-harness.ts';
import { FEATURED_EXAMPLES } from './examples/featured-examples.ts';
import { exampleSnippetResponse } from './playground-server.ts';

const EXAMPLES_ROOT = join(import.meta.dir, 'examples');

describe('exampleSnippetResponse — route glue', () => {
  it('returns a 200 text/plain stripped snippet on success', async () => {
    const source = `<script lang="ts">
  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(\`\${mountIdPrefix ?? uid}-field\`);
</script>

<Input id={fieldId} />
`;
    const response = exampleSnippetResponse(source, 'input/basic');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    const body = await response.text();
    expect(body).toContain('<Input id="field" />');
    expect(body).not.toContain('mountIdPrefix');
    expect(body).not.toContain('$props.id()');
  });

  it('returns a controlled 500 (not a crash) when the strip fails closed', async () => {
    // `data-foo={fieldId}` leaves the identifier dangling → strip throws → the
    // route must answer with a diagnostic 500, never an opaque connection error.
    const source = `<script lang="ts">
  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(\`\${mountIdPrefix ?? uid}-field\`);
</script>

<Input data-foo={fieldId} />
`;
    const response = exampleSnippetResponse(source, 'broken/example');
    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    const body = await response.text();
    expect(body).toContain('broken/example');
    expect(body).toContain('Failed to prepare example snippet');
  });
});

/** Recursively collect every `*.example.svelte` path under {@link EXAMPLES_ROOT}. */
async function collectExampleFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectExampleFiles(full)));
    } else if (entry.name.endsWith('.example.svelte')) {
      files.push(full);
    }
  }
  return files;
}

describe('stripExampleHarness — every harnessed example stays valid Svelte', () => {
  it('strips and compiles all real example files cleanly', async () => {
    const files = await collectExampleFiles(EXAMPLES_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const harnessed: string[] = [];
    for (const file of files) {
      const source = await Bun.file(file).text();
      if (!source.includes('mountIdPrefix')) continue;

      const componentName = basename(dirname(file));
      const scenario = basename(file, '.example.svelte');
      harnessed.push(`${componentName}/${scenario}`);

      const stripped = stripExampleHarness(source, `${componentName}/${scenario}`);

      // No harness plumbing may leak into the reader snippet.
      expect(stripped).not.toContain('mountIdPrefix');
      expect(stripped).not.toContain('$props.id()');

      // The stripped snippet must still be valid, copy-pasteable Svelte —
      // catches any dangling derived-id reference left by an unhandled binding.
      expect(() =>
        compile(stripped, { filename: file, generate: 'client', dev: false }),
      ).not.toThrow();
    }

    // Every featured example carries the harness, so the sweep must find at
    // least that many. Cross-checking against the registry (rather than a bare
    // magic number) means a moved/renamed example dir fails here loudly instead
    // of silently matching zero harnessed files.
    expect(harnessed.length).toBeGreaterThanOrEqual(FEATURED_EXAMPLES.length);
  }, 20_000);
});
