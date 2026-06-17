/**
 * Per-message read receipt state for the Chat component.
 *
 * Merges two sources of receipt state:
 *   1. The `readReceipts` prop — a `Map<messageId, ReadReceipt>` passed directly
 *      by the consumer (no adapter required).
 *   2. The adapter's `onReadReceipt` push handler, forwarded by the container
 *      via the `handleAdapterReadReceipt` callback below.
 *
 * The adapter path accumulates receipts incrementally: each incoming event either
 * upgrades an existing receipt's status or inserts a new one. The status order is
 * sent → delivered → read (upgrades only; never downgrade).
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

/** Numeric rank for receipt status — used to enforce upgrade-only semantics. */
const STATUS_RANK: Record<ReadReceipt['status'], number> = {
  sent: 0,
  delivered: 1,
  read: 2,
};

export type UseChatReadReceiptsOptions = {
  /**
   * Getter returning the current `readReceipts` prop value. Called reactively via
   * `$derived` inside this hook.
   */
  getReadReceipts: () => Map<string, ReadReceipt> | undefined;
};

export type UseChatReadReceiptsResult = {
  /**
   * Look up the effective receipt for a message id. Returns the prop value when
   * one exists (prop takes precedence), falling back to any adapter-accumulated
   * state. Returns `undefined` when no receipt is known.
   */
  getReceipt: (messageId: string) => ReadReceipt | undefined;
  /**
   * Receive a read-receipt push from the adapter's `onReadReceipt` handler.
   * Accumulates incrementally; upgrades status but never downgrades.
   */
  handleAdapterReadReceipt: (event: ChatReadReceiptEvent) => void;
};

export function useChatReadReceipts(
  options: UseChatReadReceiptsOptions,
): UseChatReadReceiptsResult {
  // Receipts accumulated from the adapter's onReadReceipt push events.
  // Keyed by message id; status only ever upgraded (sent → delivered → read).
  // We store as a plain reactive object (record) rather than a Map so that
  // property assignments trigger Svelte 5's fine-grained reactivity without
  // needing to replace the whole Map.
  let adapterReceipts = $state<Record<string, ReadReceipt>>({});

  function getReceipt(messageId: string): ReadReceipt | undefined {
    // Prop map takes precedence — the consumer's authoritative state wins.
    const propReceipts = options.getReadReceipts();
    if (propReceipts) {
      const propReceipt = propReceipts.get(messageId);
      if (propReceipt !== undefined) return propReceipt;
    }

    return adapterReceipts[messageId];
  }

  function handleAdapterReadReceipt(event: ChatReadReceiptEvent): void {
    const existing = adapterReceipts[event.messageId];

    // All adapter read-receipt events imply at least "read" status. The
    // ChatReadReceiptEvent type does not currently carry 'sent' or 'delivered',
    // so the STATUS_RANK upgrade guard below is only reachable if the event type
    // is extended in the future to carry optional lower-rank statuses.
    const incomingStatus: ReadReceipt['status'] = 'read';

    if (existing === undefined) {
      // Conditional spread: under exactOptionalPropertyTypes, omit `readBy`
      // entirely when the event carries none (don't set it to `undefined`).
      adapterReceipts[event.messageId] = {
        status: incomingStatus,
        ...(event.readBy !== undefined ? { readBy: event.readBy } : {}),
      };
      return;
    }

    // Upgrade only — never downgrade. The upgrade branch is currently unreachable
    // from adapter events (all carry 'read'), but is preserved for future extension.
    if (STATUS_RANK[incomingStatus] > STATUS_RANK[existing.status]) {
      adapterReceipts[event.messageId] = {
        ...existing,
        status: incomingStatus,
        ...(event.readBy !== undefined ? { readBy: event.readBy } : {}),
      };
      return;
    }

    // Same status: accumulate readBy names (deduplicated).
    if (event.readBy && event.readBy.length > 0) {
      const merged = Array.from(new Set([...(existing.readBy ?? []), ...event.readBy]));
      adapterReceipts[event.messageId] = { ...existing, readBy: merged };
    }
  }

  return {
    getReceipt,
    handleAdapterReadReceipt,
  };
}
