import { describe, expect, test } from 'bun:test';

import { canBareMount } from '../component-page-live-preview.ts';
import { COMPOSE_ONLY_COMPONENTS, discoverExamples } from '../discover.ts';
import {
  COMPOUND_COMPONENT_FAMILIES,
  COMPOUND_COMPONENT_PARENTS,
  resolvePreviewSourceComponentName,
} from './compound-families.ts';

describe('compound-families registry completeness', () => {
  test('every compound part receives its authored composition instead of missing children or ancestors', async () => {
    for (const [part, parent] of Object.entries(COMPOUND_COMPONENT_PARENTS)) {
      expect(canBareMount(part, false)).toBe(false);
      const source = await resolvePreviewSourceComponentName(part, async (name) => {
        const examples = await discoverExamples(name);
        return examples.length > 0;
      });
      const partExamples = await discoverExamples(part);
      const expected = partExamples.length > 0 ? part : parent;
      expect(source).toBe(expected);
      expect(await discoverExamples(source)).not.toHaveLength(0);
    }
    await expect(resolvePreviewSourceComponentName('button', async () => false)).resolves.toBe(
      'button',
    );
    expect(canBareMount('button', false)).toBe(true);
  });

  test('retains authored Chat and FeedBoundary examples while empty parts use parents', async () => {
    const hasExamples = async (name: string) => {
      const examples = await discoverExamples(name);
      return examples.length > 0;
    };
    await expect(
      resolvePreviewSourceComponentName('chat-composer-popover', hasExamples),
    ).resolves.toBe('chat-composer-popover');
    await expect(
      resolvePreviewSourceComponentName('chat-conversation-header', hasExamples),
    ).resolves.toBe('chat-conversation-header');
    await expect(
      resolvePreviewSourceComponentName('chat-conversation-list', hasExamples),
    ).resolves.toBe('chat-conversation-list');
    await expect(resolvePreviewSourceComponentName('feed-boundary', hasExamples)).resolves.toBe(
      'feed-boundary',
    );
    await expect(
      resolvePreviewSourceComponentName('side-navigation-item', hasExamples),
    ).resolves.toBe('side-navigation');
    await expect(resolvePreviewSourceComponentName('table-cell', hasExamples)).resolves.toBe(
      'table',
    );
    await expect(resolvePreviewSourceComponentName('tree-item', hasExamples)).resolves.toBe('tree');
  });
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
