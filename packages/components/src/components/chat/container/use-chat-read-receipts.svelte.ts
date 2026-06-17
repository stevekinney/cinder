/**
 * Per-message read receipt state for the Chat component.
 *
 * Merges two sources of receipt state:
 *   1. The `readReceipts` prop — a `Map<messageId, ReadReceipt>` passed directly
 *      by the consumer (no adapter required).
 *   2. The adapter's `onReadReceipt` push handler, forwarded by the container
 *      via the `handleAdapterReadReceipt` callback below.
 *
 * The adapter path accumulates receipts incrementally: each incoming event inserts
 * a fresh `'read'` receipt for a new message id, or accumulates (deduplicated)
 * `readBy` names on a repeat push for an already-recorded message. Adapter events
 * always imply `'read'` status, so there is no status ordering or downgrade.
 *
 * Render rules (enforced in the component, not here):
 *   - Only shown on `user`-role messages (gated by the caller).
 *   - Icon + accessible text always present — color alone never conveys state.
 *   - data-cinder-receipt-status=sent|delivered|read on the wrapper element.
 *
 * @module
 */

import type { ChatReadReceiptEvent } from '../adapter/chat-adapter.ts';
import type { ReadReceipt } from '../chat.types.ts';

export type UseChatReadReceiptsOptions = {
  /**
   * Getter returning the current `readReceipts` prop value. Called reactively via
   * `$derived` inside this hook.
   */
  getReadReceipts: () => Map<string, ReadReceipt> | undefined;
};

export type UseChatReadReceiptsResult = {
  /**
   * Look up the effective receipt for a message id. When the `readReceipts` prop
   * is DEFINED it is authoritative: only `readReceipts.get(messageId)` is returned
   * (so a consumer can suppress adapter-accumulated receipts with an empty Map).
   * Adapter-accumulated state is the fallback ONLY when the prop is omitted.
   */
  getReceipt: (messageId: string) => ReadReceipt | undefined;
  /**
   * Receive a read-receipt push from the adapter's `onReadReceipt` handler.
   * Adapter events imply "read" status; repeat pushes accumulate `readBy` names.
   */
  handleAdapterReadReceipt: (event: ChatReadReceiptEvent) => void;
  /**
   * Clear all adapter-accumulated receipts. Called by the container on
   * conversation change / subscription teardown so a receipt from one
   * conversation cannot leak into the next (message ids can collide).
   */
  reset: () => void;
};

export function useChatReadReceipts(
  options: UseChatReadReceiptsOptions,
): UseChatReadReceiptsResult {
  // Receipts accumulated from the adapter's onReadReceipt push events.
  // Keyed by message id. Stored as a plain reactive object (record) rather than a
  // Map so property assignments trigger Svelte 5's fine-grained reactivity.
  let adapterReceipts = $state<Record<string, ReadReceipt>>({});

  function getReceipt(messageId: string): ReadReceipt | undefined {
    // A defined prop map is authoritative — return exactly its value (or
    // undefined) so a consumer's empty/partial Map can suppress adapter state.
    const propReceipts = options.getReadReceipts();
    if (propReceipts !== undefined) return propReceipts.get(messageId);

    return adapterReceipts[messageId];
  }

  function handleAdapterReadReceipt(event: ChatReadReceiptEvent): void {
    const existing = adapterReceipts[event.messageId];

    // Adapter read-receipt events imply "read" status (the event type carries no
    // lower-rank status). A new message gets a fresh "read" receipt; a repeat push
    // for an already-read message accumulates the `readBy` names (deduplicated).
    if (existing === undefined) {
      // Conditional spread: under exactOptionalPropertyTypes, omit `readBy`
      // entirely when the event carries none (don't set it to `undefined`).
      adapterReceipts[event.messageId] = {
        status: 'read',
        ...(event.readBy !== undefined ? { readBy: event.readBy } : {}),
      };
      return;
    }

    if (event.readBy !== undefined && event.readBy.length > 0) {
      const merged = Array.from(new Set([...(existing.readBy ?? []), ...event.readBy]));
      adapterReceipts[event.messageId] = { ...existing, readBy: merged };
    }
  }

  function reset(): void {
    adapterReceipts = {};
  }

  return {
    getReceipt,
    handleAdapterReadReceipt,
    reset,
  };
}
