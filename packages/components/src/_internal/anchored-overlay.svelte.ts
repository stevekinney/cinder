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
};

const DEFAULT_PLACEMENT: Placement = 'bottom-start';
const DEFAULT_OFFSET = 8;
const DEFAULT_SHIFT_PADDING = 8;
const DEFAULT_ARROW_PADDING = 6;

type PlacementSide = 'top' | 'right' | 'bottom' | 'left';

function getPlacementSide(placement: Placement): PlacementSide {
  if (placement.startsWith('top')) return 'top';
  if (placement.startsWith('right')) return 'right';
  if (placement.startsWith('left')) return 'left';
  return 'bottom';
}

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

function getArrowStyle(placement: Placement, data: { x?: number; y?: number } | undefined) {
  if (!data) return '';

  const side = getPlacementSide(placement);
  const staticSide = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }[side];

  return [
    data.x != null ? `left: ${data.x}px;` : '',
    data.y != null ? `top: ${data.y}px;` : '',
    staticSide ? `${staticSide}: -4px;` : '',
  ]
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

export function createAnchoredOverlay(options: AnchoredOverlayOptions) {
  let positionReady = $state(false);
  let positionStyle = $state('');
  let availableHeightStyle = $state('');
  let resolvedPlacement = $state<Placement>(options.placement?.() ?? DEFAULT_PLACEMENT);
  let arrowStyle = $state('');

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
    let cancelled = false;
    let generation = 0;
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
      } = await import('@floating-ui/dom');

      if (cancelled) return;

      const updatePosition = async () => {
        if (cancelled) return;
        const currentGeneration = ++generation;
        if (!sizeEnabled) {
          availableHeightStyle = '';
          panel.style.removeProperty('max-block-size');
        }
        const middleware: Middleware[] = [
          offsetMiddleware(offset),
          flip(boundary ? { boundary } : undefined),
        ];
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
            placement,
            middleware,
            strategy,
          });
        } catch {
          if (cancelled || currentGeneration !== generation) return;
          positionReady = false;
          positionStyle = '';
          arrowStyle = '';
          resolvedPlacement = placement;
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
        arrowStyle = arrowVisible
          ? getArrowStyle(result.placement, result.middlewareData.arrow)
          : '';
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
