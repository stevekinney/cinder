import type { Middleware, Placement, ReferenceElement } from '@floating-ui/dom';

export type AnchoredOverlayWidthMode = 'content' | 'match-anchor' | 'menu' | 'none';

export type AnchoredOverlayOptions = {
  open: () => boolean;
  anchor: () => ReferenceElement | null | undefined;
  panel: () => HTMLElement | null | undefined;
  arrow?: () => HTMLElement | null | undefined;
  placement?: () => Placement;
  offset?: () => number;
  shiftPadding?: () => number;
  shiftCrossAxis?: () => boolean;
  arrowPadding?: () => number;
  arrowVisible?: () => boolean;
  /** Constrain the floating panel to the available block space on its resolved side. */
  size?: () => boolean;
  sizeMaxBlockSize?: () => string;
  widthMode?: () => AnchoredOverlayWidthMode;
  strategy?: () => 'fixed' | 'absolute';
  /** Constrain collision calculations to the nearest owning overlay. */
  boundary?: () => Element | null | undefined;
  /**
   * Resolve the placement once per open session, then hold it.
   *
   * `autoUpdate` re-runs positioning whenever the panel resizes, and `flip` makes a
   * fresh fit decision each time. For a surface whose height tracks its content — a
   * filtered result list, say — that means typing can flip the panel across its anchor
   * and back as results narrow and widen. Locking keeps the first resolved placement,
   * so the anchored edge stays put while the list grows and shrinks.
   *
   * Collision handling still applies on open: the first resolve flips normally if the
   * preferred side does not fit. The trade is that a locked panel will not re-flip if
   * the page scrolls while it is open, so pair this with `size` to let a panel that
   * runs out of room shrink and scroll rather than overflow the viewport.
   *
   * Intended for caret-anchored filtering surfaces. Off by default: every other
   * anchored overlay keeps floating-ui's continuous flip behaviour.
   */
  lockPlacement?: () => boolean;
};

const DEFAULT_PLACEMENT: Placement = 'bottom-start';
const DEFAULT_OFFSET = 8;
const DEFAULT_SHIFT_PADDING = 8;
const DEFAULT_ARROW_PADDING = 6;

export function getAnchoredOverlayWidthStyle(
  widthMode: AnchoredOverlayWidthMode,
  anchorRect: DOMRect | { width: number } | null | undefined,
): string {
  if (widthMode === 'none') return '';

  if (widthMode === 'match-anchor') {
    const width = Math.max(0, anchorRect?.width ?? 0);
    return width > 0 ? `min-inline-size: ${width}px; inline-size: ${width}px;` : '';
  }

  if (widthMode === 'menu') {
    return [
      'inline-size: max-content;',
      'min-inline-size: min(12rem, calc(100vw - var(--cinder-space-4)));',
      'max-inline-size: min(24rem, calc(100vw - var(--cinder-space-4)));',
    ].join(' ');
  }

  return 'max-inline-size: min(28rem, calc(100vw - var(--cinder-space-4)));';
}

export function getAnchoredOverlayAvailableHeightStyle(availableHeight: number): string {
  return `${Math.max(0, availableHeight)}px`;
}

export function getAnchoredOverlayMaxBlockSizeStyle(
  availableHeight: number,
  maximumBlockSize: string,
): string {
  return `min(${maximumBlockSize}, ${getAnchoredOverlayAvailableHeightStyle(availableHeight)})`;
}

export function applyAnchoredOverlayMaxBlockSize(
  panel: HTMLElement,
  availableHeight: number,
  maximumBlockSize: string,
): string {
  const value = getAnchoredOverlayMaxBlockSizeStyle(availableHeight, maximumBlockSize);
  panel.style.maxBlockSize = value;
  return value;
}

export function isAnchoredOverlayWriteCurrent(
  positioningGeneration: number,
  latestGeneration: number,
  cancelled: boolean,
): boolean {
  return !cancelled && positioningGeneration === latestGeneration;
}

// Emits only the Floating UI-computed CROSS-axis offset (`left` for a
// top/bottom placement, `top` for a left/right placement). The STATIC-axis
// offset — how far the arrow sits from the panel's near edge — is
// placement- and shape-dependent (Popover's 8px CSS-triangle needs a
// different inset than HoverCard's 10px rotated-square diamond) and must be
// owned by each consumer's own per-placement CSS
// (`[data-cinder-placement^='...']`), not hardcoded here. An inline
// static-side value would beat that CSS on specificity and silently override
// it for every consumer, correct or not.
function getArrowStyle(data: { x?: number; y?: number } | undefined) {
  if (!data) return '';

  return [data.x != null ? `left: ${data.x}px;` : '', data.y != null ? `top: ${data.y}px;` : '']
    .filter(Boolean)
    .join(' ');
}

function reportAnchoredOverlaySetupError(error: unknown): void {
  if (typeof globalThis.reportError === 'function') {
    globalThis.reportError(error);
    return;
  }

  setTimeout(() => {
    throw error;
  }, 0);
}

// Module-level (singleton) cache for the `@floating-ui/dom` dynamic import. Every anchored
// overlay on the page (ContextMenu, DropdownMenu, MenuBar, Popover, HoverCard, MultiSelect,
// Combobox, SelectionPopover, ...) shares this single in-flight/resolved promise, so the
// module is fetched at most once regardless of how many overlays exist or open.
//
// `load` is passed in by the caller (rather than this helper calling the dynamic import
// itself) so that every literal `import('@floating-ui/dom')` call site stays textually inside an
// `$effect` body. Svelte's server compilation strips `$effect` callback bodies entirely (they
// never run during SSR), which is what keeps `@floating-ui/dom` out of the SSR bundle — see the
// `'server compilation omits Floating UI runtime imports'` test. A module-scope function whose
// own body called `import('@floating-ui/dom')` would NOT be stripped for SSR.
let floatingUiModulePromise: Promise<typeof import('@floating-ui/dom')> | undefined;

function cacheFloatingUiModule(
  load: () => Promise<typeof import('@floating-ui/dom')>,
): Promise<typeof import('@floating-ui/dom')> {
  floatingUiModulePromise ??= load().catch((error: unknown) => {
    // Don't let a transient failure (offline, blocked request) permanently poison every
    // future open — clear the cache so the next attempt retries the import.
    floatingUiModulePromise = undefined;
    throw error;
  });
  return floatingUiModulePromise;
}

export function createAnchoredOverlay(options: AnchoredOverlayOptions) {
  let positionReady = $state(false);
  let positionStyle = $state('');
  let availableHeightStyle = $state('');
  let resolvedPlacement = $state<Placement>(options.placement?.() ?? DEFAULT_PLACEMENT);
  let arrowStyle = $state('');

  // Speculatively prefetch `@floating-ui/dom` as soon as the anchor/panel elements exist,
  // instead of waiting for `open()` to become true. By the time a user actually opens the
  // overlay, the module has very likely already finished loading in the background, so the
  // first `computePosition` call below doesn't pay the import cost synchronously.
  $effect(() => {
    const anchor = options.anchor();
    const panel = options.panel();
    if (!anchor || !panel) return;

    cacheFloatingUiModule(() => import('@floating-ui/dom')).catch(() => {
      // Prefetch failures are non-fatal: the open-gated effect below awaits the same cache
      // and will retry the import when the overlay actually opens.
    });
  });

  $effect(() => {
    if (!options.open()) {
      positionReady = false;
      positionStyle = '';
      availableHeightStyle = '';
      arrowStyle = '';
      resolvedPlacement = options.placement?.() ?? DEFAULT_PLACEMENT;
      return;
    }

    const anchor = options.anchor();
    const panel = options.panel();
    if (!anchor || !panel) {
      positionReady = false;
      positionStyle = '';
      availableHeightStyle = '';
      arrowStyle = '';
      return;
    }

    const placement = options.placement?.() ?? DEFAULT_PLACEMENT;
    const offset = options.offset?.() ?? DEFAULT_OFFSET;
    const shiftPadding = options.shiftPadding?.() ?? DEFAULT_SHIFT_PADDING;
    const shiftCrossAxis = options.shiftCrossAxis?.() ?? false;
    const arrowPadding = options.arrowPadding?.() ?? DEFAULT_ARROW_PADDING;
    const arrow = options.arrow?.();
    const arrowVisible = options.arrowVisible?.() ?? Boolean(arrow);
    const sizeEnabled = options.size?.() ?? false;
    const sizeMaxBlockSize = options.sizeMaxBlockSize?.() ?? '100%';
    const widthMode = options.widthMode?.() ?? 'content';
    const strategyOverride = options.strategy?.();
    const boundary = options.boundary?.() ?? undefined;
    const lockPlacement = options.lockPlacement?.() ?? false;
    let cancelled = false;
    let generation = 0;
    // Scoped to this effect run, so it resets whenever the overlay reopens.
    let lockedPlacement: Placement | undefined;
    let stopAutoUpdate: (() => void) | undefined;
    let boundaryResizeObserver: ResizeObserver | undefined;

    void (async () => {
      const {
        arrow: arrowMiddleware,
        autoUpdate,
        computePosition,
        flip,
        offset: offsetMiddleware,
        size: sizeMiddleware,
        shift,
      } = await cacheFloatingUiModule(() => import('@floating-ui/dom'));

      if (cancelled) return;

      const updatePosition = async () => {
        if (cancelled) return;
        const currentGeneration = ++generation;
        if (!sizeEnabled) {
          availableHeightStyle = '';
          panel.style.removeProperty('max-block-size');
        }
        // Once a placement is locked it has to be passed as the preferred placement
        // AND `flip` has to be dropped, since flip would just re-decide and override it.
        const activePlacement = lockedPlacement ?? placement;
        const middleware: Middleware[] = [offsetMiddleware(offset)];
        if (lockedPlacement === undefined) {
          middleware.push(flip(boundary ? { boundary } : undefined));
        }
        if (sizeEnabled) {
          middleware.push(
            sizeMiddleware({
              ...(boundary ? { boundary } : {}),
              padding: shiftPadding,
              apply({ availableHeight }) {
                if (!isAnchoredOverlayWriteCurrent(currentGeneration, generation, cancelled))
                  return;
                availableHeightStyle = applyAnchoredOverlayMaxBlockSize(
                  panel,
                  availableHeight,
                  sizeMaxBlockSize,
                );
              },
            }),
          );
        }
        middleware.push(
          shift({
            ...(boundary ? { boundary } : {}),
            padding: shiftPadding,
            crossAxis: shiftCrossAxis,
          }),
        );
        if (arrowVisible && arrow) {
          middleware.push(arrowMiddleware({ element: arrow, padding: arrowPadding }));
        }
        let result: Awaited<ReturnType<typeof computePosition>>;
        const strategy = strategyOverride ?? (panel.closest('dialog') ? 'absolute' : 'fixed');
        try {
          result = await computePosition(anchor, panel, {
            placement: activePlacement,
            middleware,
            strategy,
          });
        } catch {
          if (cancelled || currentGeneration !== generation) return;
          positionReady = false;
          positionStyle = '';
          arrowStyle = '';
          resolvedPlacement = activePlacement;
          return;
        }
        if (cancelled || currentGeneration !== generation) return;

        const widthStyle = getAnchoredOverlayWidthStyle(widthMode, anchor.getBoundingClientRect());
        positionStyle = [
          `position: ${strategy};`,
          `left: ${result.x}px;`,
          `top: ${result.y}px;`,
          availableHeightStyle ? `max-block-size: ${availableHeightStyle};` : '',
          widthStyle,
        ]
          .filter(Boolean)
          .join(' ');
        resolvedPlacement = result.placement;
        if (lockPlacement && lockedPlacement === undefined) {
          lockedPlacement = result.placement;
        }
        arrowStyle = arrowVisible ? getArrowStyle(result.middlewareData.arrow) : '';
        positionReady = true;
      };

      stopAutoUpdate = autoUpdate(anchor, panel, updatePosition);

      if (
        boundary &&
        boundary !== anchor &&
        boundary !== panel &&
        typeof ResizeObserver !== 'undefined'
      ) {
        boundaryResizeObserver = new ResizeObserver(() => {
          void updatePosition();
        });
        boundaryResizeObserver.observe(boundary);
      }
    })().catch((error) => {
      if (cancelled) return;
      positionReady = false;
      positionStyle = '';
      availableHeightStyle = '';
      arrowStyle = '';
      resolvedPlacement = placement;
      reportAnchoredOverlaySetupError(error);
    });

    return () => {
      cancelled = true;
      stopAutoUpdate?.();
      boundaryResizeObserver?.disconnect();
      panel.style.removeProperty('max-block-size');
      positionReady = false;
      positionStyle = '';
      availableHeightStyle = '';
      arrowStyle = '';
      resolvedPlacement = placement;
    };
  });

  return {
    get positionReady() {
      return positionReady;
    },
    get positionStyle() {
      return positionStyle;
    },
    get resolvedPlacement() {
      return resolvedPlacement;
    },
    get arrowStyle() {
      return arrowStyle;
    },
  };
}
