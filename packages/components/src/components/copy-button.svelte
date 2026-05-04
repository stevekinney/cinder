<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /**
   * Props for the CopyButton component.
   *
   * Copies `value` to the clipboard when clicked and renders a brief
   * confirmation state. The `children` snippet defines the button label;
   * `confirmation` is rendered while the copied state is active.
   */
  export type CopyButtonProps = {
    /** Text to copy to the clipboard. */
    value: string;
    /** Duration in ms to show the confirmation state. Default 1500. */
    confirmDuration?: number;
    /** Accessible label for the button when no children are supplied. */
    label?: string;
    /** Render the button with only an icon and a visually hidden label.
     * When true, defaults to a Copy icon (idle) and a Check icon (copied). */
    iconOnly?: boolean;
    /** Additional class names merged with `.cinder-copy-button`. */
    class?: string;
    /** Default content (idle state). */
    children?: Snippet;
    /** Content rendered while in the "copied" state. */
    confirmation?: Snippet;
  };
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';

  import { Check, Copy } from './icons/index.ts';
  import { copyToClipboard } from '../utilities/clipboard.ts';
  import { cn } from '../utilities/class-names.ts';

  let {
    value,
    confirmDuration = 1500,
    label,
    iconOnly,
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

<button
  type="button"
  class={cn('cinder-copy-button', className)}
  data-cinder-copied={copied || undefined}
  aria-label={label ?? (copied ? 'Copied' : 'Copy to clipboard')}
  aria-live="polite"
  onclick={handleClick}
>
  {#if copied && confirmation}
    {@render confirmation()}
  {:else if copied && iconOnly}
    <span aria-hidden="true">
      <Check class="icon-sm" />
    </span>
    <span class="sr-only">Copied</span>
  {:else if copied}
    Copied
  {:else if children}
    {@render children()}
  {:else if iconOnly}
    <span aria-hidden="true">
      <Copy class="icon-sm" />
    </span>
    <span class="sr-only">{label ?? 'Copy to clipboard'}</span>
  {:else}
    Copy
  {/if}
</button>
