import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

import { analyzeAll, analyzeComponent } from './analyze.ts';
import { validateComponentDocumentationPayload } from './component-documentation-reference.ts';
import {
  buildComponentDocumentation,
  loadPackageManifestForDocumentation,
  renderReadmeDocumentation,
} from './component-documentation.ts';
import type { ComponentManifest } from './types.ts';

const COMPONENTS_ROOT = join(import.meta.dir, '..', '..', 'components', 'src', 'components');

function componentManifest(componentName: string): Promise<ComponentManifest> {
  return analyzeComponent(join(COMPONENTS_ROOT, componentName, `${componentName}.svelte`));
}

describe('buildComponentDocumentation', () => {
  it('returns Button purpose, README HTML, schema, constraints, examples, and raw artifacts', async () => {
    const payload = await buildComponentDocumentation('button', await componentManifest('button'));

    expect(payload.component.id).toBe('button');
    expect(payload.component.purpose).toContain('Primary interactive control');
    // The Overview README drops the leading `# Button` title (the hero shows it)
    // and the generated reference sections (Props table, CSS Variables,
    // Subcomponents) — those render in the page's own dedicated sections — so
    // only the hand-written prose remains.
    expect(payload.readme.html).not.toContain('<h1>Button</h1>');
    expect(payload.readme.html).toContain('<h2>Usage</h2>');
    expect(payload.readme.html).not.toContain('<h2>Props</h2>');
    expect(payload.readme.html).toContain('class="shiki');
    expect(payload.readme.hadUnsafeContent).toBe(false);
    expect(payload.schema).toBeDefined();
    expect(payload.constraints).not.toBeNull();
    expect(payload.examples).not.toBeNull();
    expect(payload.rawArtifacts.manifestEntry).toBeDefined();
    expect(payload.rawArtifacts.schema).toBe(payload.schema);
    expect(payload.rawArtifacts.constraints).toBe(payload.constraints);
    expect(payload.rawArtifacts.examples).toBe(payload.examples);
  });

  it('returns AvatarGroup variables', async () => {
    const payload = await buildComponentDocumentation(
      'avatar-group',
      await componentManifest('avatar-group'),
    );

    expect(payload.variables).toEqual(['--cinder-avatar-group-overlap']);
    expect(payload.rawArtifacts.variables).toEqual(['--cinder-avatar-group-overlap']);
  });

  it('reloads the package manifest for each documentation build request', async () => {
    const first = await loadPackageManifestForDocumentation();
    const second = await loadPackageManifestForDocumentation();

    expect(second).not.toBe(first);
    expect(second.components.map((component) => component.id)).toEqual(
      first.components.map((component) => component.id),
    );
  });

  it('renders generated README tag references without marking the README unsafe', () => {
    const readme = renderReadmeDocumentation(`
# Generated References

<!-- generated:props:start -->

| Prop | Type | Required | Default | Description |
| ---- | ---- | -------- | ------- | ----------- |
| \`class\` | \`string\` | no | - | Optional extra class on the underlying <Modal>. |
| \`description\` | \`string\` | no | - | Rendered as a single <p> and wired to aria-describedby. |
| \`dangerousTagMention\` | \`string\` | no | - | Mentions <script>, <style>, and <img src="avatar.png"> as literal text. |

<!-- generated:props:end -->
`);

    expect(readme.hadUnsafeContent).toBe(false);
    // The tag-like text must stay ESCAPED. `<` can serialize as the named
    // reference (`&lt;`) or as a numeric reference in hex (`&#x3C;`/`&#x3c;`) or
    // decimal (`&#60;`); which spelling the rehype serializer emits depends on
    // which variant of `decode-named-character-reference` the test environment
    // resolves (the `browser` export condition routes to a DOM-based decoder).
    // Accept any of them — the contract is "escaped, never raw".
    const escapedLessThan = /(?:&lt;|&#x3c;|&#60;)/i;
    const escapedTag = (tag: string) => new RegExp(`${escapedLessThan.source}${tag}>`, 'i');
    expect(readme.html).toMatch(escapedTag('Modal'));
    expect(readme.html).toMatch(escapedTag('p'));
    expect(readme.html).toMatch(escapedTag('script'));
    expect(readme.html).toMatch(escapedTag('style'));
    expect(readme.html).not.toContain('<Modal>');
    expect(readme.html).not.toContain('<script>');
    expect(readme.html).not.toContain('<style>');
    expect(readme.html).not.toContain('<img');
  });

  it('marks unsafe README rendering and validation fails on it', async () => {
    const payload = await buildComponentDocumentation('button', await componentManifest('button'));
    const unsafeReadme = renderReadmeDocumentation('<script>alert("unsafe")</script>');

    expect(unsafeReadme.hadUnsafeContent).toBe(true);
    expect(
      validateComponentDocumentationPayload({
        ...payload,
        readme: unsafeReadme,
      }),
    ).toContain('button README rendering stripped unsafe content');
  });
});

describe('every component documentation payload passes validation', () => {
  // The static-export deploy fetches /api/documentation/:name for every
  // component and aborts the build on any non-2xx response. That route builds
  // the same payload below and 500s when validateComponentDocumentationPayload
  // returns errors — most easily tripped by a raw HTML tag in README prose
  // (e.g. `<table>` instead of `` `<table>` ``), which the markdown sanitizer
  // strips and flags as hadUnsafeContent. Sweeping every component here catches
  // that at unit-test time (a gating job) instead of post-merge on Vercel.
  it('builds and validates the doc payload for all components', async () => {
    const manifests = await analyzeAll(COMPONENTS_ROOT);
    expect(manifests.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const manifest of manifests) {
      const payload = await buildComponentDocumentation(manifest.kebabName, manifest);
      const errors = validateComponentDocumentationPayload(payload);
      if (errors.length > 0) {
        failures.push(`${manifest.kebabName}: ${errors.join('; ')}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
