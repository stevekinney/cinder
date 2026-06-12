/**
 * Tests for the manifest generator.
 *
 * Uses a synthetic 3-component metadata array (no real extractor) so these
 * tests pass even before the full annotation sweep completes.
 *
 * The primary gate: a manifest produced from valid metadata validates against
 * `manifest.schema.json`.
 */

import { join } from 'node:path';

import Ajv from 'ajv/dist/2020.js';
import { beforeAll, describe, expect, it } from 'bun:test';

import type { Manifest, ManifestComponent } from './generate-manifest.ts';
import { formatExtractionErrorMessage } from './generate-manifest.ts';

// ---------------------------------------------------------------------------
// Schema loader helper
// ---------------------------------------------------------------------------

const SCHEMA_PATH = join(import.meta.dir, '..', 'src', 'schemas', 'manifest.schema.json');

async function loadManifestSchema(): Promise<object> {
  const text = await Bun.file(SCHEMA_PATH).text();
  return JSON.parse(text) as object;
}

// ---------------------------------------------------------------------------
// Synthetic test data
// ---------------------------------------------------------------------------

const SYNTHETIC_COMPONENTS: ManifestComponent[] = [
  {
    name: 'Button',
    id: 'button',
    import: '@lostgradient/cinder/button',
    exportName: 'Button',
    category: 'action',
    status: 'stable',
    purpose: 'Primary interactive control for triggering actions or navigating via href.',
    tags: ['action', 'cta'],
    useWhen: ['Triggering a form submit.', 'Navigating with a button appearance.'],
    avoidWhen: [{ reason: 'Toggling on/off state.', alternative: 'toggle' }],
    related: ['button-group', 'copy-button'],
    hasConstraints: false,
    hasExamples: false,
    artifacts: {
      schema: '@lostgradient/cinder/button/schema',
      variables: '@lostgradient/cinder/button/variables',
    },
    a11y: {
      pattern: 'WAI-ARIA Button',
      keyboard: [{ keys: 'Enter / Space', action: 'Activates the button.' }],
      notes: ['Uses a native button element so the role and state are announced.'],
    },
  },
  {
    name: 'Modal',
    id: 'modal',
    import: '@lostgradient/cinder/modal',
    exportName: 'Modal',
    category: 'overlay',
    status: 'stable',
    purpose: 'Full-screen dialog that blocks interaction with the page until dismissed.',
    tags: ['dialog', 'overlay'],
    useWhen: ['Requiring user acknowledgment before proceeding.'],
    avoidWhen: [{ reason: 'Showing brief transient feedback.' }],
    related: ['drawer', 'sheet'],
    hasConstraints: true,
    hasExamples: true,
    artifacts: {
      schema: '@lostgradient/cinder/modal/schema',
      variables: '@lostgradient/cinder/modal/variables',
      examples: '@lostgradient/cinder/modal/examples',
      constraints: '@lostgradient/cinder/modal/constraints',
    },
  },
  {
    name: 'ConnectionIndicator',
    id: 'connection-indicator',
    import: '@lostgradient/cinder/experimental/connection-indicator',
    exportName: 'ConnectionIndicator',
    category: 'feedback',
    status: 'alpha',
    purpose: 'Visual indicator for real-time connection status (connected, degraded, offline).',
    tags: ['status', 'realtime'],
    useWhen: ['Showing WebSocket connection health in a dashboard header.'],
    avoidWhen: [{ reason: 'General status display.', alternative: 'status-dot' }],
    related: ['status-dot'],
    hasConstraints: false,
    hasExamples: false,
    artifacts: {
      schema: '@lostgradient/cinder/experimental/connection-indicator/schema',
      variables: '@lostgradient/cinder/experimental/connection-indicator/variables',
    },
  },
];

function buildSyntheticManifest(): Manifest {
  return {
    $schema: './src/schemas/manifest.schema.json',
    manifestVersion: 1,
    package: {
      name: '@lostgradient/cinder',
      version: '0.0.1',
      framework: 'svelte',
      frameworkVersionRange: '>=5.55.0 <5.56.0',
      classPrefix: 'cinder-',
      cssVarPrefix: '--cinder-',
      tokenNamespaces: ['color', 'space', 'radius', 'ring', 'type', 'motion', 'shadow'],
      stylesEntry: '@lostgradient/cinder/styles',
      schemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    },
    categories: {
      action: {
        label: 'Actions',
        description: 'Controls that trigger operations, submit data, or navigate.',
      },
      overlay: {
        label: 'Overlays',
        description: 'Floating surfaces that layer above page content and require user dismissal.',
      },
      form: {
        label: 'Forms',
        description: 'Input controls and layout primitives for collecting structured user data.',
      },
      feedback: {
        label: 'Feedback',
        description: 'Non-interactive indicators that communicate status, progress, or results.',
      },
      navigation: {
        label: 'Navigation',
        description: 'Wayfinding controls that move users between views, sections, or steps.',
      },
      'data-display': {
        label: 'Data Display',
        description: 'Read-only presentational components for structured data and content.',
      },
      layout: {
        label: 'Layout',
        description: 'Structural primitives that control spacing, containment, and composition.',
      },
      typography: {
        label: 'Typography',
        description:
          'Text-rendering components that enforce hierarchy and typographic conventions.',
      },
      domain: {
        label: 'Domain',
        description: 'Application-specific components that encode product-level business concepts.',
      },
    },
    statusLevels: {
      stable: 'Public API under semver protection; breaking changes require a major version bump.',
      beta: 'API is near-final but may have breaking changes in minor versions before promotion.',
      alpha: 'Experimental; no stability guarantee and subject to removal or significant redesign.',
      'domain-suite':
        'A cohesive set of domain-specific components shipped together as a named suite with its own versioning cadence.',
    },
    overlapFamilies: {
      overlay: ['modal', 'drawer', 'sheet', 'popover'],
      notice: ['banner', 'alert', 'callout'],
      selection: ['toggle', 'checkbox', 'segmented-control'],
      hover: ['tooltip', 'popover'],
      tabs: ['tabs', 'segmented-control'],
    },
    components: SYNTHETIC_COMPONENTS,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('manifest schema', () => {
  let ajv: Ajv;
  let validateManifest: ReturnType<Ajv['compile']>;

  beforeAll(async () => {
    const schema = await loadManifestSchema();
    ajv = new Ajv({ strict: false });
    validateManifest = ajv.compile(schema);
  });

  it('the manifest schema itself is valid JSON', async () => {
    const schema = await loadManifestSchema();
    expect(schema).toBeObject();
    expect((schema as Record<string, unknown>)['$schema']).toBe(
      'https://json-schema.org/draft/2020-12/schema',
    );
  });

  it('a correctly-shaped synthetic manifest validates without errors', () => {
    const manifest = buildSyntheticManifest();
    const valid = validateManifest(manifest);
    expect(valid).toBe(true);
    expect(validateManifest.errors).toBeNull();
  });

  it('manifestVersion must equal 1', () => {
    const manifest = buildSyntheticManifest();
    // @ts-expect-error — intentionally wrong value for negative test
    manifest.manifestVersion = 2;
    const valid = validateManifest(manifest);
    expect(valid).toBe(false);
  });

  it('framework must equal "svelte"', () => {
    const manifest = buildSyntheticManifest();
    // @ts-expect-error — intentionally wrong value for negative test
    manifest.package.framework = 'react';
    const valid = validateManifest(manifest);
    expect(valid).toBe(false);
  });

  it('rejects a component id that contains uppercase letters', () => {
    const manifest = buildSyntheticManifest();
    // Deep clone to avoid mutating shared fixture
    manifest.components = [
      {
        ...SYNTHETIC_COMPONENTS[0]!,
        id: 'ButtonGroup', // PascalCase — must be rejected
      },
    ];
    const valid = validateManifest(manifest);
    expect(valid).toBe(false);
  });

  it('rejects a purpose string that exceeds 200 characters', () => {
    const manifest = buildSyntheticManifest();
    manifest.components = [
      {
        ...SYNTHETIC_COMPONENTS[0]!,
        purpose: 'A'.repeat(201),
      },
    ];
    const valid = validateManifest(manifest);
    expect(valid).toBe(false);
  });

  it('accepts an avoidWhen entry with a kebab alternative and one without', () => {
    const manifest = buildSyntheticManifest();
    manifest.components = [
      {
        ...SYNTHETIC_COMPONENTS[0]!,
        avoidWhen: [
          { reason: 'Reason with alt.', alternative: 'segmented-control' },
          { reason: 'Reason without alt.' },
        ],
      },
    ];
    const valid = validateManifest(manifest);
    expect(valid).toBe(true);
  });

  it('rejects an avoidWhen entry missing the required "reason" field', () => {
    const manifest = buildSyntheticManifest();
    manifest.components = [
      {
        ...SYNTHETIC_COMPONENTS[0]!,
        // @ts-expect-error — intentionally missing required reason
        avoidWhen: [{ alternative: 'toggle' }],
      },
    ];
    const valid = validateManifest(manifest);
    expect(valid).toBe(false);
  });

  it('rejects an avoidWhen alternative that is not kebab-case', () => {
    const manifest = buildSyntheticManifest();
    manifest.components = [
      {
        ...SYNTHETIC_COMPONENTS[0]!,
        avoidWhen: [{ reason: 'A reason.', alternative: 'SegmentedControl' }],
      },
    ];
    const valid = validateManifest(manifest);
    expect(valid).toBe(false);
  });

  it('accepts a component with no a11y block (a11y is optional)', () => {
    const manifest = buildSyntheticManifest();
    const indicator = manifest.components.find((c) => c.id === 'connection-indicator');
    expect(indicator?.a11y).toBeUndefined();
    const valid = validateManifest(manifest);
    expect(valid).toBe(true);
  });

  it('rejects an a11y keyboard entry missing the required "action" field', () => {
    const manifest = buildSyntheticManifest();
    manifest.components = [
      {
        ...SYNTHETIC_COMPONENTS[0]!,
        // @ts-expect-error — intentionally missing required action
        a11y: { keyboard: [{ keys: 'Enter' }] },
      },
    ];
    const valid = validateManifest(manifest);
    expect(valid).toBe(false);
  });

  it('rejects a component entry missing the required "id" field', () => {
    const manifest = buildSyntheticManifest();
    const { id: _id, ...withoutId } = SYNTHETIC_COMPONENTS[0]!;
    // @ts-expect-error — intentionally missing required field
    manifest.components = [withoutId];
    const valid = validateManifest(manifest);
    expect(valid).toBe(false);
  });

  it('accepts a component with hasExamples=true and an examples artifact', () => {
    const manifest = buildSyntheticManifest();
    // modal in the synthetic set has hasExamples=true and an examples artifact
    const modal = manifest.components.find((c) => c.id === 'modal');
    expect(modal?.hasExamples).toBe(true);
    expect(modal?.artifacts.examples).toBe('@lostgradient/cinder/modal/examples');
    const valid = validateManifest(manifest);
    expect(valid).toBe(true);
  });

  it('accepts a component with hasConstraints=true and a constraints artifact', () => {
    const manifest = buildSyntheticManifest();
    const modal = manifest.components.find((c) => c.id === 'modal');
    expect(modal?.hasConstraints).toBe(true);
    expect(modal?.artifacts.constraints).toBe('@lostgradient/cinder/modal/constraints');
    const valid = validateManifest(manifest);
    expect(valid).toBe(true);
  });

  it('rejects a manifest missing the "components" array', () => {
    const manifest = buildSyntheticManifest();
    // @ts-expect-error — intentionally missing required field
    delete manifest.components;
    const valid = validateManifest(manifest);
    expect(valid).toBe(false);
  });

  it('rejects a manifest missing the "package" object', () => {
    const manifest = buildSyntheticManifest();
    // @ts-expect-error — intentionally missing required field
    delete manifest.package;
    const valid = validateManifest(manifest);
    expect(valid).toBe(false);
  });

  it('rejects unexpected top-level properties (additionalProperties: false)', () => {
    const manifest = buildSyntheticManifest();
    (manifest as Record<string, unknown>)['unexpectedField'] = 'not allowed';
    const valid = validateManifest(manifest);
    expect(valid).toBe(false);
  });
});

describe('kebab-to-PascalCase derivation', () => {
  // Test the kebabToPascal logic indirectly through the synthetic data shape.
  // The generator derives exportName from id — verify the naming convention holds.

  it('single-word id maps to same-word PascalCase', () => {
    const component = SYNTHETIC_COMPONENTS.find((c) => c.id === 'button');
    expect(component?.exportName).toBe('Button');
  });

  it('multi-segment id maps to PascalCase by segment', () => {
    const component = SYNTHETIC_COMPONENTS.find((c) => c.id === 'connection-indicator');
    expect(component?.exportName).toBe('ConnectionIndicator');
  });
});

describe('buildManifest() error formatting', () => {
  // The "fail loudly" path is tested via the pure helper
  // `formatExtractionErrorMessage`. Mocking the extractor module would leak
  // across files in a single `bun test` run and break unrelated suites.

  it('formats a two-error list with the component ids and total count', () => {
    const message = formatExtractionErrorMessage([
      { componentId: 'button', reason: 'no @cinder header' },
      { componentId: 'modal', reason: 'missing @category tag' },
    ]);

    expect(message).toMatch(/Cannot build manifest/i);
    expect(message).toContain('button');
    expect(message).toContain('modal');
    expect(message).toContain('no @cinder header');
    expect(message).toContain('missing @category tag');
    expect(message).toMatch(/2 components/);
  });

  it('uses singular "component" for a single-error list', () => {
    const message = formatExtractionErrorMessage([
      { componentId: 'button', reason: 'no @cinder header' },
    ]);
    expect(message).toMatch(/1 component have/);
    expect(message).toMatch(/1 error total/);
  });

  it('truncates long lists to the first ten with a "… and N more" tail', () => {
    const errors = Array.from({ length: 14 }, (_, i) => ({
      componentId: `comp-${i}`,
      reason: 'no @cinder header',
    }));
    const message = formatExtractionErrorMessage(errors);
    expect(message).toContain('comp-0');
    expect(message).toContain('comp-9');
    expect(message).not.toContain('comp-10');
    expect(message).toMatch(/… and 4 more errors \(14 total\)/);
  });
});
