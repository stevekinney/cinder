<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Displays a masked secret (API key, token, webhook secret) with copy action and optional reveal toggle.
   * @tag clipboard
   * @tag security
   * @useWhen Showing a newly-created API key or token that the user must copy before it is gone.
   * @useWhen Displaying an existing masked key in a settings table where the full value should stay hidden.
   * @avoidWhen The value is not sensitive and can be shown as plain text — use a code or input component.
   * @avoidWhen You need inline editing of the secret value — use a password input instead.
   * @related copy-button, input, badge
   */
  export type { SecretValueFieldProps } from './secret-value-field.types.ts';
</script>

<script lang="ts">
  import { onDestroy, untrack } from 'svelte';

  import Check from 'lucide-svelte/icons/check';
  import Copy from 'lucide-svelte/icons/copy';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';

  import type { SecretValueFieldProps } from './secret-value-field.types.ts';
  import { copyToClipboard } from '../../utilities/clipboard.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';

  let {
    value,
    prefix,
    suffix,
    label = 'Secret value',
    revealAllowed = false,
    initiallyRevealed = false,
    confirmDuration = 1500,
    copiedLabel = 'Copied',
    warning,
    class: className,
    ...rest
  }: SecretValueFieldProps = $props();

  const fieldId = $props.id();

  let revealed = $state(untrack(() => initiallyRevealed));
  // Plain `let` — not reactive, so the resync effect below depends only on the
  // `value` prop, not on its own write to this guard (the self-dependency
  // footgun `phone-input.svelte` and `schedule-builder.svelte` avoid the same way).
  let previousValue = untrack(() => value);

  let copied = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const copiedAnnouncement = $derived(copied ? copiedLabel : '');

  // The mask string never leaks the real value — it is always a fixed character sequence.
  const MASK = '••••••••••••••••';

  async function handleCopy() {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    copied = true;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied = false;
    }, confirmDuration);
  }

  function handleRevealToggle() {
    if (!revealAllowed) return;
    revealed = !revealed;
  }

  $effect(() => {
    if (value === previousValue) return;
    previousValue = value;
    revealed = initiallyRevealed;
  });

  onDestroy(() => {
    if (resetTimer) clearTimeout(resetTimer);
  });
</script>

<!--
  Security contract:
  - The `value` prop is NEVER placed in title, aria-label, data-*, or any passive attribute.
  - The masked display uses a fixed bullet string; the real value only appears in the
    visible text when `initiallyRevealed` is true or when the user explicitly requests
    reveal AND `revealAllowed` is true.
  - After a successful copy, no visible text exposes the value — only the live-region
    announcement ("Copied") fires, and that text never contains the secret.
  - The copy button aria-label names the field, not the value.
-->
<div
  {...rest}
  class={classNames('cinder-secret-value-field', className)}
  data-cinder-copied={copied || undefined}
  data-cinder-revealed={revealed || undefined}
>
  <!-- Field label -->
  <span id={fieldId} class="cinder-secret-value-field__label">{label}</span>

  <!-- Value display row -->
  <div class="cinder-secret-value-field__row" role="group" aria-labelledby={fieldId}>
    <!-- Prefix metadata (e.g. "example_live_") — does not contain the secret -->
    {#if prefix}
      <span class="cinder-secret-value-field__prefix" aria-hidden="true">{prefix}</span>
    {/if}

    <!-- Masked/revealed value display.
         Security: the aria-label names the region state ("masked" or "revealed")
         but does NOT contain the secret value itself. -->
    <span
      class="cinder-secret-value-field__value"
      aria-label={revealed ? `${label}, revealed` : `${label}, masked`}
      data-cinder-masked={!revealed || undefined}>{revealed ? value : MASK}</span
    >

    <!-- Suffix metadata (e.g. last 4 chars) — does not contain the secret -->
    {#if suffix}
      <span class="cinder-secret-value-field__suffix" aria-hidden="true">{suffix}</span>
    {/if}

    <!-- Action buttons -->
    <div class="cinder-secret-value-field__actions">
      <!-- Reveal/hide toggle — only rendered when revealAllowed is true -->
      {#if revealAllowed}
        <button
          type="button"
          class="cinder-secret-value-field__toggle"
          aria-pressed={revealed}
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
          onclick={handleRevealToggle}
        >
          {#if revealed}
            <!-- Hide action: shows the eye-off icon (the action available, not the current state) -->
            <EyeOff class="cinder-secret-value-field__icon" aria-hidden="true" />
          {:else}
            <!-- Reveal action: shows the eye icon (the action available, not the current state) -->
            <Eye class="cinder-secret-value-field__icon" aria-hidden="true" />
          {/if}
        </button>
      {/if}

      <!-- Copy button.
           Security: aria-label is stable ("Copy {label}") and never changes after copy.
           A11y: the success confirmation is announced exclusively via the live region below —
           NOT by changing the button's accessible name. Changing the name on copy double-announces
           (the AT reads the new name as a live-region change AND as the button name on next focus)
           and conflicts with the button role. This mirrors CopyButton's canonical model. -->
      <button
        type="button"
        class="cinder-secret-value-field__copy"
        aria-label={`Copy ${label}`}
        data-cinder-copied={copied || undefined}
        onclick={handleCopy}
      >
        {#if copied}
          <!-- Checkmark icon -->
          <Check class="cinder-secret-value-field__icon" aria-hidden="true" />
        {:else}
          <!-- Copy icon -->
          <Copy class="cinder-secret-value-field__icon" aria-hidden="true" />
        {/if}
      </button>
    </div>
  </div>

  <!-- Warning/help content slot: e.g. "Copy this now; it will not be shown again." -->
  {#if warning}
    <div class="cinder-secret-value-field__warning">
      {@render warning()}
    </div>
  {/if}

  <!-- Polite live region: announces "Copied" after a successful copy.
       The announcement text never contains the secret itself. -->
  <VisuallyHiddenLiveRegion message={copiedAnnouncement} />
</div>
