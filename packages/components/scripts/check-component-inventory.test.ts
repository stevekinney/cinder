import { describe, expect, it } from 'bun:test';

import {
  findNeighbourRationaleViolations,
  isCanonicalInventoryComponent,
} from './check-component-inventory.ts';

describe('isCanonicalInventoryComponent', () => {
  it('checks canonical components and excludes experimental components', () => {
    expect(isCanonicalInventoryComponent({ isExperimental: false })).toBe(true);
    expect(isCanonicalInventoryComponent({ isExperimental: true })).toBe(false);
  });
});

describe('findNeighbourRationaleViolations', () => {
  const knownComponentIds = new Set(['button', 'new-component']);

  it('rejects a component with no neighbour rationale', () => {
    expect(
      findNeighbourRationaleViolations({
        id: 'new-component',
        related: [],
        avoidWhen: [],
        source: '@purpose A new component.',
      }),
    ).toEqual([
      expect.objectContaining({
        id: 'new-component',
        reason: expect.stringContaining('@related'),
      }),
    ]);
  });

  it('accepts related and avoidWhen metadata', () => {
    expect(
      findNeighbourRationaleViolations({
        id: 'new-component',
        related: ['button'],
        avoidWhen: [{ reason: 'Use a button instead.' }],
        source: '@related button\n@avoidWhen Use a button instead.',
      }),
    ).toEqual([]);
  });

  it('accepts an explicit rationale naming the nearest alternative', () => {
    expect(
      findNeighbourRationaleViolations(
        {
          id: 'new-component',
          related: [],
          avoidWhen: [],
          source:
            '<script module>/**\n * @cinder\n * @rationale Nearest alternative: button, which has a different interaction contract.\n */</script>',
        },
        knownComponentIds,
      ),
    ).toEqual([]);
  });

  it('ignores rationale text outside the canonical metadata block', () => {
    expect(
      findNeighbourRationaleViolations({
        id: 'new-component',
        related: [],
        avoidWhen: [],
        source: '<script>const note = "@rationale Nearest alternative: button";</script>',
      }),
    ).toHaveLength(1);
  });

  it('ignores rationale text before the @cinder marker', () => {
    expect(
      findNeighbourRationaleViolations({
        id: 'new-component',
        related: [],
        avoidWhen: [],
        source:
          '<script module>/**\n * @rationale Nearest alternative: button\n * @cinder\n * @purpose A component.\n */</script>',
      }),
    ).toHaveLength(1);
  });

  it('uses only the canonical case-sensitive @cinder marker', () => {
    expect(
      findNeighbourRationaleViolations(
        {
          id: 'new-component',
          related: [],
          avoidWhen: [],
          source:
            '<script module>/**\n * @Cinder\n * @rationale Nearest alternative: button\n */\n/**\n * @cinder\n * @purpose A component.\n */</script>',
        },
        knownComponentIds,
      ),
    ).toHaveLength(1);
  });

  it('rejects a self-reference in @related metadata', () => {
    expect(
      findNeighbourRationaleViolations({
        id: 'new-component',
        related: ['new-component'],
        avoidWhen: [{ reason: 'Use something else.' }],
        source: '',
      }),
    ).toHaveLength(1);
  });

  it('preserves punctuation and emphasis in a metadata rationale', () => {
    expect(
      findNeighbourRationaleViolations(
        {
          id: 'new-component',
          related: [],
          avoidWhen: [],
          source:
            '<script module>/**\n * @cinder\n * @rationale Nearest alternative: **button** — use it for emphasis.\n */</script>',
        },
        knownComponentIds,
      ),
    ).toEqual([]);
  });

  it('rejects an empty explicit alternative marker', () => {
    expect(
      findNeighbourRationaleViolations({
        id: 'new-component',
        related: [],
        avoidWhen: [],
        source: '<script module>/**\n * @cinder\n * @rationale Nearest alternative:\n */</script>',
      }),
    ).toHaveLength(1);
  });

  it('accepts a rationale whose named alternative wraps onto a continuation line', () => {
    expect(
      findNeighbourRationaleViolations(
        {
          id: 'new-component',
          related: [],
          avoidWhen: [],
          source:
            '<script module>/**\n * @cinder\n * @rationale Nearest alternative:\n * button has a different interaction contract.\n */</script>',
        },
        knownComponentIds,
      ),
    ).toEqual([]);
  });

  it('accepts natural prose that names the nearest alternative', () => {
    expect(
      findNeighbourRationaleViolations(
        {
          id: 'new-component',
          related: [],
          avoidWhen: [],
          source:
            '<script module>/**\n * @cinder\n * @rationale The nearest alternative is button, but it has a different contract.\n */</script>',
        },
        knownComponentIds,
      ),
    ).toEqual([]);
  });

  it('rejects a rationale whose named alternative is not a known component', () => {
    expect(
      findNeighbourRationaleViolations(
        {
          id: 'new-component',
          related: [],
          avoidWhen: [],
          source:
            '<script module>/**\n * @cinder\n * @rationale Nearest alternative: buton, which has a different contract.\n */</script>',
        },
        knownComponentIds,
      ),
    ).toHaveLength(1);
  });

  it('rejects the scaffold placeholder until an author names a known neighbour', () => {
    expect(
      findNeighbourRationaleViolations(
        {
          id: 'new-component',
          related: [],
          avoidWhen: [{ reason: 'TODO: describe when a different component fits better.' }],
          source:
            '<script module>/**\n * @cinder\n * @rationale Nearest alternative: TODO — name the nearest component.\n */</script>',
        },
        knownComponentIds,
      ),
    ).toHaveLength(1);
  });

  it('rejects a rationale that names the component itself', () => {
    expect(
      findNeighbourRationaleViolations(
        {
          id: 'new-component',
          related: [],
          avoidWhen: [],
          source:
            '<script module>/**\n * @cinder\n * @rationale Nearest alternative: new-component.\n */</script>',
        },
        knownComponentIds,
      ),
    ).toHaveLength(1);
  });

  it('accepts an inline @cinder header with a valid rationale', () => {
    expect(
      findNeighbourRationaleViolations(
        {
          id: 'new-component',
          related: [],
          avoidWhen: [],
          source:
            '<script module>/** @cinder\n * @rationale Nearest alternative: button.\n */</script>',
        },
        knownComponentIds,
      ),
    ).toEqual([]);
  });
});
