import { expect, test } from 'bun:test';
import { inventoryFromSources, type Inventory } from './css-usage-inventory';
import { observedUsageProperties } from './reviewed-css-usage';

const properties = new Set(['--cinder-color', '--cinder-space']);
function fixture() {
  const inventory = inventoryFromSources(
    [
      {
        path: 'component.svelte',
        content: '<div style:color={color} style="padding:var(--cinder-space)"></div>',
      },
      { path: 'producer.ts', content: 'export const color = "var(--cinder-color)";' },
    ],
    properties,
  );
  const review = {
    schemaVersion: 1,
    sourceFiles: inventory.sourceFiles,
    producerEvidence: inventory.sourceFiles.filter((source) => source.path === 'producer.ts'),
    surfaces: inventory.dynamic.map((identity) => ({
      identity,
      category: 'shipped-public-token-mapping',
      reason: 'The imported color producer returns the public color reference.',
      reviewStatus: 'reviewed',
      producer: {
        path: 'producer.ts',
        line: 1,
        description: 'Literal exported color.',
        emitsPublicVar: true,
        status: 'reviewed',
      },
      mappings: [{ tokenProperty: '--cinder-color', property: 'color' }],
    })),
  };
  return { inventory, review };
}

test('combines observed static declarations and reviewed dynamic producer mappings', () => {
  const { inventory, review } = fixture();
  expect(inventory.dynamic.length).toBeGreaterThan(0);
  expect(observedUsageProperties(inventory, review, properties)).toEqual(
    new Map([
      ['--cinder-color', ['color']],
      ['--cinder-space', ['padding']],
    ]),
  );
});

test('caller-controlled values never invent a token binding', () => {
  const { inventory, review } = fixture();
  for (const surface of review.surfaces) {
    surface.category = 'caller-controlled-style-color-input';
    surface.mappings = [];
  }
  expect(observedUsageProperties(inventory, review, properties).has('--cinder-color')).toBe(false);
});

test.each(['missing', 'changed', 'duplicate', 'unreviewed'] as const)(
  'rejects %s dynamic review',
  (change) => {
    const { inventory, review } = fixture();
    if (change === 'missing') review.surfaces = [];
    if (change === 'changed')
      review.surfaces[0]!.identity = { ...review.surfaces[0]!.identity, expression: '{other}' };
    if (change === 'duplicate') review.surfaces.push(structuredClone(review.surfaces[0]!));
    if (change === 'unreviewed') review.surfaces[0]!.reviewStatus = 'unreviewed';
    expect(() => observedUsageProperties(inventory, review, properties)).toThrow();
  },
);

test('new dynamic sinks require review even when existing reviews are valid', () => {
  const { inventory, review } = fixture();
  inventory.dynamic.push({ ...inventory.dynamic[0]!, line: 2, expression: '{newColor}' });
  expect(() => observedUsageProperties(inventory, review, properties)).toThrow(
    'Missing dynamic CSS review',
  );
});

test('every producer chain link needs evidence from the scanned source', () => {
  const { inventory, review } = fixture();
  const chainedReview = structuredClone(review);
  const producer = chainedReview.surfaces[0]!.producer;
  Object.assign(producer, {
    chain: [{ path: 'missing.ts', line: 1, description: 'Transitive color source.' }],
  });
  expect(() => observedUsageProperties(inventory, chainedReview, properties)).toThrow(
    'Missing CSS producer chain evidence',
  );
  Object.assign(producer, {
    chain: [{ path: 'producer.ts', line: 1, description: 'Transitive color source.' }],
  });
  expect(
    observedUsageProperties(inventory, chainedReview, properties).get('--cinder-color'),
  ).toEqual(['color']);
});

test.each(['source', 'producer', 'missing evidence'] as const)(
  'rejects changed or missing %s hashes',
  (change) => {
    const { inventory, review } = fixture();
    if (change === 'missing evidence') {
      review.producerEvidence = [];
      review.sourceFiles = review.sourceFiles.filter((source) => source.path !== 'producer.ts');
    } else
      inventory.sourceFiles = inventory.sourceFiles.map((source) => ({
        ...source,
        sha256:
          source.path === (change === 'source' ? 'component.svelte' : 'producer.ts')
            ? '0'.repeat(64)
            : source.sha256,
      }));
    expect(() => observedUsageProperties(inventory, review, properties)).toThrow();
  },
);

test.each([
  'unknown token',
  'private property',
  'contradictory producer',
  'empty mappings',
] as const)('rejects %s mappings', (change) => {
  const { inventory, review } = fixture();
  if (change === 'unknown token')
    review.surfaces[0]!.mappings[0]!.tokenProperty = '--cinder-unknown';
  if (change === 'private property') review.surfaces[0]!.mappings[0]!.property = '--_private';
  if (change === 'contradictory producer') review.surfaces[0]!.producer.emitsPublicVar = false;
  if (change === 'empty mappings') review.surfaces[0]!.mappings = [];
  expect(() => observedUsageProperties(inventory, review, properties)).toThrow();
});

test.each(['cycle', 'parse-error', 'unsupported-surface'] as const)(
  'rejects unaccounted %s diagnostics',
  (kind) => {
    const { inventory, review } = fixture();
    inventory.diagnostics.push({
      file: 'new.ts',
      line: 1,
      column: 1,
      kind,
      reason: 'Unaccounted source.',
    });
    expect(() => observedUsageProperties(inventory, review, properties)).toThrow();
  },
);

test('accepts a static-only corpus and requires no dynamic review exemptions', () => {
  const inventory: Inventory = {
    schemaVersion: 1,
    uses: [],
    dynamic: [],
    diagnostics: [],
    sourceFiles: [],
  };
  expect(
    observedUsageProperties(
      inventory,
      { schemaVersion: 1, surfaces: [], sourceFiles: [], producerEvidence: [] },
      properties,
    ).size,
  ).toBe(0);
});

test.each([null, [], {}, { schemaVersion: 2 }].map((review) => ({ review })))(
  'rejects malformed review input %j',
  ({ review }) => {
    expect(() => observedUsageProperties(fixture().inventory, review, properties)).toThrow(
      'CSS usage review',
    );
  },
);
