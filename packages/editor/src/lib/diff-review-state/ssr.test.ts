/**
 * SSR safety (DR-2: "Pure model/state ... SSR-safe, no module-level state").
 *
 * Mirrors the pattern used by `virtual-list.ssr.test.ts`: rather than asserting this
 * structurally, `window` and `document` are removed from `globalThis` for the duration of the
 * test, and every public entry point is exercised while they are gone. Reaching every assertion
 * without throwing proves nothing in this module reaches for a DOM global.
 */
import { describe, expect, test } from 'bun:test';

import { createDiffReviewState } from './create.ts';
import { computeDiffReviewSnapshotId } from './identity.ts';
import { reduceDiffReviewState } from './reduce.ts';
import { restoreDiffReviewState } from './restore.ts';
import { serializeDiffReviewState } from './serialize.ts';
import type { DiffReviewTargetInput } from './types.ts';

function restoreGlobalProperty(
  property: 'document' | 'window',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) Object.defineProperty(globalThis, property, descriptor);
  else Reflect.deleteProperty(globalThis, property);
}

async function withoutDomGlobals<T>(run: () => T): Promise<T> {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: undefined });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
  try {
    return run();
  } finally {
    restoreGlobalProperty('document', documentDescriptor);
    restoreGlobalProperty('window', windowDescriptor);
  }
}

const target: DiffReviewTargetInput = {
  kind: 'source',
  targetId: 't1',
  label: 'src/x.ts',
  patch: 'diff-1',
};

describe('DiffReview state SSR contract', () => {
  test('computes identity with no window or document present', async () => {
    const id = await withoutDomGlobals(() => computeDiffReviewSnapshotId(target));
    expect(id).toBe(computeDiffReviewSnapshotId(target));
  });

  test('creates, reduces, serializes, and restores state entirely without DOM globals', async () => {
    const result = await withoutDomGlobals(() => {
      const created = createDiffReviewState([target]);
      if (!created.ok) throw new Error('expected ok');
      const commented = reduceDiffReviewState(created.value, {
        type: 'create-comment',
        id: 'c1',
        targetId: 't1',
        anchor: { kind: 'file', fileOccurrence: 0 },
        body: 'Feedback',
      });
      if (!commented.ok) throw new Error('expected ok');
      const serialized = serializeDiffReviewState(commented.value);
      const restored = restoreDiffReviewState(serialized, [target]);
      if (!restored.ok) throw new Error('expected ok');
      return restored.value;
    });
    expect(result.comments).toHaveLength(1);
  });

  test('two independent calls never share module-level state', async () => {
    const [first, second] = await withoutDomGlobals(() => {
      const a = createDiffReviewState([target]);
      const b = createDiffReviewState([]);
      if (!a.ok || !b.ok) throw new Error('expected ok');
      return [a.value, b.value] as const;
    });
    expect(first.targets).toHaveLength(1);
    expect(second.targets).toHaveLength(0);
    // Mutating a value from one call's result must never be visible from the other's — this
    // would only be possible if a module scope shared a mutable array/object between calls.
    first.comments.push({} as never);
    expect(second.comments).toHaveLength(0);
  });
});
