/**
 * Sort a list of items by DOM document order, using `compareDocumentPosition`
 * on each item's `node`. Stable. Returns a new array — does not mutate input.
 *
 * Why: `{@attach}` fires after the node is mounted, so registration order
 * usually equals DOM order. But conditional `{#if}` blocks that re-mount
 * middle items can desync the registration list from visual order. Sorting
 * on read keeps keyboard navigation aligned with the rendered tree.
 *
 * Edge case: if a node is temporarily disconnected from the document,
 * `compareDocumentPosition` returns a platform-specific disconnected mask
 * (`DOCUMENT_POSITION_DISCONNECTED | DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC`).
 * The sort remains stable but order is undefined for disconnected nodes. In
 * practice this is unreachable during normal teardown — unregister runs
 * synchronously inside the attachment cleanup, before the node is removed.
 */
export function inDocumentOrder<T extends { node: Node }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.node === b.node) return 0;
    const position = a.node.compareDocumentPosition(b.node);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}
