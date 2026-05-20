<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status stable
   * @purpose Button that writes a string value to the clipboard and flips to a confirmation state for a short window after a successful copy.
   * @tag action
   * @tag clipboard
   * @useWhen Offering one-click copy of a token, snippet, share link, or code sample.
   * @useWhen Pairing with code-block so readers can grab the rendered source.
   * @avoidWhen Triggering a generic non-clipboard action — use button instead.
   * @avoidWhen Copying long-form rich content that needs format preservation — handle clipboard logic directly.
   * @related button, code-block
   */
  export type { CopyButtonProps } from './copy-button.types.ts';
</script>

<script lang="ts">
  import type { CopyButtonProps } from './copy-button.types.ts';
  import { onDestroy } from 'svelte';

  import { Check, Copy } from '../icons/index.ts';
  import { copyToClipboard } from '../../utilities/clipboard.ts';
  import { cn } from '../../utilities/class-names.ts';

  let {
    value,
    confirmDuration = 1500,
    label,
    copiedLabel,
    iconOnly = false,
    class: className,
    children,
    confirmation,
  }: CopyButtonProps = $props();

  let copied = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  async function handleClick() {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    copied = true;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied = false;
    }, confirmDuration);
  }

  onDestroy(() => {
    if (resetTimer) clearTimeout(resetTimer);
  });
</script>

<!-- aria-label MUST flip on `copied` so the polite live region announces the
     state change. Without that flip, screen readers receive no feedback when
     copy succeeds in iconOnly mode (the visible icon is aria-hidden). -->
<button
  type="button"
  class={cn('cinder-copy-button', className)}
  data-cinder-copied={copied || undefined}
  aria-label={copied ? (copiedLabel ?? 'Copied') : (label ?? 'Copy to clipboard')}
  aria-live="polite"
  onclick={handleClick}
>
  <!-- Accessible name for every branch comes from `aria-label` on the button.
       In iconOnly mode the icon is decorative — `aria-hidden` keeps it out of the
       accessibility tree. The `aria-live` region on the button announces state
       changes (Copy → Copied) without needing a redundant sr-only label. -->
  {#if copied && confirmation}
    {@render confirmation()}
  {:else if copied && iconOnly}
    <Check class="icon-sm" aria-hidden="true" />
  {:else if copied}
    Copied
  {:else if children}
    {@render children()}
  {:else if iconOnly}
    <Copy class="icon-sm" aria-hidden="true" />
  {:else}
    Copy
  {/if}
</button>
