import { describe, expect, test } from 'bun:test';

import { schemaPropertyNames } from './component-documentation-reference.ts';

describe('schemaPropertyNames', () => {
  test('sorts schema properties without requiring ES2023 Array.prototype.toSorted', () => {
    const arrayPrototype = Array.prototype as Array<unknown> & { toSorted?: unknown };
    const originalToSorted = arrayPrototype.toSorted;
    Reflect.deleteProperty(arrayPrototype, 'toSorted');

    try {
      expect(
        schemaPropertyNames({
          type: 'object',
          properties: {
            zebra: { type: 'string' },
            alpha: { type: 'string' },
          },
        }),
      ).toEqual(['alpha', 'zebra']);
    } finally {
      if (originalToSorted !== undefined) {
        arrayPrototype.toSorted = originalToSorted;
      }
    }
  });
});
