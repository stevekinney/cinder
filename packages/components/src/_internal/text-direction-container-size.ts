import {
  evaluateLogicalContainerCondition,
  hasUnsupportedContainerSizeQuery,
} from './text-direction-container.ts';

export function evaluateSizeQuery(
  queryText: string,
  element: HTMLElement,
  container: HTMLElement,
): boolean {
  const { width, inlineSize } = measureContainerSize(queryText, container);
  const remSize = readRootRemSize(element);
  // This evaluator only understands `px`/`rem` length units and the
  // width/inline-size features. A condition using any other CSS length unit
  // (`em`, `vw`, `%`, ...), or a size feature it doesn't implement (`height`,
  // `block-size`, `aspect-ratio`, `orientation`, ...), cannot be decided here
  // — fail closed instead of silently defaulting to "matches" (an inactive
  // rule at the current size would otherwise be treated as an active
  // styling hint).
  if (hasUnsupportedContainerSizeQuery(queryText)) return false;
  return evaluateLogicalContainerCondition(queryText, width, remSize, inlineSize);
}

function measureContainerSize(
  queryText: string,
  container: HTMLElement,
): { width: number; inlineSize: number } {
  const computedContainerStyle = getComputedStyle(container);
  const readInset = (property: string, fallbackProperty: string): number => {
    const camel = property.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
    const fallbackCamel = fallbackProperty.replace(/-([a-z])/g, (_, character: string) =>
      character.toUpperCase(),
    );
    const value =
      Reflect.get(computedContainerStyle, camel) ||
      Reflect.get(container.style, camel) ||
      computedContainerStyle.getPropertyValue(property).trim() ||
      container.style.getPropertyValue(property).trim() ||
      Reflect.get(computedContainerStyle, fallbackCamel) ||
      Reflect.get(container.style, fallbackCamel) ||
      computedContainerStyle.getPropertyValue(fallbackProperty).trim() ||
      container.style.getPropertyValue(fallbackProperty).trim();
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  const verticalInlineAxis = usesVerticalInlineAxis(queryText, computedContainerStyle, container);
  // `offsetWidth`/`offsetHeight` report the border-box size from layout,
  // unaffected by a CSS `transform` on the container. `getBoundingClientRect()`
  // reports the post-transform box, which container size queries never use —
  // a `scale(2)` container would otherwise look twice as large as the layout
  // engine (and any real `@container` query) considers it to be.
  // A physical `width` query is always a horizontal measurement. Under a
  // vertical writing mode the logical inline insets resolve to top/bottom,
  // not left/right, so a physical query must subtract physical left/right
  // insets instead — falling back to the logical inline name only under a
  // horizontal writing mode, where the two resolve to the same value (some
  // environments only resolve the property name that was actually set).
  const physicalInsets =
    readInset('padding-left', 'padding-inline-start') +
    readInset('padding-right', 'padding-inline-end');
  const physicalBorders =
    readInset('border-left-width', 'border-inline-start-width') +
    readInset('border-right-width', 'border-inline-end-width');
  const inlineInsets = verticalInlineAxis
    ? readInset('padding-inline-start', 'padding-top') +
      readInset('padding-inline-end', 'padding-bottom')
    : physicalInsets;
  const inlineBorders = verticalInlineAxis
    ? readInset('border-inline-start-width', 'border-top-width') +
      readInset('border-inline-end-width', 'border-bottom-width')
    : physicalBorders;
  const readUsedContentSize = (
    axis: 'width' | 'height',
    fallback: number,
    insets: number,
    borders: number,
  ) => {
    const parsed = Number.parseFloat(computedContainerStyle[axis]);
    if (!Number.isFinite(parsed)) return fallback;
    const boxSizing = computedContainerStyle.boxSizing || container.style.boxSizing;
    return boxSizing === 'border-box' ? Math.max(0, parsed - insets - borders) : parsed;
  };
  const physicalClientSize = container.clientWidth;
  const inlineClientSize = verticalInlineAxis ? container.clientHeight : physicalClientSize;
  const width = Math.max(
    0,
    readUsedContentSize(
      'width',
      physicalClientSize > 0
        ? physicalClientSize - physicalInsets
        : container.offsetWidth - physicalBorders - physicalInsets,
      physicalInsets,
      physicalBorders,
    ),
  );
  const inlineSize = Math.max(
    0,
    readUsedContentSize(
      verticalInlineAxis ? 'height' : 'width',
      inlineClientSize > 0
        ? inlineClientSize - inlineInsets
        : (verticalInlineAxis ? container.offsetHeight : container.offsetWidth) -
            inlineBorders -
            inlineInsets,
      inlineInsets,
      inlineBorders,
    ),
  );
  return { width, inlineSize };
}

function usesVerticalInlineAxis(
  queryText: string,
  computedContainerStyle: CSSStyleDeclaration,
  container: HTMLElement,
): boolean {
  const writingMode =
    computedContainerStyle.writingMode ||
    computedContainerStyle.getPropertyValue('writing-mode') ||
    container.style.writingMode ||
    container.style.getPropertyValue('writing-mode');
  const usesInlineSize = /(?:inline-size|min-inline-size|max-inline-size)/i.test(queryText);
  const isVerticalWritingMode = /^(?:vertical|sideways)-/i.test(writingMode);
  return usesInlineSize && isVerticalWritingMode;
}

function readRootRemSize(element: HTMLElement): number {
  const rootFontSize = Number.parseFloat(
    getComputedStyle(element.ownerDocument.documentElement).fontSize,
  );
  return Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
}
