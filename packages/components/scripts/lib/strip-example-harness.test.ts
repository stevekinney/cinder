/**
 * Transform-level tests for {@link stripExampleHarness} — the strip that removes
 * the doc-page mount-isolation harness (`mountIdPrefix` / `$props.id()`) from an
 * example's source so the reader-facing snippet, AND the published manifest
 * `code` field, show clean idiomatic consumer usage (#399).
 *
 * This is the canonical owner of the transform's regression suite: the function
 * lives in `packages/components` because the manifest generator
 * (`generate-component-examples.ts`) calls it to shape the SHIPPED `code` field.
 * The playground server consumes the same function for its `/example-src/` route.
 *
 * Two further test layers live in `packages/playground` (where the example tree
 * and the HTTP server are): the `exampleSnippetResponse` route-glue tests, and a
 * full-corpus sweep that strips + compiles every real harnessed example file.
 */

import { describe, expect, it } from 'bun:test';

import { stripExampleHarness } from './strip-example-harness.ts';

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
