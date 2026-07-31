import { describe, expect, it } from 'bun:test';

import { findNeighbourRationaleViolations } from './check-component-inventory.ts';

describe('findNeighbourRationaleViolations', () => {
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
      findNeighbourRationaleViolations({
        id: 'new-component',
        related: [],
        avoidWhen: [],
        source:
          '<script module>/**\n * @cinder\n * @rationale Nearest alternative: button, which has a different interaction contract.\n */</script>',
      }),
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

  it('preserves punctuation and emphasis in a metadata rationale', () => {
    expect(
      findNeighbourRationaleViolations({
        id: 'new-component',
        related: [],
        avoidWhen: [],
        source:
          '<script module>/**\n * @cinder\n * @rationale Nearest alternative: **button** — use it for emphasis.\n */</script>',
      }),
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
      findNeighbourRationaleViolations({
        id: 'new-component',
        related: [],
        avoidWhen: [],
        source:
          '<script module>/**\n * @cinder\n * @rationale Nearest alternative:\n * button has a different interaction contract.\n */</script>',
      }),
    ).toEqual([]);
  });

  it('accepts natural prose that names the nearest alternative', () => {
    expect(
      findNeighbourRationaleViolations({
        id: 'new-component',
        related: [],
        avoidWhen: [],
        source:
          '<script module>/**\n * @cinder\n * @rationale The nearest alternative is button, but it has a different contract.\n */</script>',
      }),
    ).toEqual([]);
  });
});
