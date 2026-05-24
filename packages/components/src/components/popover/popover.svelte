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
   * @avoidWhen Interrupting the user for a focused task — use modal, drawer, or sheet so the surface is modal.
   * @related modal, drawer, sheet, tooltip
   */
  export type {
    PopoverFocusManagement,
    PopoverPlacement,
    PopoverProps,
    PopoverRole,
  } from './popover.types.ts';
</script>

<script lang="ts">
  import type { PopoverProps } from './popover.types.ts';
  import { onDestroy, untrack } from 'svelte';
  import { DEV } from 'esm-env';
  import { captureFocus, pushEscapeHandler } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import { useId } from '../../utilities/use-id.ts';
  import {
    computePosition,
    autoUpdate,
    flip,
    shift,
    offset as offsetMw,
    arrow as arrowMw,
  } from '@floating-ui/dom';
  import type { Placement } from '@floating-ui/dom';
  import { createPortalAttachment } from '../portal/index.ts';

  let {
    id: panelIdProp,
    open = $bindable(false),
    placement = 'bottom-start',
    offset = 8,
    showArrow = false,
    label,
    ariaLabelledby,
    triggerRef = null,
    trigger,
    children,
    role = 'dialog',
    focusManagement = 'panel',
    wireTriggerAria = true,
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
  let panelElement: HTMLDivElement | undefined = $state();
  let arrowElement: HTMLSpanElement | undefined = $state();

  const generatedPanelId = useId('cinder-popover');
  const panelId = $derived(panelIdProp ?? generatedPanelId);

  // Typed as floating-ui's full Placement union because flip() may resolve to
  // values outside the public PopoverPlacement input subset.
  let computedPlacement = $state<Placement>('bottom-start');

  const anchorElement = $derived<HTMLElement | null>(
    triggerRef && triggerRef.isConnected
      ? triggerRef
      : (findFirstFocusable(triggerWrapper) ?? null),
  );
  const resolvedAriaLabel = $derived(
    ariaLabelledby ? undefined : role === 'dialog' ? (label ?? 'Popover') : label,
  );

  // mounted gates the panel render so SSR emits empty markup regardless of
  // open. See _internal/OVERLAY-POLICY.md ("SSR rule").
  let mounted = $state(false);
  let positionReady = $state(false);
  let positionStyle = $state('');
  let arrowStyle = $state('');

  let capturedFocus: HTMLElement | null = null;
  let resolvedAnchorAtOpen: HTMLElement | null = null;
  let pendingInitialFocus = $state(false);
  let openSessionFocusManagement = $state<'panel' | 'preserve'>('panel');

  let isDestroyed = false;
  onDestroy(() => {
    isDestroyed = true;
  });

  const portalAttachment = createPortalAttachment({
    target: () => document.body,
    inheritAttributes: true,
    source: () => anchorElement ?? null,
  });

  $effect(() => {
    mounted = true;
  });

  function handleDocumentMousedown(event: MouseEvent) {
    if (!panelElement) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (panelElement.contains(target)) return;
    // Use the open-time snapshot so a swapped/removed trigger does not cause
    // unexpected close when the user mouses down on the original opener.
    if (resolvedAnchorAtOpen && resolvedAnchorAtOpen.contains(target)) return;
    open = false;
  }

  function moveFocusIntoPanel() {
    if (isDestroyed || !panelElement) return;
    const focusable = findFirstFocusable(panelElement);
    (focusable ?? panelElement).focus();
  }

  // Effect: open lifecycle (captures focus, registers Escape + outside-mousedown).
  // Gated on anchorElement so a no-anchor open session does not push onto the
  // shared escape stack or steal mousedowns from other visible overlays — the
  // panel itself won't render without an anchor.
  $effect(() => {
    if (!open) return;
    if (!anchorElement) return;
    openSessionFocusManagement = focusManagement;
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
    const releaseEscape = pushEscapeHandler(() => {
      open = false;
    });
    document.addEventListener('mousedown', handleDocumentMousedown, { capture: true });

    return () => {
      releaseEscape();
      document.removeEventListener('mousedown', handleDocumentMousedown, { capture: true });
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
      positionReady = false;
      positionStyle = '';
      arrowStyle = '';
      computedPlacement = placement;
    };
  });

  // Effect: positioning lifecycle. Reads `open`, `anchorElement`, `panelElement`,
  // `arrowElement`, `placement`, `offset`, `showArrow`. Restarts autoUpdate on
  // any change; moves initial focus inline once the first compute resolves.
  $effect(() => {
    if (!open) return;
    if (!anchorElement || !panelElement) return;

    const anchor = anchorElement;
    const panel = panelElement;
    const arrowEl = arrowElement;
    const placementSnap = placement;
    const off = offset;
    const arrowEnabled = showArrow;
    let cancelled = false;
    // Generation counter discards out-of-order results: autoUpdate can invoke
    // the callback multiple times in flight, and an older computePosition
    // resolution must not overwrite a newer one's positionStyle.
    let generation = 0;

    const middleware = [
      offsetMw(off),
      flip(),
      shift({ padding: 8 }),
      ...(arrowEnabled && arrowEl ? [arrowMw({ element: arrowEl })] : []),
    ];

    const stop = autoUpdate(anchor, panel, async () => {
      if (cancelled) return;
      const myGeneration = ++generation;
      const result = await computePosition(anchor, panel, {
        placement: placementSnap,
        middleware,
        strategy: 'fixed',
      });
      if (cancelled || myGeneration !== generation) return;
      positionStyle = `left: ${result.x}px; top: ${result.y}px;`;
      computedPlacement = result.placement;
      arrowStyle = '';
      if (arrowEnabled && result.middlewareData.arrow) {
        const { x, y } = result.middlewareData.arrow;
        arrowStyle = `${x != null ? `left: ${x}px;` : ''}${y != null ? `top: ${y}px;` : ''}`;
      }
      positionReady = true;
    });

    return () => {
      cancelled = true;
      stop();
      positionReady = false;
      positionStyle = '';
      arrowStyle = '';
    };
  });

  // Effect: state-driven initial-focus move. Fires once per open session when
  // the panel mounts, the anchor resolves, and positioning is ready — so focus
  // never lands in invisible content.
  $effect(() => {
    if (isDestroyed) return;
    if (openSessionFocusManagement !== 'panel') return;
    if (!open || !panelElement || !anchorElement || !positionReady || !pendingInitialFocus) return;
    moveFocusIntoPanel();
    pendingInitialFocus = false;
  });

  // Effect: dev-only guidance warnings. Single effect, fires on each open
  // transition; the cost of repeat warnings is acceptable for dev mode.
  $effect(() => {
    if (!DEV) return;
    if (!open) return;
    if (!anchorElement) {
      console.warn(
        '[cinder/popover] open without a trigger anchor. ' +
          'Provide either a `trigger` snippet with a focusable child or a `triggerRef`.',
      );
    }
    if (role === 'dialog' && !label && !ariaLabelledby) {
      console.warn(
        '[cinder/popover] role="dialog" without `label` or `ariaLabelledby` falls back to ' +
          'aria-label="Popover". Pass a descriptive name for production usage.',
      );
    }
    if (role === 'listbox' && wireTriggerAria) {
      console.warn(
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
  <div bind:this={triggerWrapper} class="cinder-popover__trigger">
    {@render trigger()}
  </div>
{/if}

{#if mounted && open && anchorElement}
  <div
    bind:this={panelElement}
    {@attach portalAttachment}
    id={panelId}
    {role}
    aria-label={resolvedAriaLabel}
    aria-labelledby={ariaLabelledby}
    aria-hidden={positionReady ? undefined : 'true'}
    class={classNames('cinder-popover', className)}
    data-cinder-placement={computedPlacement}
    data-cinder-position-ready={positionReady}
    style={positionStyle}
    tabindex="-1"
  >
    {@render children()}
    {#if showArrow}
      <span
        bind:this={arrowElement}
        class="cinder-popover__arrow"
        aria-hidden="true"
        style={arrowStyle}
      ></span>
    {/if}
  </div>
{/if}
