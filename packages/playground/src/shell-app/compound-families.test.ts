import { describe, expect, test } from 'bun:test';

import { COMPOSE_ONLY_COMPONENTS } from '../discover.ts';
import { COMPOUND_COMPONENT_FAMILIES, COMPOUND_COMPONENT_PARENTS } from './compound-families.ts';

describe('compound-families registry completeness', () => {
  test('every compose-only leaf has a parent entry', () => {
    for (const leaf of COMPOSE_ONLY_COMPONENTS) {
      expect(COMPOUND_COMPONENT_PARENTS[leaf]).toBeDefined();
    }
  });

  test('every family root has a non-empty children list, and every child points back to it', () => {
    for (const [root, children] of Object.entries(COMPOUND_COMPONENT_FAMILIES)) {
      expect(children.length).toBeGreaterThan(0);
      for (const child of children) {
        expect(COMPOUND_COMPONENT_PARENTS[child]).toBe(root);
      }
    }
  });

  test('every parent entry appears in the matching family children list', () => {
    // The test above walks FAMILIES -> PARENTS; this walks the inverse direction,
    // PARENTS -> FAMILIES, so a stray or mistyped COMPOUND_COMPONENT_PARENTS entry
    // whose root has no matching FAMILIES entry (or whose child is missing from
    // that root's array) fails here even though it would pass the test above.
    for (const [child, root] of Object.entries(COMPOUND_COMPONENT_PARENTS)) {
      expect(COMPOUND_COMPONENT_FAMILIES[root]).toBeDefined();
      expect(COMPOUND_COMPONENT_FAMILIES[root]).toContain(child);
    }
  });
});
