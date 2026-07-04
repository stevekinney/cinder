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

  import Check from 'lucide-svelte/icons/check';
  import Copy from 'lucide-svelte/icons/copy';
  import { copyToClipboard } from '../../utilities/clipboard.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';

  let {
    value,
    confirmDuration = 1500,
    label,
    copiedLabel,
    iconOnly = false,
    class: className,
    children,
    confirmation,
    // `...rest` carries every other native button attribute (id, data-*, form, name,
    // tabindex, etc.) through to the rendered element. The component's controlled attrs
    // (aria-label, aria-live, onclick, data-cinder-copied) are Omit-ted from the prop
    // type AND rendered explicitly AFTER {...rest} below, so they always win — even if a
    // consumer bypasses the types to inject one, the later attribute on the element
    // overrides the spread value.
    ...rest
  }: CopyButtonProps = $props();

  let copied = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  // Drive the announcement from a dedicated live region (below), not from
  // aria-live on the button itself. A live region on an interactive control
  // double-announces (the AT reads the button's name on focus AND as a live
  // change) and conflicts with the button role — it's an ARIA anti-pattern.
  const copiedAnnouncement = $derived(copied ? (copiedLabel ?? 'Copied') : '');

  async function handleClick() {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    copied = true;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied = false;
    }, confirmDuration);
  }

  $effect(() => {
    return () => {
      if (resetTimer) clearTimeout(resetTimer);
    };
  });
</script>

<!-- The button keeps a STABLE accessible name (it remains a "copy" control even
     while showing the confirmation). Success feedback is announced by the
     separate live region below, not via aria-live on the button — putting a live
     region on the interactive control double-announces and conflicts with the
     button role. -->
<button
  {...rest}
  type="button"
  data-cinder-copied={copied || undefined}
  aria-label={label ?? 'Copy to clipboard'}
  onclick={handleClick}
  class={classNames('cinder-copy-button', className)}
>
  <!-- Accessible name comes from `aria-label`. In iconOnly mode the icon is
       decorative (`aria-hidden`). Visible "Copied" text is presentational only;
       the announcement is owned by the live region. -->
  {#if copied && confirmation}
    {@render confirmation()}
  {:else if copied && iconOnly}
    <Check class="cinder-icon-sm" aria-hidden="true" />
  {:else if copied}
    Copied
  {:else if children}
    {@render children()}
  {:else if iconOnly}
    <Copy class="cinder-icon-sm" aria-hidden="true" />
  {:else}
    Copy
  {/if}
</button>

<!-- Dedicated polite live region: announces the copy confirmation exactly once
     per successful copy, decoupled from the interactive button. -->
<VisuallyHiddenLiveRegion message={copiedAnnouncement} />
