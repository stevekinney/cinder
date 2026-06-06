import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

import { analyzeComponent } from './analyze.ts';
import { validateComponentDocumentationPayload } from './component-documentation-reference.ts';
import {
  buildComponentDocumentation,
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
    expect(payload.readme.html).toContain('<h1>Button</h1>');
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

  it('renders generated README tag references without marking the README unsafe', () => {
    const readme = renderReadmeDocumentation(`
# Generated References

<!-- generated:props:start -->

| Prop | Type | Required | Default | Description |
| ---- | ---- | -------- | ------- | ----------- |
| \`class\` | \`string\` | no | - | Optional extra class on the underlying <Modal>. |
| \`description\` | \`string\` | no | - | Rendered as a single <p> and wired to aria-describedby. |

<!-- generated:props:end -->
`);

    expect(readme.hadUnsafeContent).toBe(false);
    expect(readme.html).toContain('&#x3C;Modal>');
    expect(readme.html).toContain('&#x3C;p>');
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
