<script lang="ts" module>
  /**
   * Per-message read receipt badge for the Chat component.
   *
   * Rendered inside the `messageStatus` snippet slot of the user's message bubble.
   * Shows delivery/read state with BOTH an icon AND a text label (never color-only).
   *
   * Three states:
   *   - `sent`      — single check icon + "Sent" label (text-muted)
   *   - `delivered` — double-check icon + "Delivered" label (text-muted)
   *   - `read`      — double-check icon + "Read" label (accent color)
   *
   * Accessibility:
   *   - The wrapper has aria-label="Sent" / "Delivered" / "Read by …" (full text).
   *   - Icon is aria-hidden="true".
   *   - Visible text label is exposed in the accessibility tree (no aria-hidden).
   *   - data-cinder-receipt-status=sent|delivered|read on the wrapper element.
   *
   * NOT shown on non-user messages — the caller gates this based on message.role.
   */
  import type { ReadReceipt } from '../chat.types.ts';

  export type ChatReadReceiptProps = {
    /** The receipt to render. */
    receipt: ReadReceipt;
  };
</script>

<script lang="ts">
  import { Check, CheckCheck } from '@lostgradient/cinder/icons';

  let { receipt }: ChatReadReceiptProps = $props();

  const status = $derived(receipt.status);

  const ariaLabel = $derived.by(() => {
    if (status === 'sent') return 'Sent';
    if (status === 'delivered') return 'Delivered';

    // read
    const readers = receipt.readBy;
    if (readers && readers.length > 0) {
      return `Read by ${readers.join(', ')}`;
    }
    return 'Read';
  });

  const visibleLabel = $derived(
    status === 'sent' ? 'Sent' : status === 'delivered' ? 'Delivered' : 'Read',
  );

  const isDoubleCheck = $derived(status === 'delivered' || status === 'read');
</script>

<!--
  role="img" + aria-label makes the badge a single named, opaque widget so screen
  readers announce the FULL status ("Read by Alice, Bob") authoritatively. Without
  the role, a generic span's accessible name is computed from its subtree text —
  only the short "Read"/"Delivered"/"Sent" visible label — and the readBy names
  are silently dropped. The icon + visible label remain the visual representation.
-->
<span
  class="chat-read-receipt"
  role="img"
  data-cinder-receipt-status={status}
  aria-label={ariaLabel}
>
  <span class="chat-read-receipt-icon" aria-hidden="true">
    {#if isDoubleCheck}
      <CheckCheck size={12} />
    {:else}
      <Check size={12} />
    {/if}
  </span>
  <span class="chat-read-receipt-label">{visibleLabel}</span>
</span>

<style>
  .chat-read-receipt {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-1);
    font-size: var(--cinder-text-xs);
    line-height: 1;
  }

  /* sent + delivered: muted text */
  .chat-read-receipt[data-cinder-receipt-status='sent'],
  .chat-read-receipt[data-cinder-receipt-status='delivered'] {
    color: var(--cinder-text-muted);
  }

  /* read: accent color */
  .chat-read-receipt[data-cinder-receipt-status='read'] {
    color: var(--cinder-accent);
  }

  .chat-read-receipt-icon {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .chat-read-receipt-label {
    font-size: var(--cinder-text-xs);
  }

  /* High-contrast mode: rely on system colors rather than accent/muted. */
  @media (forced-colors: active) {
    .chat-read-receipt {
      forced-color-adjust: auto;
    }
  }
</style>
