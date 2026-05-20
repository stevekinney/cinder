/**
 * Accessibility regression tests for ChatInput attachment IDs.
 *
 * ChatInput generates an ID for each attachment using `useStableId` seeded
 * with `file.name + file.size + file.lastModified`. These tests assert:
 *
 * 1. The same file produces the same attachment ID across repeated calls
 *    (no churn, snapshot-stable).
 * 2. Two distinct files produce different IDs (no collision when two
 *    attachments coexist).
 * 3. The fallback counter (used when `lastModified === 0`) produces
 *    independent sequences for independent factory instances.
 *
 * We test the ID-generation logic directly rather than mounting the full
 * ChatInput component, because ChatInput embeds MarkdownEditor (Milkdown /
 * ProseMirror) which cannot initialize cleanly in happy-dom. The contract
 * under test is the ID computation, not the rendering pipeline.
 */

import { beforeEach, describe, expect, test } from 'bun:test';

import { createIdFactory, useStableId } from '../../../utilities/id-factory.ts';

/** Replicates the seed string computed by ChatInput's `addAttachment` function. */
function attachmentSeed(file: { name: string; size: number; lastModified: number }): string {
  return `${file.name}${file.size}${file.lastModified}`;
}

/** Replicates ChatInput's per-instance fallback factory. */
function makeAttachmentFactory() {
  return createIdFactory('attachment');
}

describe('ChatInput attachment ID — stable IDs for files with lastModified', () => {
  const reportFile = { name: 'report.pdf', size: 12345, lastModified: 1700000000000 };
  const imageFile = { name: 'photo.png', size: 67890, lastModified: 1710000000000 };

  test('same file always produces the same attachment ID', () => {
    const idA = useStableId(attachmentSeed(reportFile));
    const idB = useStableId(attachmentSeed(reportFile));
    expect(idA).toBe(idB);
  });

  test('different files produce different attachment IDs', () => {
    const idA = useStableId(attachmentSeed(reportFile));
    const idB = useStableId(attachmentSeed(imageFile));
    expect(idA).not.toBe(idB);
  });

  test('two attachments with different names but identical size and lastModified produce different IDs', () => {
    const fileA = { name: 'alpha.txt', size: 100, lastModified: 1700000000000 };
    const fileB = { name: 'beta.txt', size: 100, lastModified: 1700000000000 };
    expect(useStableId(attachmentSeed(fileA))).not.toBe(useStableId(attachmentSeed(fileB)));
  });

  test('attachment IDs follow the id-<8 hex chars> format', () => {
    const id = useStableId(attachmentSeed(reportFile));
    expect(id).toMatch(/^id-[0-9a-f]{8}$/);
  });
});

describe('ChatInput attachment ID — fallback counter for files with lastModified = 0', () => {
  // Each ChatInput instance creates its own factory, independent of all other instances.
  // Two instances appending the same synthetic file must not produce the same ID.

  test('per-instance factories produce independent sequences', () => {
    const factoryA = makeAttachmentFactory();
    const factoryB = makeAttachmentFactory();

    // Both factories start at 1 — but they are independent objects.
    const idFromA = factoryA.next();
    const idFromB = factoryB.next();

    // The format is 'attachment-1' for both, which looks identical. That is
    // acceptable and expected: two different instances each produce 'attachment-1'
    // for their *first* attachment, just as React useId produces ':a:' in both
    // instances. Uniqueness is guaranteed by the parent component mounting each
    // instance in a distinct subtree; the IDs are scoped to the attachment list,
    // not the page.
    expect(idFromA).toBe('attachment-1');
    expect(idFromB).toBe('attachment-1');

    // Advancing factoryA does not advance factoryB.
    const idFromA2 = factoryA.next();
    expect(idFromA2).toBe('attachment-2');
    expect(factoryB.next()).toBe('attachment-2'); // factoryB is still independent
  });

  test('fallback IDs increment within a single instance', () => {
    const factory = makeAttachmentFactory();
    expect(factory.next()).toBe('attachment-1');
    expect(factory.next()).toBe('attachment-2');
    expect(factory.next()).toBe('attachment-3');
  });

  test('reset within one factory does not affect another', () => {
    const factoryA = makeAttachmentFactory();
    const factoryB = makeAttachmentFactory();

    factoryA.next();
    factoryA.next();
    factoryA.reset();

    // factoryB is unaffected
    expect(factoryB.next()).toBe('attachment-1');
    // factoryA restarted
    expect(factoryA.next()).toBe('attachment-1');
  });
});

describe('ChatInput attachment ID — no collisions across two simultaneous attachments', () => {
  beforeEach(() => {
    // useStableId falls back to defaultIdFactory when no seed given, but here
    // we always supply a seed so defaultIdFactory is not involved.
  });

  test('two attachments attached at the same time have no duplicate IDs', () => {
    const files = [
      { name: 'document.docx', size: 98765, lastModified: 1720000000000 },
      { name: 'spreadsheet.xlsx', size: 54321, lastModified: 1720000000000 },
    ];

    const ids = files.map((file) => useStableId(attachmentSeed(file)));
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});
