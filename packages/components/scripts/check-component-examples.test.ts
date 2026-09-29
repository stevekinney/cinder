import Ajv from 'ajv/dist/2020.js';
import { describe, expect, it } from 'bun:test';

import type { ExampleArtifact } from './check-component-examples.ts';
import {
  checkCommittedExamples,
  validateExampleArtifactValue,
} from './check-component-examples.ts';
import type { Manifest } from './generate-manifest.ts';
import { readJsonFile } from './lib/read-json-file.ts';

const PACKAGE_ROOT = `${import.meta.dir}/..`;
const COMPONENT_SCHEMA_PATH = `${PACKAGE_ROOT}/src/schemas/examples.schema.json`;
const MANIFEST_PATH = `${PACKAGE_ROOT}/components.json`;

const validArtifact = {
  $schema: '../../schemas/examples.schema.json',
  component: 'button',
  import: '@lostgradient/cinder',
  examples: [
    {
      id: 'basic',
      title: 'Basic button',
      description: 'A basic button.',
      code: '<script lang="ts">\n  import { Button } from \'@lostgradient/cinder\';\n</script>',
    },
  ],
};

async function testContext() {
  const schema = await Bun.file(COMPONENT_SCHEMA_PATH).json();
  const manifest = await readJsonFile<Manifest>(MANIFEST_PATH);
  const component = manifest.components.find((entry) => entry.id === 'button');
  if (component === undefined) throw new Error('button manifest entry missing');
  const validator = new Ajv({ allErrors: true, strict: false }).compile<ExampleArtifact>(schema);
  const location = {
    directory: `${PACKAGE_ROOT}/src/components/button`,
    id: 'button',
    isExperimental: false,
  } as const;
  return { component, location, validator };
}

describe('committed component examples', () => {
  it('validates every sidecar against the schema and its owning manifest entry', async () => {
    expect(await checkCommittedExamples()).toEqual([]);
  });

  it('rejects a malformed sidecar schema shape', async () => {
    const { component, location, validator } = await testContext();
    const malformed = { ...validArtifact, examples: [] };
    const issues = validateExampleArtifactValue(
      malformed,
      location,
      'button',
      'src/components/button/button.examples.json',
      validator,
      component,
    );
    expect(issues.some((issue) => issue.includes('schema validation failed'))).toBe(true);
  });

  it('rejects a sidecar whose component does not belong to its directory', async () => {
    const { component, location, validator } = await testContext();
    const issues = validateExampleArtifactValue(
      { ...validArtifact, component: 'card' },
      location,
      'button',
      'src/components/button/button.examples.json',
      validator,
      component,
    );
    expect(issues).toContain(
      'src/components/button/button.examples.json: component "card" does not match owning directory "button"',
    );
  });

  it('rejects a sidecar whose manifest relationship is stale', async () => {
    const { component, location, validator } = await testContext();
    const issues = validateExampleArtifactValue(
      validArtifact,
      location,
      'button',
      'src/components/button/button.examples.json',
      validator,
      {
        ...component,
        hasExamples: false,
        artifacts: { ...component.artifacts, examples: 'wrong.json' },
      },
    );
    expect(issues).toContain(
      'src/components/button/button.examples.json: components.json does not advertise this examples artifact',
    );
    expect(issues).toContain(
      'src/components/button/button.examples.json: manifest artifact path is "wrong.json"',
    );
  });

  it('rejects metadata and code imports outside the public root', async () => {
    const { component, location, validator } = await testContext();
    const issues = validateExampleArtifactValue(
      {
        ...validArtifact,
        import: '@lostgradient/cinder/button',
        examples: [
          {
            ...validArtifact.examples[0],
            code: "import { Button } from '@lostgradient/cinder/button';",
          },
        ],
      },
      location,
      'button',
      'src/components/button/button.examples.json',
      validator,
      component,
    );
    expect(issues).toContain(
      'src/components/button/button.examples.json: import must use public root "@lostgradient/cinder"',
    );
    expect(issues).toContain(
      'src/components/button/button.examples.json: example code must use the public root import "@lostgradient/cinder"',
    );
  });
});
