/**
 * Tests for {@link stripExampleHarness} — the serve-time strip that removes the
 * doc-page mount-isolation harness (`mountIdPrefix` / `$props.id()`) from the
 * reader-facing "Show code" snippet (#399).
 *
 * Three layers:
 *   1. Fixture assertions on exact output for each distinct harness shape.
 *   2. Route integration: {@link exampleSnippetResponse} turns a successful
 *      strip into a 200 and a fail-closed throw into a controlled 500.
 *   3. A parametrized sweep over EVERY real example file that contains the
 *      harness: strip it, assert no harness symbol survives, and compile the
 *      stripped output with `svelte/compiler` to prove it is still valid,
 *      copy-pasteable Svelte (catches any dangling derived-id reference a
 *      narrower string assertion would miss). Its count is cross-checked against
 *      the featured-example registry so a moved/renamed dir can't silently zero
 *      the sweep.
 */

import { describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { compile } from 'svelte/compiler';

import { FEATURED_EXAMPLES } from './examples/featured-example-mount-id.test.ts';
import { exampleSnippetResponse } from './playground-server.ts';
import { stripExampleHarness } from './strip-example-harness.ts';

const EXAMPLES_ROOT = join(import.meta.dir, 'examples');

describe('stripExampleHarness — fixtures', () => {
  it('strips the harness and rewrites a single suffix-form id (input/basic)', () => {
    const source = `<script lang="ts">
  import { Input } from '@lostgradient/cinder/input';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(\`\${mountIdPrefix ?? uid}-field\`);

  let name = $state('');
</script>

<Input id={fieldId} bind:value={name} label="Full name" placeholder="Jane Smith" />
`;
    const stripped = stripExampleHarness(source, 'input/basic');
    expect(stripped).toBe(`<script lang="ts">
  import { Input } from '@lostgradient/cinder/input';

  let name = $state('');
</script>

<Input id="field" bind:value={name} label="Full name" placeholder="Jane Smith" />
`);
  });

  it('rewrites multiple suffix-form ids (modal/basic shape)', () => {
    const source = `<script lang="ts">
  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let nameId = $derived(\`\${mountIdPrefix ?? uid}-name\`);
  let emailId = $derived(\`\${mountIdPrefix ?? uid}-email\`);
</script>

<Input id={nameId} />
<Input id={emailId} />
`;
    const stripped = stripExampleHarness(source, 'modal/basic');
    expect(stripped).toContain('<Input id="name" />');
    expect(stripped).toContain('<Input id="email" />');
    expect(stripped).not.toContain('mountIdPrefix');
    expect(stripped).not.toContain('$props.id()');
  });

  it('rewrites a name= binding (radio-group shape)', () => {
    const source = `<script lang="ts">
  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let groupId = $derived(\`\${mountIdPrefix ?? uid}-plan\`);
</script>

<RadioGroup name={groupId} id={groupId}>x</RadioGroup>
`;
    const stripped = stripExampleHarness(source, 'radio-group/basic');
    expect(stripped).toContain('<RadioGroup name="plan" id="plan">');
    expect(stripped).not.toContain('groupId');
  });

  it('rewrites template interpolation and attribute bindings (skip-link/basic)', () => {
    const source = `<script lang="ts">
  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let mainId = $derived(\`\${mountIdPrefix ?? uid}-main\`);
</script>

<SkipLink target={mainId} />
<a href={\`#\${mainId}\`}>Home</a>
<main id={mainId}>x</main>
`;
    const stripped = stripExampleHarness(source, 'skip-link/basic');
    expect(stripped).toContain('<SkipLink target="main" />');
    expect(stripped).toContain('<a href="#main">Home</a>');
    expect(stripped).toContain('<main id="main">');
    expect(stripped).not.toContain('mainId');
  });

  it('leaves a harness-free example untouched', () => {
    const source = `<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
</script>

<Button label="Click me" />
`;
    expect(stripExampleHarness(source, 'button/basic')).toBe(source);
  });

  it('fails closed when a removed identifier survives an unhandled binding', () => {
    // `data-foo={fieldId}` is not one of the rewritten binding forms, so the
    // identifier survives — the strip must throw rather than ship broken code.
    const source = `<script lang="ts">
  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(\`\${mountIdPrefix ?? uid}-field\`);
</script>

<Input data-foo={fieldId} />
`;
    expect(() => stripExampleHarness(source, 'input/basic')).toThrow(/still referenced/);
  });

  it('fails closed on a $-prefixed identifier the word-boundary check would miss', () => {
    // `$rootId` ends and begins with characters `\b` does not treat as a word
    // boundary; identifier boundaries must still catch the surviving reference.
    const source = `<script lang="ts">
  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let $rootId = $derived(\`\${mountIdPrefix ?? uid}-root\`);
</script>

<Thing data-x={$rootId} />
`;
    expect(() => stripExampleHarness(source, 'thing/basic')).toThrow(/still referenced/);
  });

  it('fails closed when an unrecognized derived shape leaves mountIdPrefix behind', () => {
    // A `const` (not `let`) derived declaration is not matched by DERIVED_ID_LINE,
    // so the prop/uid lines are removed but `mountIdPrefix ?? uid` survives. The
    // residual-marker scan must catch this rather than serve half-stripped code.
    const source = `<script lang="ts">
  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  const fieldId = $derived(\`\${mountIdPrefix ?? uid}-field\`);
</script>

<Input id={fieldId} />
`;
    expect(() => stripExampleHarness(source, 'input/basic')).toThrow(/harness marker/);
  });
});

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
  });
});
