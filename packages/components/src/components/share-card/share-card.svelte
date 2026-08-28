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
  import Check from 'lucide-svelte/icons/check';
  import Copy from 'lucide-svelte/icons/copy';
  import Share2 from 'lucide-svelte/icons/share-2';

  import Input from '../input/input.svelte';
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

  // `Input` requires an `id`. ShareCard has no consumer-facing id prop (the
  // value field is unlabelled by a visible <label> — its name comes from
  // `aria-label`), so generate a stable one per instance.
  const valueFieldId = $props.id();

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

  $effect(() => {
    // clearTimer() clears BOTH resetTimer and announceTimer.
    return () => clearTimer();
  });

  // The action list: explicit `actions` verbatim, else the copy-link default.
  // The default native-share button is NOT in this array — it is rendered by a
  // standalone `{#if !actions && canNativeShare}` in the template. `canNativeShare`
  // only flips true after hydration (it is gated on the `hydrated` $effect), and
  // when the native-share action was instead appended to this reactive array
  // post-hydration, the keyed `{#each}` did not render it. The standalone `{#if}`
  // (matching the drawer hydration convention) renders reliably on the flip.
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

  <!-- Value display: composes the canonical `Input` primitive instead of a
       raw `<input>`, per the component-authoring rule that form controls are
       built from `Input`, not hand-rolled. `variant="code"` gives it the
       shared monospace/ellipsis metric set already used for URIs elsewhere
       in this library — the same code-well look the old hand-rolled CSS
       tried to recreate. `readonly` plus the `onfocus` select-all makes the
       value keyboard-reachable (Tab focuses it) and easy to copy (Tab, then
       Ctrl/Cmd-C selects everything), which the previous non-focusable
       `<div>` could not do. The copy/share actions ride along as the
       field's `trailing` addon (marked `trailingInteractive` so the buttons
       stay in the accessibility tree) rather than a separate sibling row. -->
  <Input
    id={valueFieldId}
    {value}
    readonly
    variant="code"
    class="cinder-share-card__value"
    title={value}
    aria-label={valueRegionLabel}
    onfocus={(event) => event.currentTarget.select()}
    trailing={actionsTrailing}
    trailingInteractive
  />
</div>

{#snippet actionsTrailing()}
  <div class="cinder-share-card__actions" role="group" aria-label="Share actions">
    {#each resolvedActions as action (action.key)}
      {#if action.key === 'native-share' || action.nativeShareEnabled}
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
      {@render shareButton({ key: 'native-share', label: shareLabel, nativeShareEnabled: true })}
    {/if}
  </div>
{/snippet}

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
    data-cinder-has-label={action.labelSnippet ? '' : undefined}
    onclick={() => {
      // Honour a consumer onclick (analytics/side-effects) on the native share
      // action too, then run the share. `void` marks the floating promise as
      // intentional (the handler is synchronous).
      action.onclick?.();
      void handleNativeShare();
    }}
    aria-label={shareCopied ? copiedLabel : action.label}
  >
    <!-- Icon-only by default: `aria-label` above carries the accessible name,
         so no visible text is required. `action.labelSnippet`, when present,
         is the CIN-358-ratified escape hatch for rich VISIBLE content — it
         still renders next to the icon, per that contract. -->
    <span class="cinder-share-card__action-icon" aria-hidden="true">
      {#if shareCopied}
        <Check class="cinder-share-card__icon" />
      {:else}
        <Share2 class="cinder-share-card__icon" />
      {/if}
    </span>
    {#if action.labelSnippet}
      {#if shareCopied}
        {copiedLabel}
      {:else}
        {@render action.labelSnippet()}
      {/if}
    {/if}
  </button>
{/snippet}

<!-- Copy button. `onclick` is a side-effect callback (e.g. analytics), NOT an
     override — it runs AND the copy still fires when `copyValue` is present. An
     empty string is a legitimate copyValue, so test for `undefined`, not
     truthiness. -->
{#snippet copyButton(action: ShareCardAction)}
  <button
    type="button"
    class="cinder-share-card__action"
    data-cinder-action={action.key}
    data-cinder-copied={copiedKey === action.key ? '' : undefined}
    data-cinder-has-label={action.labelSnippet ? '' : undefined}
    onclick={() => {
      action.onclick?.();
      if (action.copyValue !== undefined) {
        void handleCopy(action.key, action.copyValue);
      }
    }}
    aria-label={copiedKey === action.key ? copiedLabel : action.label}
  >
    <!-- Icon-only by default: `aria-label` above carries the accessible name,
         so no visible text is required. `action.labelSnippet`, when present,
         is the CIN-358-ratified escape hatch for rich VISIBLE content — it
         still renders next to the icon, per that contract. -->
    <span class="cinder-share-card__action-icon" aria-hidden="true">
      {#if copiedKey === action.key}
        <Check class="cinder-share-card__icon" />
      {:else}
        <Copy class="cinder-share-card__icon" />
      {/if}
    </span>
    {#if action.labelSnippet}
      {#if copiedKey === action.key}
        {copiedLabel}
      {:else}
        {@render action.labelSnippet()}
      {/if}
    {/if}
  </button>
{/snippet}

<!-- Announce copy/share outcomes to assistive technology. -->
<VisuallyHiddenLiveRegion message={announcement} />
