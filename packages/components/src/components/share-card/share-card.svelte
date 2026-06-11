<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status alpha
   * @purpose Compact share card with copy-link, copy-text, and native navigator.share actions, with accessible success announcements and graceful fallback when navigator.share is unavailable.
   * @tag action
   * @tag clipboard
   * @useWhen Offering a quick way to share a link or text with copy and native share options.
   * @useWhen Presenting a result, invite link, or exported report link with sharing affordances.
   * @avoidWhen Generating the share text or images — compose ShareCard with your own copy generation logic.
   * @avoidWhen Posting directly to social media or analytics — wire those externally.
   * @related copy-button, card, button
   */
  export type { ShareCardAction, ShareCardProps } from './share-card.types.ts';
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import { copyToClipboard } from '../../utilities/clipboard.ts';
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';
  import type { ShareCardAction, ShareCardProps } from './share-card.types.ts';

  let {
    value,
    title,
    description,
    actions,
    copyLinkLabel = 'Copy link',
    copiedLabel = 'Copied!',
    shareLabel = 'Share',
    confirmDuration = 2000,
    preview,
    class: customClassName,
    ...rest
  }: ShareCardProps = $props();

  // Track which action is in the "copied" state by its key.
  let copiedKey = $state<string | null>(null);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  let announcement = $state('');

  // Hydration gate. The native-share button depends on `navigator.share`, which
  // only exists in the browser — but gating it on a plain browser check would
  // make the client's first render add a button the server never emitted,
  // producing a hydration mismatch. `$effect` runs only on the client, AFTER
  // hydration, so the server render and the initial client render both omit the
  // button; it appears on the next tick once `hydrated` flips. Matches the
  // toast-region / drawer hydration-gate convention.
  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });

  // Detect native share support. Gated on `hydrated` (not a bare browser flag)
  // so it is always `false` during SSR and the initial hydration render.
  const canNativeShare = $derived(
    hydrated && typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  );

  let announceTimer: ReturnType<typeof setTimeout> | undefined;

  // Clear BOTH transient timers — the copied-state reset AND any pending
  // announcement auto-clear — so a new copy/share cycle never has a stale timer
  // from a previous cycle mutating the current state out from under it.
  function clearTimer() {
    if (resetTimer !== undefined) {
      clearTimeout(resetTimer);
      resetTimer = undefined;
    }
    if (announceTimer !== undefined) {
      clearTimeout(announceTimer);
      announceTimer = undefined;
    }
  }

  // Set a transient announcement that auto-clears to '' after the confirmation
  // window, so a stale message isn't left in the live region and the NEXT
  // announcement (even an identical one) re-fires because the prop transitions
  // through ''. A single write — the live region (VisuallyHiddenLiveRegion) owns
  // the blank-then-set re-announce timing, matching copy-button / media-controls.
  function announce(message: string) {
    if (announceTimer !== undefined) clearTimeout(announceTimer);
    announcement = message;
    announceTimer = setTimeout(() => {
      announcement = '';
    }, confirmDuration);
  }

  async function handleCopy(key: string, text: string, successMessage = copiedLabel) {
    let succeeded = false;
    try {
      succeeded = await copyToClipboard(text);
    } catch {
      succeeded = false;
    }
    if (!succeeded) {
      // Clear any lingering "copied" state from a previous success so a failed
      // attempt doesn't leave a button stuck showing the copied label. Route the
      // failure through announce() so it auto-clears and a second identical
      // failure re-announces (the live region only fires on a change).
      clearTimer();
      copiedKey = null;
      announce('Copy failed');
      return;
    }
    clearTimer();
    copiedKey = key;
    // The success message is overridable so a fallback copy (after a failed
    // native share) announces the full story rather than overwriting the
    // "Share failed" notice with a bare "Copied!". announce() owns the message
    // lifecycle; resetTimer owns only the copied visual state.
    announce(successMessage);
    resetTimer = setTimeout(() => {
      copiedKey = null;
    }, confirmDuration);
  }

  // Heuristic: an absolute http(s) URL shares as `url`, anything else as `text`.
  function looksLikeUrl(candidate: string): boolean {
    return /^https?:\/\//i.test(candidate.trim());
  }

  function buildShareData(): ShareData {
    const shareData: ShareData = looksLikeUrl(value) ? { url: value } : { text: value };
    if (title) shareData.title = title;
    return shareData;
  }

  async function handleNativeShare() {
    if (!canNativeShare) {
      // Native share unavailable — fall back to copying the value.
      await handleCopy('share-fallback', value);
      return;
    }
    const shareData = buildShareData();
    // Respect navigator.canShare when present so an unsupported payload falls
    // back to copy instead of rejecting.
    if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) {
      await handleCopy('share-fallback', value);
      return;
    }
    try {
      await navigator.share(shareData);
      announce('Shared successfully');
    } catch (error) {
      // A user-cancelled share rejects with AbortError — NOT a failure, stay
      // silent. Every other rejection (NotAllowedError, TypeError, platform
      // failure) is real: announce it and fall back to copy so the value is
      // never lost.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Announce the full outcome on the fallback copy so the "share failed"
      // notice isn't overwritten by a bare "Copied!".
      await handleCopy('share-fallback', value, 'Share failed. Copied to clipboard instead.');
    }
  }

  // Accessible label for the read-only value region — "Link to share" only when
  // the value actually looks like a URL, otherwise "Text to share".
  const valueRegionLabel = $derived(looksLikeUrl(value) ? 'Link to share' : 'Text to share');

  onDestroy(() => {
    // clearTimer() clears BOTH resetTimer and announceTimer.
    clearTimer();
  });

  // Build the action list. When the consumer passes explicit `actions`, use them
  // verbatim. Otherwise the default surface is the copy-link button (the universal
  // fallback). The default native-share button is NOT part of this array — it is
  // rendered separately in the template behind `{#if !actions && canNativeShare}`.
  //
  // Why not push it into this array when `canNativeShare`: `canNativeShare` only
  // flips to true after hydration (it is gated on the `hydrated` $effect).
  // Observed behavior: when the native-share action was added to this reactive
  // array post-hydration, the button did not appear on the client. Gating it as a
  // standalone template `{#if}` (matching the drawer/sheet hydration convention)
  // makes it render reliably once `canNativeShare` flips. See the unit test
  // "default native-share button renders via a standalone {#if}, not array growth".
  const defaultActions: ShareCardAction[] = $derived([
    {
      key: 'copy-link',
      label: copyLinkLabel,
      copyValue: value,
    },
  ]);
  const resolvedActions = $derived(actions ?? defaultActions);
</script>

<div {...rest} class={classNames('cinder-share-card', customClassName)}>
  {#if preview}
    <div class="cinder-share-card__preview">
      {@render preview()}
    </div>
  {/if}

  {#if title || description}
    <div class="cinder-share-card__meta">
      {#if title}
        <p class="cinder-share-card__title">{title}</p>
      {/if}
      {#if description}
        <p class="cinder-share-card__description">{description}</p>
      {/if}
    </div>
  {/if}

  <!-- Value display: truncated read-only URL/text field -->
  <div class="cinder-share-card__value" aria-label={valueRegionLabel}>
    <span class="cinder-share-card__value-text" title={value}>{value}</span>
  </div>

  <div class="cinder-share-card__actions" role="group" aria-label="Share actions">
    {#each resolvedActions as action (action.key)}
      {#if action.key === 'native-share' || action.useNativeShare}
        {@render shareButton(action)}
      {:else}
        {@render copyButton(action)}
      {/if}
    {/each}
    <!-- The default native-share button is gated by a standalone `{#if}` rather
         than pushed into `resolvedActions`, so it reconciles correctly when
         `canNativeShare` flips from false to true after hydration. Only rendered
         in the default surface (no explicit `actions`); a consumer-supplied
         native-share action goes through the `{#each}` above. -->
    {#if !actions && canNativeShare}
      {@render shareButton({ key: 'native-share', label: shareLabel, useNativeShare: true })}
    {/if}
  </div>
</div>

<!-- Native-share button. Reflects the `share-fallback` copied state so that when
     `handleNativeShare` falls back to a clipboard copy (native share unavailable
     or failed) the visual matches the live-region announcement instead of staying
     on the Share label. -->
{#snippet shareButton(action: ShareCardAction)}
  {@const shareCopied = copiedKey === 'share-fallback'}
  <button
    type="button"
    class="cinder-share-card__action"
    data-cinder-action={action.key}
    data-cinder-copied={shareCopied ? '' : undefined}
    onclick={() => {
      // Honour a consumer onClick (analytics/side-effects) on the native share
      // action too, then run the share. `void` marks the floating promise as
      // intentional (the handler is synchronous).
      action.onClick?.();
      void handleNativeShare();
    }}
    aria-label={shareCopied ? copiedLabel : action.label}
  >
    {#if shareCopied}
      <!-- Copied state icon (after a fallback copy) -->
      <span class="cinder-share-card__action-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="cinder-share-card__icon"
        >
          <polyline points="20,6 9,17 4,12" />
        </svg>
      </span>
      {copiedLabel}
    {:else}
      <!-- Share icon -->
      <span class="cinder-share-card__action-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="cinder-share-card__icon"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </span>
      {action.label}
    {/if}
  </button>
{/snippet}

<!-- Copy button. `onClick` is a side-effect callback (e.g. analytics), NOT an
     override — it runs AND the copy still fires when `copyValue` is present. An
     empty string is a legitimate copyValue, so test for `undefined`, not
     truthiness. -->
{#snippet copyButton(action: ShareCardAction)}
  <button
    type="button"
    class="cinder-share-card__action"
    data-cinder-action={action.key}
    data-cinder-copied={copiedKey === action.key ? '' : undefined}
    onclick={() => {
      action.onClick?.();
      if (action.copyValue !== undefined) {
        void handleCopy(action.key, action.copyValue);
      }
    }}
    aria-label={copiedKey === action.key ? copiedLabel : action.label}
  >
    {#if copiedKey === action.key}
      <!-- Copied state icon -->
      <span class="cinder-share-card__action-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="cinder-share-card__icon"
        >
          <polyline points="20,6 9,17 4,12" />
        </svg>
      </span>
      {copiedLabel}
    {:else}
      <!-- Copy icon -->
      <span class="cinder-share-card__action-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="cinder-share-card__icon"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </span>
      {action.label}
    {/if}
  </button>
{/snippet}

<!-- Announce copy/share outcomes to assistive technology. -->
<VisuallyHiddenLiveRegion message={announcement} />
