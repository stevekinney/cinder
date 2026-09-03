/**
 * Pure axis and writing-direction geometry for `horizontal` and RTL support
 * (CIN-191, CIN-192).
 *
 * Everything below is dependency-free: no `ResizeObserver`, no runes, and —
 * with the sole exception of {@link domWritingDirectionReader}'s two
 * one-line DOM reads — no direct DOM access either. It is held to the
 * 100%-lines/100%-functions coverage floor (see `coverage-ratchet.json`)
 * because none of it needs live layout to exercise every branch; the reader
 * indirection in {@link resolveWritingDirection} is exactly what makes that
 * true for RTL detection too, despite happy-dom's `getComputedStyle` being
 * blind to the `dir` attribute (see that function's doc comment).
 */

/** A CSS writing direction, resolved to exactly one of the two real values. */
export type WritingDirection = 'ltr' | 'rtl';

/**
 * Reads the two direction signals {@link resolveWritingDirection} needs,
 * behind an interface so a test can inject a fake instead of depending on a
 * real, connected DOM tree and a browser that reflects `dir` through
 * `getComputedStyle` — which happy-dom does not (see that function's doc
 * comment).
 */
export type WritingDirectionReader = {
  /** Should return the raw `getComputedStyle(element).direction` value in production. */
  readonly getComputedDirection: (element: Element) => string;
  /** Should return `element.closest('[dir]')?.getAttribute('dir') ?? null` in production. */
  readonly closestDirAttribute: (element: Element) => string | null;
};

/**
 * Resolves the writing direction that should govern scroll-offset reading
 * for `element`.
 *
 * Reads the reader's computed-direction value FIRST — this is CIN-192's
 * literal AC text ("RTL is detected via `getComputedStyle(element).direction`"),
 * so computed style must genuinely be the primary source, not a fallback. If
 * it reports `'rtl'`, that wins outright, with no further reads. If it
 * reports `'ltr'`, this falls back to the nearest `[dir]` ancestor
 * attribute — the seam that makes this function testable at all under
 * happy-dom, whose `getComputedStyle` always answers `'ltr'` regardless of
 * any `dir="rtl"` ancestor attribute.
 *
 * The injectable {@link WritingDirectionReader} is the whole point: it lets
 * a test assert the PRIORITY RULE — computed style wins even over a
 * conflicting `dir` attribute — which a hard-coded `getComputedStyle` call
 * could never demonstrate under happy-dom, since there both signals would
 * always agree.
 *
 * Accepted, documented gap: a real element with an explicit
 * `direction: ltr` CSS override nested inside a `dir="rtl"` ancestor is
 * misread as `rtl` by the fallback, because the fallback only looks at the
 * attribute, never at computed style further up the tree. Narrow and
 * disclosed, not silent — the AC's own detection mechanism is computed
 * style on `element` itself, not on every ancestor.
 *
 * The attribute fallback is compared case-insensitively: HTML's `dir`
 * attribute is defined case-insensitively (`dir="RTL"` is exactly as valid
 * as `dir="rtl"`), matching this codebase's own `_internal/text-direction.ts`.
 */
export function resolveWritingDirection(
  element: Element | null | undefined,
  reader: WritingDirectionReader,
): WritingDirection {
  if (!element) return 'ltr';

  // Computed style is authoritative WHENEVER IT ANSWERS — including when it
  // answers 'ltr'. An earlier version fell through to the `dir` attribute on
  // anything that was not 'rtl', which inverted the priority CIN-192 asks for: an
  // element carrying an explicit `direction: ltr` override inside a `dir="rtl"`
  // ancestor was reported as rtl, contradicting what the browser actually renders.
  const computed = reader.getComputedDirection(element)?.toLowerCase();
  if (computed === 'rtl') return 'rtl';
  if (computed === 'ltr') return 'ltr';

  // Only when computed style yields nothing usable — a detached element, or an
  // environment that does not compute style — does the attribute get a say.
  return reader.closestDirAttribute(element)?.toLowerCase() === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * The real {@link WritingDirectionReader}, backed by `getComputedStyle` and
 * `Element.closest`.
 *
 * Both lookups live inside the method bodies below — `getComputedStyle` is
 * never referenced at module scope — so importing this module never
 * touches it; it is only evaluated the first time a caller actually invokes
 * `getComputedDirection`, which in `virtual-list.svelte` happens
 * exclusively inside a mount `$effect`. That keeps this module safely
 * importable during server rendering (CIN-205), where `getComputedStyle`
 * does not exist. Under happy-dom both methods return a defined value for
 * any real `Element` — `getComputedStyle` a direction string, `closest` a
 * matching ancestor or `null` — so every line here is exercised by a plain
 * Bun test, with no need to stub or delete either global.
 */
export const domWritingDirectionReader: WritingDirectionReader = {
  getComputedDirection: (element) => getComputedStyle(element).direction,
  closestDirAttribute: (element) => element.closest('[dir]')?.getAttribute('dir') ?? null,
};

/**
 * The historical `scrollLeft` conventions browsers have used for
 * right-to-left content. Irrelevant under `ltr`, where `scrollLeft` has
 * always meant the same thing everywhere.
 */
export type RtlScrollType = 'default' | 'negative' | 'reverse';

/**
 * Converts a raw `element.scrollLeft` into a normalized "distance from the
 * start edge": always `>= 0`, and increasing as the user scrolls away from
 * the start, regardless of which of the three historical RTL `scrollLeft`
 * conventions the current browser implements.
 *
 * Under `ltr` the raw value passes through unchanged — `rtlScrollType` is
 * meaningless there — regardless of which convention was passed. Under
 * `rtl`:
 *
 *   - `'negative'` — **what current browsers do.** `scrollLeft` is 0 at the
 *     start (right) edge and grows NEGATIVE toward the end. Chrome aligned
 *     with Firefox and Safari on this in Chrome 85; it is the CSSOM-View
 *     behaviour. The normalized value is its negation.
 *   - `'default'` — 0 at the start edge, growing POSITIVE toward the end.
 *     Legacy Edge/IE. Already the normalized shape, so it passes through.
 *   - `'reverse'` — `scrollLeft` equals `scrollWidth - clientWidth` at the
 *     start edge and decreases to 0 at the end. Pre-85 Chrome and old
 *     WebKit. The normalized value is that maximum minus the raw value.
 *
 * The names are this module's own and do NOT rank the conventions: `'default'`
 * is a legacy behaviour despite its name, and callers must not treat it as a
 * safe default. Detect the convention rather than assuming one — pinning
 * `'default'` would invert the sign in every browser shipping today.
 */
/**
 * Classifies which RTL `scrollLeft` convention a browser implements, from two
 * probe readings taken on a throwaway right-to-left scroll container.
 *
 * Pure, so the classification is testable without a browser — the caller supplies
 * the readings. The probe itself is a handful of DOM writes and lives in the
 * component, because nothing in this module may touch the DOM.
 *
 * Detection rather than assumption is deliberate. The three conventions are told
 * apart by observable behaviour, and picking one by name is how the sign silently
 * inverts: `'default'` sounds safe and is in fact the legacy Edge/IE behaviour.
 *
 * @param startScrollLeft `scrollLeft` while scrolled to the start (right) edge.
 * @param scrollLeftAfterWritingNegativeOne `scrollLeft` read back after writing -1.
 */
export function classifyRtlScrollType(
  startScrollLeft: number,
  scrollLeftAfterWritingNegativeOne: number,
): RtlScrollType {
  // Only 'reverse' starts at a positive maximum rather than at 0.
  if (startScrollLeft > 0) return 'reverse';
  // Of the two that start at 0, only 'negative' accepts a negative write.
  return scrollLeftAfterWritingNegativeOne < 0 ? 'negative' : 'default';
}

export function normalizeInlineScrollOffset(
  rawScrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
  direction: WritingDirection,
  rtlScrollType: RtlScrollType,
): number {
  if (direction === 'ltr') return rawScrollLeft;
  // `0 - rawScrollLeft` rather than `-rawScrollLeft`: negating a raw value of
  // exactly 0 (the start edge) with unary minus produces IEEE-754 negative
  // zero, which fails a strict `Object.is`-based equality check against `0`.
  if (rtlScrollType === 'negative') return 0 - rawScrollLeft;
  if (rtlScrollType === 'reverse') {
    const maxScrollOffset = Math.max(0, scrollWidth - clientWidth);
    return maxScrollOffset - rawScrollLeft;
  }
  return rawScrollLeft;
}

/** Which axis the list scrolls and lays rows out along. */
export type AxisMode = 'vertical' | 'horizontal';

/**
 * The logical CSS property names that carry a row's size and offset along
 * `axis`. Logical, not physical (`block-size`/`inset-block-start` rather
 * than `height`/`top`), so RTL flips the inline axis correctly for free —
 * no separate RTL branch is needed at the layout layer.
 */
export type RowLayoutDescriptor = {
  readonly sizeProperty: 'block-size' | 'inline-size';
  readonly offsetProperty: 'inset-block-start' | 'inset-inline-start';
};

/** Resolves the logical CSS property names a row on `axis` is sized and positioned with. */
export function resolveRowLayoutDescriptor(axis: AxisMode): RowLayoutDescriptor {
  return axis === 'horizontal'
    ? { sizeProperty: 'inline-size', offsetProperty: 'inset-inline-start' }
    : { sizeProperty: 'block-size', offsetProperty: 'inset-block-start' };
}

/**
 * Returns one dynamic style string for a per-row-absolute row (Wave 4
 * sticky mode only): the row's offset and size along `axis`, as logical CSS
 * declarations.
 *
 * A single string, not per-property `style:` directives, because the CSS
 * property NAME itself varies by axis (`inset-block-start` vs
 * `inset-inline-start`, `block-size` vs `inline-size`) and Svelte's
 * `style:prop={value}` directive requires a static property name — a
 * computed string built from a function call is unambiguously dynamic
 * instead. `position: absolute` is deliberately NOT included here: it is
 * static across every row in this mode and lives in the CSS sidecar
 * (`.cinder-virtual-list__row[data-cinder-absolute]`) rather than being
 * repeated as an inline declaration on every row.
 */
export function resolveAbsoluteRowStyle(axis: AxisMode, start: number, size: number): string {
  const { offsetProperty, sizeProperty } = resolveRowLayoutDescriptor(axis);
  return `${offsetProperty}:${start}px;${sizeProperty}:${size}px;`;
}

/**
 * The main-axis size of an observed row, from a `ResizeObserver` entry's two
 * possible size sources.
 *
 * `borderBoxSize` is already writing-mode relative, so its `inlineSize` is the
 * correct main-axis size under a horizontal list in both writing directions. The
 * `contentRect` fallback is physical, so the axis has to be chosen by hand — and
 * an older engine that reports only `contentRect` is exactly where picking the
 * wrong one goes unnoticed.
 */
export function resolveObservedMainAxisSize(
  borderBoxSize: { readonly blockSize: number; readonly inlineSize: number } | undefined,
  contentRect: { readonly width: number; readonly height: number },
  axis: AxisMode,
): number {
  if (axis === 'horizontal') return borderBoxSize?.inlineSize ?? contentRect.width;
  return borderBoxSize?.blockSize ?? contentRect.height;
}
