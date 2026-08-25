<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Anchored floating panel positioned by Floating UI that hosts non-modal contextual content beside a trigger element.
   * @tag overlay
   * @tag floating
   * @useWhen Showing rich, interactive contextual content anchored to a trigger such as a help panel, color picker, or listbox surface.
   * @useWhen Presenting non-blocking supplementary controls that should dismiss on outside click or Escape.
   * @avoidWhen Showing a short descriptive hint on hover or focus — use tooltip instead.
   * @avoidWhen Interrupting the user for a focused task — use modal or drawer so the surface is modal.
   * @related modal, drawer, tooltip
   */
  export type {
    PopoverFocusManagement,
    PopoverPlacement,
    PopoverProps,
    PopoverRole,
    PopoverWidthMode,
  } from './popover.types.ts';
</script>

<script lang="ts">
  import type { PopoverProps } from './popover.types.ts';
  import { onDestroy, untrack } from 'svelte';
  import type { Placement } from '@floating-ui/dom';
  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { createAnchoredOverlayExitState } from '../../_internal/anchored-overlay-exit.svelte.ts';
  import { captureFocus, pushEscapeHandler } from '../../_internal/overlay.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import { createClickOutside } from '../../utilities/attachments.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { createPortalAttachment } from '../portal/index.ts';
  import {
    createInheritedPortalStyle,
    findNearestOpenTopLayer,
  } from '../portal/portal.utilities.svelte.ts';

  let {
    id: panelIdProp,
    open = $bindable(false),
    placement = 'bottom-start',
    offset = 8,
    arrowVisible = false,
    label,
    ariaLabelledby,
    triggerRef = null,
    trigger,
    children,
    role = 'dialog',
    focusManagement = 'panel',
    initialFocus,
    outsideClickIgnoreRefs = [],
    wireTriggerAria = true,
    closeOnEscape = true,
    widthMode = 'content',
    portalScopeClass,
    class: className,
  }: PopoverProps = $props();

  const FOCUSABLE_SELECTOR =
    'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

  function findFirstFocusable(container: HTMLElement | undefined | null): HTMLElement | null {
    if (!container) return null;
    const candidates = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    for (const el of candidates) {
      if (el.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
      return el;
    }
    return null;
  }

  let triggerWrapper: HTMLDivElement | undefined = $state();
  let portalScopeElement: HTMLDivElement | undefined = $state();
  let panelElement: HTMLDivElement | undefined = $state();
  let arrowElement: HTMLSpanElement | undefined = $state();

  const generatedPanelId = $props.id();
  const panelId = $derived(panelIdProp ?? generatedPanelId);

  // `triggerRef.isConnected` is a native DOM read, not a reactive source. A
  // direct triggerRef that detaches/re-attaches while the popover remains open
  // still requires a fresh ref; an open transition re-resolves snippet triggers.
  const anchorElement = $derived.by((): HTMLElement | null => {
    // Re-resolve the snippet anchor on each open transition. A trigger can be
    // disabled while its owner initializes and become focusable before the
    // user opens the popover without replacing the wrapper element.
    //
    // Read through `open || exitState.renderPanel`, NOT the raw `open` prop:
    // reading `open` directly makes THIS derived (and therefore
    // `createAnchoredOverlay`'s `anchor()`, which depends on it via
    // `resolvedAnchorElement`) invalidate on every ordinary close the instant
    // `open` flips false — tearing down and rebriefly rebuilding position
    // tracking even though the resolved anchor element itself hasn't
    // actually changed. Gating on the render-panel-inclusive union instead
    // means this only recomputes when a session genuinely starts (open
    // transitions true) or fully ends (`renderPanel` clears once the exit
    // transition completes) — not on the ordinary-close tick in between,
    // which is exactly when `createAnchoredOverlay`'s effect must stay
    // stable for the retained panel's positioning to hold through the fade.
    open || exitState.renderPanel;
    return triggerRef && triggerRef.isConnected
      ? triggerRef
      : (findFirstFocusable(triggerWrapper) ?? null);
  });
  const resolvedAriaLabel = $derived(
    ariaLabelledby ? undefined : role === 'dialog' ? (label ?? 'Popover') : label,
  );

  // Snapshot of the last non-null anchor. A controlled consumer can close by
  // removing or disabling the trigger in the same update that flips `open`
  // false (`anchorElement` re-resolves reactively above and goes null the
  // instant that happens) — without this, the template's mount gate below
  // would unmount the panel immediately, well before its exit transition
  // could play, and `anchoredOverlay` would reset `positionStyle` to ''
  // (anchored-overlay.svelte.ts resets position when its `anchor()` getter
  // returns null). `resolvedAnchorElement` falls back to this snapshot,
  // mirroring SelectionPopover's `lastVirtualAnchor`.
  //
  // Deliberately NOT gated on `exitState.isClosing`: `$effect`s (which is
  // where `exitState.sync()` runs) fire after a render has already
  // committed, so on the exact tick `open` and `anchorElement` both go
  // false/null together, `isClosing` would still read its PRE-close value
  // here and the fallback would never engage — the panel would unmount in
  // that same render, one tick before `exitState` ever gets a chance to
  // start closing. Falling back whenever `anchorElement` is null (open,
  // closing, or otherwise) is what actually closes that race.
  let lastAnchorElement: HTMLElement | null = null;
  $effect(() => {
    // Read `open` explicitly so this effect re-runs on every new open
    // session, not only when `anchorElement`'s VALUE actually changes.
    // `$derived` only notifies downstream consumers when its recomputed
    // value fails an equality check — reopening with the SAME still-
    // connected trigger recomputes `anchorElement` to the identical element,
    // so without this read the effect would never re-fire and
    // `lastAnchorElement` would stay at whatever `onClosed` cleared it to
    // (null) from the PREVIOUS session, until the trigger's identity
    // happened to change. That left a real gap: if that same trigger was
    // later removed mid-close on a SUBSEQUENT session, `resolvedAnchorElement`
    // would have no fallback to fall back to and the panel would unmount
    // without playing its exit.
    open;
    if (anchorElement) {
      lastAnchorElement = anchorElement;
      return;
    }
    // The anchor went null. Retain the snapshot ONLY for an actual CLOSING
    // session — drop it in every other case:
    //
    // - `open` is currently true: the trigger disconnected while the
    //   Popover is ostensibly still open (no close was ever requested), not
    //   mid-exit. Retaining here would freeze `resolvedAnchorElement` on a
    //   disconnected element indefinitely — positioning would keep
    //   computing against a stale, no-longer-attached rect instead of
    //   reflecting that there's genuinely no anchor anymore. Drop it
    //   immediately.
    // - `open` is false AND `exitState.renderPanel` is already false: no
    //   session at all (the trigger disconnected while already fully
    //   closed) — nothing to retain for.
    //
    // Only `!open && exitState.renderPanel` (a close has been requested and
    // the exit transition is still in flight) keeps the snapshot alive.
    // `exitState.renderPanel` rather than `exitState.isClosing` for the same
    // effect-ordering reason as `resolvedAnchorElement`'s consumers below —
    // it reads the CURRENT (not one-tick-stale) retention need.
    if (open || !exitState.renderPanel) {
      lastAnchorElement = null;
    }
  });
  const resolvedAnchorElement = $derived(anchorElement ?? lastAnchorElement);

  // mounted gates the panel render so SSR emits empty markup regardless of
  // open. See _internal/OVERLAY-POLICY.md ("SSR rule").
  let mounted = $state(false);
  let capturedFocus: HTMLElement | null = null;
  let resolvedAnchorAtOpen: HTMLElement | null = null;
  let pendingInitialFocus = $state(false);
  let openSessionFocusManagement = $state<'panel' | 'preserve'>('panel');

  let isDestroyed = false;
  onDestroy(() => {
    isDestroyed = true;
  });

  // Snapshot of the last resolved portal target (the nearest open top-layer
  // boundary, or `document.body`). Retaining the anchor (`resolvedAnchorElement`
  // above) is not enough on its own: when a controlled Popover inside a modal
  // or another top-layer owner closes while its trigger is removed,
  // `findNearestOpenTopLayer` can no longer walk up from a disconnected (or
  // now-absent) anchor to find that boundary — without this snapshot the
  // portal scope would fall through to `document.body`, and the enclosing
  // top-layer surface would then paint above the still-exiting Popover.
  let lastResolvedPortalTarget: HTMLElement | null = null;
  $effect(() => {
    // Same re-arming reason as `lastAnchorElement`'s effect above: read
    // `open` explicitly so a reopen with the SAME anchor (whose value
    // wouldn't otherwise change and so wouldn't re-notify this effect)
    // still refreshes the snapshot instead of leaving it at whatever a
    // PRIOR `onClosed` cleared it to.
    open;
    if (!anchorElement) {
      // Same guard as `lastAnchorElement` above: retain ONLY for an actual
      // closing session (`!open && exitState.renderPanel`) — if `open` is
      // still true, the trigger vanished outside any close request, so drop
      // the snapshot immediately rather than freezing the portal target on
      // a boundary resolved from a now-disconnected anchor.
      if (open || !exitState.renderPanel) lastResolvedPortalTarget = null;
      return;
    }
    try {
      lastResolvedPortalTarget = findNearestOpenTopLayer(anchorElement) ?? document.body;
    } catch {
      lastResolvedPortalTarget = document.body;
    }
  });

  const portalScopeAttachment = createPortalAttachment({
    target: () => {
      if (!anchorElement) return lastResolvedPortalTarget ?? document.body;
      try {
        return findNearestOpenTopLayer(anchorElement) ?? document.body;
      } catch {
        return document.body;
      }
    },
    inheritAttributes: true,
    source: () => resolvedAnchorElement,
  });
  const panelPortalAttachment = createPortalAttachment({
    disabled: () => !portalScopeElement,
    target: () => portalScopeElement,
    inheritAttributes: false,
  });
  const inheritedPortalStyle = createInheritedPortalStyle(
    // `resolvedAnchorElement`, not the live `anchorElement`: when a
    // controlled Popover inside a locally themed subtree closes while
    // removing its trigger, the live anchor goes null even though the
    // active condition below stays true through the exit — sourcing from
    // the live anchor would recompute the inherited style as empty and the
    // retained panel would lose its tokens/typography/direction/color-scheme
    // mid-fade. `resolvedAnchorElement` falls back to the same
    // `lastAnchorElement` snapshot the anchor/positioning already use.
    () => resolvedAnchorElement,
    // Gated on `exitState.renderPanel`, not `exitState.isClosing`, for the
    // same effect-ordering reason as the positioning gate below: `open`
    // becomes `false` one tick before `exitState.sync()`'s effect can set
    // `isClosing`, so gating on `isClosing` here would briefly clear the
    // inherited custom properties/typography/direction/color-scheme while
    // the panel remains visible. Keeping this active through the exit
    // transition at all (not just gating it correctly) is what stops a
    // themed-subtree popover from losing its tokens mid-exit.
    () => mounted && (open || exitState.renderPanel),
  );

  const reducedMotion = useReducedMotion();
  // Shared anchored-overlay exit-transition lifecycle (OVERLAY-POLICY.md §
  // "Transition lifecycle"): keeps the panel mounted for the duration of its
  // exit transition and generation-guards a reopen mid-close.
  const exitState = createAnchoredOverlayExitState({
    getOpen: () => open,
    getPanelElement: () => panelElement,
    getReducedMotion: () => reducedMotion.current,
    // Clear both retained snapshots once a closing session genuinely
    // finishes — otherwise a later reopen without a fresh anchor (e.g. the
    // consumer never re-supplies a trigger) would resurrect the disconnected
    // element/target from the PREVIOUS session. The render gate would mount
    // and position a panel for what is effectively an anchorless open, even
    // though the open-lifecycle effect below correctly refuses to register
    // Escape or manage focus for it (it's gated on the live `anchorElement`,
    // not this fallback).
    // `lastPositionStyle` is cleared here too (CIN-376 round 19 review),
    // for the same reason as the anchor/portal-target snapshots above: a
    // LATER session (a moved or replaced trigger, or the same trigger
    // repositioned) that closes before its own first `computePosition`
    // ever resolves would otherwise fall back to the PREVIOUS session's
    // stale position — `resolvedPositionStyle` would look valid (non-empty)
    // and `data-cinder-has-position` would stay set, so the closing CSS
    // would force the panel visible and fade it out at coordinates that
    // belonged to a different session entirely, not simply hide it (which
    // is the correct behavior for a session that was never genuinely
    // positioned).
    onClosed: () => {
      lastAnchorElement = null;
      lastResolvedPortalTarget = null;
      lastPositionStyle = '';
    },
  });

  const anchoredOverlay = createAnchoredOverlay({
    // Gated on `exitState.renderPanel`, not `exitState.isClosing`: `$effect`s
    // (where `exitState.sync()` runs, and where `isClosing` actually flips
    // true) fire after a render has already committed. On every ordinary
    // close, `open` becomes `false` in THIS render, one tick before
    // `exitState.sync()` ever runs — so `isClosing` still reads its
    // pre-close (false) value here, and `createAnchoredOverlay` would
    // briefly take its closed path, hitting the
    // `[data-cinder-position-ready='false']` CSS rule and disappearing for
    // a tick before the async Floating UI recomputation restores it,
    // interrupting the fade. `renderPanel` doesn't have this lag: it's a
    // plain `$state` that's already `true` from the prior render and isn't
    // reset until the completion callback actually fires. Matches the fix
    // SelectionPopover already applies for the same effect-ordering race.
    //
    // `anchor()` reads `resolvedAnchorElement`, which depends on
    // `anchorElement` above — that derived now reads `open` only through the
    // same `open || exitState.renderPanel` union (not the raw prop), so an
    // ordinary close no longer invalidates this effect on its own; it only
    // recomputes when a session genuinely starts or fully ends.
    //
    // `open()` itself is `exitState.renderPanel` ALONE, not `open ||
    // exitState.renderPanel`: this callback runs directly inside
    // `createAnchoredOverlay`'s own positioning `$effect`
    // (`anchored-overlay.svelte.ts`), so reading the raw `open` prop here —
    // even behind an `||` whose overall result doesn't change — still
    // subscribes THAT effect to `open` as a fine-grained dependency (Svelte
    // tracks every signal a `$effect` reads during its run, not just whether
    // the callback's return value changed). `renderPanel` is already `true`
    // throughout an entire open session (`sync()` sets it eagerly, before
    // `isClosing` ever flips) and only changes value at genuine session
    // boundaries, so it alone is both sufficient and stable — no direct
    // `open` read, no spurious effect invalidation on ordinary closes.
    open: () => exitState.renderPanel,
    anchor: () => resolvedAnchorElement,
    panel: () => panelElement,
    arrow: () => arrowElement,
    placement: () => placement as Placement,
    offset: () => offset,
    arrowVisible: () => arrowVisible,
    widthMode: () => widthMode,
  });

  // Snapshot of the last non-empty computed position style. A consumer
  // changing a positioning INPUT (`placement`, `offset`, `widthMode`, ...)
  // in the same update that closes the Popover invalidates
  // `createAnchoredOverlay`'s effect — its cleanup resets both
  // `positionReady` AND `positionStyle` to their empty values before the
  // asynchronous Floating UI recomputation restores them. `popover.css`'s
  // `visibility: visible` override (CIN-376 round 16) already stops the
  // retained panel from disappearing in that gap, but with no positioning
  // fallback the panel would still jump to its unpositioned fixed-origin
  // location while fading — visible, but in the wrong place. Falling back
  // to the last real computed style whenever the current one is empty
  // covers this: a genuine fresh recompute (open, resize, anchor change)
  // overwrites it again within the same reactive flush, so there's no
  // meaningful staleness window outside this transient invalidation gap.
  let lastPositionStyle = '';
  $effect(() => {
    if (anchoredOverlay.positionStyle) {
      lastPositionStyle = anchoredOverlay.positionStyle;
    }
  });
  const resolvedPositionStyle = $derived(anchoredOverlay.positionStyle || lastPositionStyle);

  $effect(() => {
    mounted = true;
  });

  $effect(() => {
    exitState.sync();
  });

  onDestroy(() => {
    exitState.destroy();
  });

  const dismissOnOutsideMousedown = $derived(
    createClickOutside({
      handler: () => {
        open = false;
      },
      enabled: () => open,
      eventType: 'mousedown',
      capture: true,
      // Use the open-time snapshot so a swapped/removed trigger does not cause
      // unexpected close when the user mouses down on the original opener.
      // Also treat the portal scope itself as inside: a descendant overlay
      // (nested Popover, SpeedDial, or collapsed NavigationBar) that resolves
      // its own portal target to this panel's `${panelId}-scope` becomes a
      // *sibling* of `panelElement` under that scope container, not a
      // descendant of it, so a mousedown inside the descendant surface must
      // be excluded here too or it would close this panel first.
      ignoreRefs: [
        () => resolvedAnchorAtOpen ?? null,
        () => portalScopeElement ?? null,
        ...outsideClickIgnoreRefs,
      ],
    }),
  );

  function moveFocusIntoPanel(): boolean {
    if (isDestroyed || !panelElement) return false;
    const focusable = initialFocus?.(panelElement) ?? findFirstFocusable(panelElement);
    const target = focusable && panelElement.contains(focusable) ? focusable : panelElement;
    target.focus();
    if (document.activeElement === target) return true;
    const fallback = focusable ? findFirstFocusable(panelElement) : null;
    if (fallback && fallback !== target) {
      fallback.focus();
      if (document.activeElement === fallback) return true;
    }
    panelElement.focus();
    return document.activeElement === panelElement;
  }

  // Effect: open lifecycle (captures focus, registers Escape + outside-mousedown).
  // Gated on anchorElement so a no-anchor open session does not push onto the
  // shared escape stack or steal mousedowns from other visible overlays — the
  // panel itself won't render without an anchor.
  $effect(() => {
    if (!open) return;
    if (!anchorElement) return;
    // Snapshot focusManagement at open time. untrack so a consumer changing the
    // prop while open (even via a parent re-render) does not tear down and re-run
    // this effect — matching the resolvedAnchorAtOpen snapshot below.
    openSessionFocusManagement = untrack(() => focusManagement);
    if (openSessionFocusManagement === 'panel') {
      capturedFocus = captureFocus();
      pendingInitialFocus = true;
    } else {
      capturedFocus = null;
      pendingInitialFocus = false;
    }
    // Snapshot the anchor at open time. untrack so anchor/trigger changes while
    // open don't retrigger this effect; positioning rebind is the positioning
    // effect's responsibility.
    resolvedAnchorAtOpen = untrack(() => anchorElement);
    // Skip the Escape registration entirely when a parent owns Escape (e.g.
    // Combobox passes closeOnEscape={false}); registering here would put the
    // Popover on top of the shared stack and shadow the parent's handler while
    // options are visible.
    const releaseEscape = closeOnEscape
      ? pushEscapeHandler(() => {
          open = false;
        })
      : () => {};

    return () => {
      releaseEscape();
      pendingInitialFocus = false;
      if (isDestroyed) {
        capturedFocus = null;
        resolvedAnchorAtOpen = null;
        return;
      }
      if (openSessionFocusManagement === 'panel') {
        // Preserve the 3-candidate priority order; the shared helper enforces
        // the per-candidate connection/ownership check so we no longer need
        // the inline `.isConnected` guards.
        const candidates: Array<HTMLElement | null> = [
          triggerRef,
          resolvedAnchorAtOpen,
          capturedFocus,
        ];
        for (const candidate of candidates) {
          if (restoreFocusTo(candidate)) break;
        }
      }
      capturedFocus = null;
      resolvedAnchorAtOpen = null;
    };
  });

  // Effect: state-driven initial-focus move. Fires once per open session when
  // the panel mounts, the anchor resolves, and positioning is ready — so focus
  // never lands in invisible content.
  $effect(() => {
    if (isDestroyed) return;
    if (openSessionFocusManagement !== 'panel') return;
    if (
      !open ||
      !panelElement ||
      !anchorElement ||
      !anchoredOverlay.positionReady ||
      !pendingInitialFocus
    ) {
      return;
    }
    if (moveFocusIntoPanel()) pendingInitialFocus = false;
  });

  // Effect: dev-only guidance warnings. Single effect, fires on each open
  // transition; the cost of repeat warnings is acceptable for dev mode.
  $effect(() => {
    if (!open) return;
    if (!anchorElement) {
      devWarn(
        '[cinder/popover] open without a trigger anchor. ' +
          'Provide either a `trigger` snippet with a focusable child or a `triggerRef`.',
      );
    }
    if (role === 'dialog' && !label && !ariaLabelledby) {
      devWarn(
        '[cinder/popover] role="dialog" without `label` or `ariaLabelledby` falls back to ' +
          'aria-label="Popover". Pass a descriptive name for production usage.',
      );
    }
    if (role === 'listbox' && wireTriggerAria) {
      devWarn(
        '[cinder/popover] role="listbox" only sets the surface role. ' +
          'You must render role="option" children and own selection/keyboard semantics. ' +
          'See popover.a11y.md §Role.',
      );
    }
  });

  // Effect: trigger ARIA wiring. Captures pre-existing values and restores on
  // teardown so consumers can manage their own attributes through changes.
  $effect(() => {
    if (!wireTriggerAria) return;
    const target = anchorElement;
    if (!target) return;
    const prior = {
      expanded: target.getAttribute('aria-expanded'),
      controls: target.getAttribute('aria-controls'),
      haspopup: target.getAttribute('aria-haspopup'),
    };

    target.setAttribute('aria-expanded', String(open));
    const mappedHaspopup = role === 'group' ? null : role === 'listbox' ? 'listbox' : 'dialog';
    if (mappedHaspopup) target.setAttribute('aria-haspopup', mappedHaspopup);
    else target.removeAttribute('aria-haspopup');
    if (open) target.setAttribute('aria-controls', panelId);
    else target.removeAttribute('aria-controls');

    return () => {
      for (const [name, value] of Object.entries({
        'aria-expanded': prior.expanded,
        'aria-controls': prior.controls,
        'aria-haspopup': prior.haspopup,
      })) {
        if (value === null) target.removeAttribute(name);
        else target.setAttribute(name, value);
      }
    };
  });
</script>

{#if trigger}
  <div
    bind:this={triggerWrapper}
    class="cinder-popover__trigger"
    data-cinder-portal-owner={open ? `${panelId}-scope` : undefined}
  >
    {@render trigger()}
  </div>
{/if}

{#if mounted && exitState.renderPanel && resolvedAnchorElement}
  <div
    bind:this={portalScopeElement}
    {@attach portalScopeAttachment}
    id={`${panelId}-scope`}
    class={classNames('cinder-popover__portal-scope', portalScopeClass)}
    style={`display: contents;${inheritedPortalStyle.style}`}
  ></div>
  <div
    bind:this={panelElement}
    {@attach panelPortalAttachment}
    {@attach dismissOnOutsideMousedown}
    id={panelId}
    {role}
    aria-label={resolvedAriaLabel}
    aria-labelledby={ariaLabelledby}
    aria-hidden={anchoredOverlay.positionReady && !exitState.isClosing ? undefined : 'true'}
    inert={exitState.isClosing ? true : undefined}
    class={classNames('cinder-_floating-surface', 'cinder-popover', className)}
    data-cinder-portal-owner={`${panelId}-scope`}
    data-cinder-placement={anchoredOverlay.resolvedPlacement}
    data-cinder-position-ready={anchoredOverlay.positionReady}
    data-cinder-closing={exitState.isClosing ? '' : undefined}
    data-cinder-has-position={resolvedPositionStyle ? '' : undefined}
    style={resolvedPositionStyle}
    tabindex="-1"
  >
    {@render children()}
    {#if arrowVisible}
      <span
        bind:this={arrowElement}
        class="cinder-popover__arrow"
        aria-hidden="true"
        style={anchoredOverlay.arrowStyle}
      ></span>
    {/if}
  </div>
{/if}
