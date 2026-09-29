import type { VirtualItem } from '../../../_internal/virtual-item.ts';
import type { ChatRenderRow } from './use-chat-message-groups.svelte.ts';

export function firstMessageViewportOffset(
  visibleAnchor: { messageId: string; viewportOffset: number } | null,
  messageId: string | null,
  viewport: HTMLElement | null,
  getRenderedMessage: (messageId: string) => HTMLElement | null,
): number {
  if (visibleAnchor) return visibleAnchor.viewportOffset;
  if (!messageId || !viewport) return 0;
  const element = getRenderedMessage(messageId);
  if (!element) return 0;
  return element.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
}

export function pinHistoryAnchorVirtualItem(
  row: ChatRenderRow,
  virtualItem: VirtualItem,
  anchorMessageId: string | null,
  anchorViewportOffset: number | null,
  scrollTop: number,
  scrollPaddingStart: number,
): VirtualItem {
  const rowAnchorMessageId =
    row.type === 'message'
      ? row.message.id
      : row.type === 'tool-call-group'
        ? row.messages[0]?.id
        : undefined;
  if (anchorViewportOffset === null || rowAnchorMessageId !== anchorMessageId) return virtualItem;
  const start = Math.max(0, scrollTop - scrollPaddingStart + anchorViewportOffset);
  return { ...virtualItem, start, end: start + virtualItem.size };
}
