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
  import type { Attachment } from 'svelte/attachments';

  import Check from 'lucide-svelte/icons/check';
  import Copy from 'lucide-svelte/icons/copy';
  import Share2 from 'lucide-svelte/icons/share-2';

  import Input from '@lostgradient/cinder/input';
  import { classNames } from '../../utilities/class-names.ts';
  import { copyToClipboard } from '../../utilities/clipboard.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
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

  // The value field is a read-only DISPLAY of `value`, not editable form
  // state — it has no `name`, so it was already excluded from submission,
  // but a native form RESET still reverts any descendant control's value to
  // whatever was rendered at mount, regardless of `name`. That would
  // silently blank or stale the field the next time some unrelated form
  // elsewhere on the page (e.g. a "Reset filters" button) resets.
  //
  // Fix: use `Input`'s `inputAttachment` escape hatch to reach the real
  // `<input>` DOM node, find its nearest ancestor `<form>` (if any), and
  // re-assert the CURRENT `value` prop back onto it on every native 'reset'.
  // This mirrors `color-picker.svelte`'s established `hiddenInput` +
  // `form.addEventListener('reset', ...)` pattern for the same class of
  // problem (a JS-controlled value that must survive an ambient form reset).
  // `value` inside the listener reads the live prop at reset-time (Svelte 5
  // destructured props are reactive bindings, not snapshotted captures), so
  // this stays correct even if `value` changed since the field last mounted.
  const valueFieldAttachment: Attachment<HTMLInputElement> = (element) => {
    const form = element.closest('form');
    if (!form) return;
    function restoreValueAfterReset() {
      // The `reset` event fires BEFORE the controls are cleared — resetting IS its
      // default action — so assigning synchronously here would just be overwritten a
      // moment later. Restore on the microtask after dispatch, once the native reset
      // has actually run.
      queueMicrotask(() => {
        element.value = value;
      });
    }
    form.addEventListener('reset', restoreValueAfterReset);
    return () => form.removeEventListener('reset', restoreValueAfterReset);
  };

  // Whether any consumer-supplied action carries a `labelSnippet`. The
  // compact icon-only layout rides inside `Input`'s `trailing` addon, whose
  // slot (`.cinder-input-group__trailing`) is sized for a small icon-only
  // control (`max-inline-size: 40%`, tight padding). A `labelSnippet`
  // renders rich, potentially wide visible content — cramming that into the
  // same constrained slot would clip or overflow it, so when it's present
  // the actions render OUTSIDE the field instead, as a normal full-width
  // sibling row (the pre-existing layout this redesign started from).
  const hasLabelSnippetAction = $derived(!!actions?.some((action) => !!action.labelSnippet));

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

  // The value field is a single-line `<input>` (via `Input`). A single-line
  // text control SANITIZES line breaks out of what it renders — and, absent
  // this handler, out of what a native browser selection-copy would capture
  // too, since that copy reads the sanitized DOM value, not our JS string.
  // Intercept the field's own `copy` event and always write the exact,
  // unmodified `value` to the clipboard, so selecting the field and pressing
  // Ctrl/Cmd-C is never lossy for a multi-line `value` — it matches what the
  // copy/share action buttons already send (they read `value`/`copyValue`
  // from JS state, never from the DOM, so they were never affected).
  function handleFieldCopy(event: ClipboardEvent) {
    // Only take the copy over when the replacement can actually be written. Calling
    // preventDefault() unconditionally would cancel the native copy even in an
    // environment that exposes no clipboardData, leaving the clipboard untouched —
    // strictly worse than the collapsed line breaks this exists to avoid.
    const { clipboardData } = event;
    if (!clipboardData) return;
    event.preventDefault();
    clipboardData.setData('text/plain', value);
  }

  // Dev-only signal that `value` contains a line break. The field's DISPLAY
  // still collapses it (native single-line `<input>` rendering) — that's a
  // visual limitation of the compact single-line layout, not data loss (see
  // `handleFieldCopy` above and `ShareCardProps.value`'s doc comment) — but a
  // consumer should still hear about it rather than the truncated display
  // being silent and easy to miss in review.
  $effect(() => {
    if (/[\r\n]/.test(value)) {
      devWarn(
        '[cinder/ShareCard] `value` contains a line break, but the value field renders as a single-line control — line breaks are not visible there (hover the field to preview the full text via its `title` tooltip). Copying, via the action buttons or by selecting the field and pressing Ctrl/Cmd-C, still sends the exact, unmodified `value`.',
      );
    }
  });

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
       `<div>` could not do. `inputAttachment` guards against an ambient
       form's reset silently reverting this read-only display field (see
       `valueFieldAttachment`'s comment above). `oncopy` guards a multi-line
       `value` against the browser's own single-line sanitization (see
       `handleFieldCopy` above).

       Two render paths for the actions: when every action uses only the
       icon-only default (no `labelSnippet`), they ride along as the field's
       `trailing` addon (`trailingInteractive` keeps them in the a11y tree)
       for the compact, merged `.dx-import`-style look. When a `labelSnippet`
       is present, `Input`'s trailing slot is too narrow for rich content
       (`max-inline-size: 40%`), so the actions render OUTSIDE the field as
       a normal full-width row instead of being clipped inside it. -->
  {#if hasLabelSnippetAction}
    <Input
      id={valueFieldId}
      {value}
      readonly
      variant="code"
      class="cinder-share-card__value"
      title={value}
      aria-label={valueRegionLabel}
      inputAttachment={valueFieldAttachment}
      oncopy={handleFieldCopy}
      onfocus={(event) => event.currentTarget.select()}
    />
    {@render actionsRow()}
  {:else}
    <Input
      id={valueFieldId}
      {value}
      readonly
      variant="code"
      class="cinder-share-card__value"
      title={value}
      aria-label={valueRegionLabel}
      inputAttachment={valueFieldAttachment}
      oncopy={handleFieldCopy}
      onfocus={(event) => event.currentTarget.select()}
      trailing={actionsRow}
      trailingInteractive
    />
  {/if}
</div>

{#snippet actionsRow()}
  <!-- A `<span>`, not a `<div>`: when the icon-only path renders this inside
       `Input`'s `trailing` addon, that addon is `.cinder-input-group__trailing`
       — a `<span>`, which is phrasing content and cannot legally contain a
       `<div>` (flow content). Using a `<span>` here keeps the markup valid in
       BOTH render paths; `display: flex` in the CSS gives it block-level flex
       layout regardless of the tag. -->
  <span class="cinder-share-card__actions" role="group" aria-label="Share actions">
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
  </span>
{/snippet}

<!-- Native-share button. Reflects the `share-fallback` copied state visually
     (icon + `data-cinder-copied`) so it matches the live-region announcement
     when `handleNativeShare` falls back to a clipboard copy. The accessible
     name (`aria-label`) stays STABLE at `action.label` throughout — it does
     NOT swap to `copiedLabel`. Swapping a focused control's accessible name
     for a transient state risks a second, redundant announcement on top of
     the live region's (some screen readers re-announce a name change on the
     currently-focused element), and it also makes `getByRole(..., { name })`
     unstable mid-interaction. This matches `copy-button.svelte`'s and
     `secret-value-field.svelte`'s canonical model: the live region owns
     transient-success announcements exclusively; the accessible name never
     does. -->
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
    aria-label={action.label}
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
     truthiness. `aria-label` is `action.label`, STABLE across the copied
     state — see the comment on `shareButton` above for why it never swaps to
     `copiedLabel`. -->
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
    aria-label={action.label}
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
