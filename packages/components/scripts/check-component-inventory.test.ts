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
          '@rationale Nearest alternative: button, which has a different interaction contract.',
      }),
    ).toEqual([]);
  });
});
