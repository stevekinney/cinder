import { describe, expect, test } from 'bun:test';

import { TreeRegistry } from './tree-registry.svelte.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The registry sorts children by document order using compareDocumentPosition.
// In this pure-unit test there is no DOM, so we hand each registration a stub
// node that compares by a monotonically increasing counter — preserving
// registration order in the resulting sibling lists.
let nodeCounter = 0;

function makeStubNode(): HTMLElement {
  const order = nodeCounter++;
  const stub = {
    __order: order,
    compareDocumentPosition(other: HTMLElement) {
      const otherOrder = (other as unknown as { __order: number }).__order;
      if (order < otherOrder) return 0x04; // Node.DOCUMENT_POSITION_FOLLOWING
      if (order > otherOrder) return 0x02; // Node.DOCUMENT_POSITION_PRECEDING
      return 0;
    },
  };
  return stub as unknown as HTMLElement;
}

function makeNode(
  id: string,
  parentId: string | null,
  level: number,
  options: { disabled?: boolean; isBranch?: boolean; label?: string } = {},
) {
  return {
    id,
    parentId,
    level,
    node: makeStubNode(),
    disabled: options.disabled ?? false,
    isBranch: () => options.isBranch ?? false,
    label: () => options.label ?? id,
    focus: () => {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TreeRegistry', () => {
  describe('register / unregister', () => {
    test('registers a node and makes it findable', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('a', null, 1));
      expect(registry.getNode('a')).toBeDefined();
    });

    test('unregister removes the node', () => {
      const registry = new TreeRegistry();
      const unregister = registry.register(makeNode('a', null, 1));
      unregister();
      expect(registry.getNode('a')).toBeUndefined();
    });

    test('unregister removes the id from the children list', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('a', null, 1));
      const unregB = registry.register(makeNode('b', null, 1));
      unregB();
      expect(registry.siblingsOf('a')).toEqual(['a']);
    });

    test('registration order is preserved in sibling list', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('a', null, 1));
      registry.register(makeNode('b', null, 1));
      registry.register(makeNode('c', null, 1));
      expect(registry.siblingsOf('a')).toEqual(['a', 'b', 'c']);
    });

    test('registering a duplicate id throws', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('a', null, 1));
      expect(() => registry.register(makeNode('a', null, 1))).toThrow('[cinder-tree]');
    });

    test('re-registering after unregister succeeds', () => {
      const registry = new TreeRegistry();
      const unregister = registry.register(makeNode('a', null, 1));
      unregister();
      expect(() => registry.register(makeNode('a', null, 1))).not.toThrow();
    });
  });

  describe('getVisible', () => {
    test('returns root-level items in registration order', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('a', null, 1));
      registry.register(makeNode('b', null, 1));
      expect(registry.getVisible([])).toEqual(['a', 'b']);
    });

    test('excludes children of collapsed branches', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('root', null, 1, { isBranch: true }));
      registry.register(makeNode('child', 'root', 2));
      expect(registry.getVisible([])).toEqual(['root']);
    });

    test('includes children of expanded branches', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('root', null, 1, { isBranch: true }));
      registry.register(makeNode('child', 'root', 2));
      expect(registry.getVisible(['root'])).toEqual(['root', 'child']);
    });

    test('DFS ordering: children appear immediately after their parent', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('a', null, 1, { isBranch: true }));
      registry.register(makeNode('a1', 'a', 2));
      registry.register(makeNode('a2', 'a', 2));
      registry.register(makeNode('b', null, 1));
      expect(registry.getVisible(['a'])).toEqual(['a', 'a1', 'a2', 'b']);
    });

    test('nested expansion: only expands nodes that are both a branch and in expandedIds', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('a', null, 1, { isBranch: true }));
      registry.register(makeNode('a1', 'a', 2, { isBranch: true }));
      registry.register(makeNode('a1a', 'a1', 3));
      // a is expanded, a1 is not
      expect(registry.getVisible(['a'])).toEqual(['a', 'a1']);
      // both expanded
      expect(registry.getVisible(['a', 'a1'])).toEqual(['a', 'a1', 'a1a']);
    });

    test('returns empty array when no nodes are registered', () => {
      const registry = new TreeRegistry();
      expect(registry.getVisible([])).toEqual([]);
    });

    test('deep nesting: 6 levels report correctly', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('l1', null, 1, { isBranch: true }));
      registry.register(makeNode('l2', 'l1', 2, { isBranch: true }));
      registry.register(makeNode('l3', 'l2', 3, { isBranch: true }));
      registry.register(makeNode('l4', 'l3', 4, { isBranch: true }));
      registry.register(makeNode('l5', 'l4', 5, { isBranch: true }));
      registry.register(makeNode('l6', 'l5', 6));
      expect(registry.getVisible(['l1', 'l2', 'l3', 'l4', 'l5'])).toEqual([
        'l1',
        'l2',
        'l3',
        'l4',
        'l5',
        'l6',
      ]);
    });

    test('filters by predicate while retaining ancestors of deep matches', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('projects', null, 1, { isBranch: true, label: 'Projects' }));
      registry.register(makeNode('apollo', 'projects', 2, { label: 'Apollo' }));
      registry.register(makeNode('borealis', 'projects', 2, { label: 'Borealis' }));
      registry.register(makeNode('archive', null, 1, { label: 'Archive' }));

      expect(
        registry.getVisible([], (candidate) => candidate.label.toLowerCase().includes('apollo')),
      ).toEqual(['projects', 'apollo']);
    });

    test('filters out matching descendants of unregistered branches deterministically', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('projects', null, 1, { isBranch: true, label: 'Projects' }));
      registry.register(makeNode('archive', null, 1, { label: 'Archive' }));

      expect(
        registry.getVisible([], (candidate) => candidate.label.toLowerCase().includes('apollo')),
      ).toEqual([]);
    });
  });

  describe('parentOf', () => {
    test('returns parentId for a registered node', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('child', 'parent', 2));
      expect(registry.parentOf('child')).toBe('parent');
    });

    test('returns null for root-level nodes', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('root', null, 1));
      expect(registry.parentOf('root')).toBeNull();
    });

    test('returns undefined for unknown ids', () => {
      const registry = new TreeRegistry();
      expect(registry.parentOf('nonexistent')).toBeUndefined();
    });
  });

  describe('firstChildOf', () => {
    test('returns first registered child', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('parent', null, 1, { isBranch: true }));
      registry.register(makeNode('child1', 'parent', 2));
      registry.register(makeNode('child2', 'parent', 2));
      expect(registry.firstChildOf('parent')).toBe('child1');
    });

    test('returns undefined for leaf nodes', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('leaf', null, 1));
      expect(registry.firstChildOf('leaf')).toBeUndefined();
    });
  });

  describe('childrenOf', () => {
    test('returns root children in document order', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('a', null, 1));
      registry.register(makeNode('b', null, 1));
      expect(registry.childrenOf(null)).toEqual(['a', 'b']);
    });

    test('returns nested children in document order', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('parent', null, 1, { isBranch: true }));
      registry.register(makeNode('a', 'parent', 2));
      registry.register(makeNode('b', 'parent', 2));
      expect(registry.childrenOf('parent')).toEqual(['a', 'b']);
    });

    test('returns empty array for unknown parent ids', () => {
      const registry = new TreeRegistry();
      expect(registry.childrenOf('missing')).toEqual([]);
    });
  });

  describe('descendantsOf', () => {
    test('returns nested descendants in depth-first order', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('parent', null, 1, { isBranch: true }));
      registry.register(makeNode('a', 'parent', 2, { isBranch: true }));
      registry.register(makeNode('a1', 'a', 3));
      registry.register(makeNode('b', 'parent', 2));
      expect(registry.descendantsOf('parent')).toEqual(['a', 'a1', 'b']);
    });

    test('does not invent collapsed or unregistered descendants', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('parent', null, 1, { isBranch: true }));
      expect(registry.descendantsOf('parent')).toEqual([]);
    });

    test('returns empty array for unknown parent ids', () => {
      const registry = new TreeRegistry();
      expect(registry.descendantsOf('missing')).toEqual([]);
    });
  });

  describe('siblingsOf', () => {
    test('returns all siblings including self', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('parent', null, 1, { isBranch: true }));
      registry.register(makeNode('a', 'parent', 2));
      registry.register(makeNode('b', 'parent', 2));
      registry.register(makeNode('c', 'parent', 2));
      expect(registry.siblingsOf('b')).toEqual(['a', 'b', 'c']);
    });

    test('returns empty array for unknown id', () => {
      const registry = new TreeRegistry();
      expect(registry.siblingsOf('nonexistent')).toEqual([]);
    });
  });

  describe('typeaheadMatch', () => {
    test('finds next item starting with prefix after current', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('apple', null, 1, { label: 'Apple' }));
      registry.register(makeNode('banana', null, 1, { label: 'Banana' }));
      registry.register(makeNode('avocado', null, 1, { label: 'Avocado' }));
      // Currently on 'apple', pressing 'a' should go to 'avocado' (next 'a' after current)
      expect(registry.typeaheadMatch('a', 'apple', [])).toBe('avocado');
    });

    test('wraps around to find earlier match', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('apple', null, 1, { label: 'Apple' }));
      registry.register(makeNode('banana', null, 1, { label: 'Banana' }));
      registry.register(makeNode('avocado', null, 1, { label: 'Avocado' }));
      // Currently on 'avocado', press 'a' — wraps to 'apple'
      expect(registry.typeaheadMatch('a', 'avocado', [])).toBe('apple');
    });

    test('is case-insensitive', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('a', null, 1, { label: 'Apple' }));
      registry.register(makeNode('b', null, 1, { label: 'Banana' }));
      expect(registry.typeaheadMatch('A', 'b', [])).toBe('a');
    });

    test('multi-char prefix narrows match', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('aardvark', null, 1, { label: 'Aardvark' }));
      registry.register(makeNode('apple', null, 1, { label: 'Apple' }));
      registry.register(makeNode('apricot', null, 1, { label: 'Apricot' }));
      // 'ap' should match 'apple' before 'apricot'
      expect(registry.typeaheadMatch('ap', 'aardvark', [])).toBe('apple');
    });

    test('returns undefined when no match exists', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('a', null, 1, { label: 'Apple' }));
      expect(registry.typeaheadMatch('z', 'a', [])).toBeUndefined();
    });

    test('respects visible order (skips collapsed children)', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('parent', null, 1, { isBranch: true, label: 'Parent' }));
      registry.register(makeNode('child', 'parent', 2, { label: 'Zebra' }));
      registry.register(makeNode('other', null, 1, { label: 'Zoom' }));
      // 'child' is not visible (parent collapsed), 'z' should match 'other'
      expect(registry.typeaheadMatch('z', 'parent', [])).toBe('other');
    });

    test('disabled items are skipped by typeahead', () => {
      const registry = new TreeRegistry();
      registry.register(makeNode('a', null, 1, { label: 'Apple', disabled: true }));
      registry.register(makeNode('b', null, 1, { label: 'Banana' }));
      registry.register(makeNode('c', null, 1, { label: 'Apricot' }));

      expect(registry.typeaheadMatch('a', 'b', [])).toBe('c');
    });
  });
});
