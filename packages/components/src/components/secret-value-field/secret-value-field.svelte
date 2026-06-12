<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
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
  import { onDestroy } from 'svelte';

  import type { SecretValueFieldProps } from './secret-value-field.types.ts';
  import { copyToClipboard } from '../../utilities/clipboard.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';

  let {
    value,
    prefix,
    suffix,
    label = 'Secret value',
    allowReveal = false,
    initiallyRevealed = false,
    confirmDuration = 1500,
    copiedLabel = 'Copied',
    warning,
    class: className,
    ...rest
  }: SecretValueFieldProps = $props();

  const fieldId = $props.id();

  // initiallyRevealed overrides the hidden default so newly-created secrets are readable on first render.
  // The seed const makes the initial-only capture explicit and silences state_referenced_locally.
  const initiallyRevealedSeed = initiallyRevealed;
  let revealed = $state(initiallyRevealedSeed);

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
    if (!allowReveal) return;
    revealed = !revealed;
  }

  onDestroy(() => {
    if (resetTimer) clearTimeout(resetTimer);
  });
</script>

<!--
  Security contract:
  - The `value` prop is NEVER placed in title, aria-label, data-*, or any passive attribute.
  - The masked display uses a fixed bullet string; the real value only appears in the
    visible text when the user explicitly requests reveal AND allowReveal is true.
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
      <!-- Reveal/hide toggle — only rendered when allowReveal is true -->
      {#if allowReveal}
        <button
          type="button"
          class="cinder-secret-value-field__toggle"
          aria-pressed={revealed}
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
          onclick={handleRevealToggle}
        >
          {#if revealed}
            <!-- Eye-slash icon: hide -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="cinder-secret-value-field__icon"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z"
                clip-rule="evenodd"
              />
              <path
                d="M10.748 13.93l2.523 2.524a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z"
              />
            </svg>
          {:else}
            <!-- Eye icon: reveal -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="cinder-secret-value-field__icon"
              aria-hidden="true"
            >
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path
                fill-rule="evenodd"
                d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clip-rule="evenodd"
              />
            </svg>
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="cinder-secret-value-field__icon"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clip-rule="evenodd"
            />
          </svg>
        {:else}
          <!-- Copy icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="cinder-secret-value-field__icon"
            aria-hidden="true"
          >
            <path
              d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z"
            />
            <path
              d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z"
            />
          </svg>
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
