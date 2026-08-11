/**
 * A cheap per-stylesheet index of "does this sheet declare `direction`
 * anywhere?", used to skip whole stylesheets before the expensive direction
 * walk in `text-direction-css.ts` ever looks at them.
 *
 * ## Why
 *
 * `matchesDirectionStyleRule` has exactly one way to return `true`: a
 * `CSSStyleRule` whose `style.direction` is truthy AND whose selector matches
 * the element (text-direction-css.ts:127-147). Every other branch is recursion
 * — into `@import`ed sheets, native nesting, `@scope`, and conditional
 * at-rules — that must eventually reach that same check. So a stylesheet that
 * declares `direction` nowhere in its rule tree can never contribute a match,
 * and skipping it is behavior-preserving by construction.
 *
 * That matters because the walk it skips is not cheap. It resolves nested
 * selectors, evaluates `@scope` roots and limits, and runs container-query
 * conditions — per element, per ancestor, per call, with no memoization above
 * this layer (`resolveTextDirection` allocates a fresh `WeakMap` per call, and
 * `elementDirectionStyleOverride` passes none at all). Measured in a real
 * consuming app, one `Dropdown` mount walked a 179-sheet / 7651-rule document
 * about 42 times — 7518 `sheet.cssRules` reads plus 44184 nested reads, ~370ms
 * of blocking main-thread time — to answer a question whose answer was `false`
 * for every element, because that app's CSS contains no `direction`
 * declarations at all. See stevekinney/cinder#1262.
 *
 * The index makes that case cost one `cssRules.length` read per sheet.
 *
 * ## Cache validity
 *
 * Entries are keyed by stylesheet object and validated against the sheet's
 * top-level rule count, which changes on any `insertRule`/`deleteRule`. Two
 * cases deliberately opt out of caching rather than risk a stale answer:
 *
 * - A sheet containing `@import`, because an imported sheet loads
 *   asynchronously and can gain rules without changing its importer's count.
 * - A sheet whose CSSOM is unreadable (cross-origin), which is reported as
 *   "declares direction" so the caller falls through to its own guarded walk
 *   instead of being silently filtered out.
 *
 * The one mutation this cannot see is an in-place edit of an existing rule's
 * declaration (`rule.style.direction = 'rtl'`) that neither inserts nor deletes
 * a rule. Detecting that would require reading every rule's text on every
 * query, which is the cost this module exists to avoid. Consumers that mutate
 * CSSOM declarations in place can call {@link resetDirectionStyleSheetIndex}.
 */

interface SheetIndexEntry {
  /** Top-level rule count the entry was computed from. */
  readonly ruleCount: number;
  /** Whether any rule in the sheet's tree declares `direction`. */
  readonly declaresDirection: boolean;
}

let sheetIndex = new WeakMap<CSSStyleSheet, SheetIndexEntry>();

/** Drops every cached entry. Exported for tests and for consumers that edit CSSOM declarations in place. */
export function resetDirectionStyleSheetIndex(): void {
  // A WeakMap has no clear(); swapping in a fresh map is the equivalent.
  sheetIndex = new WeakMap<CSSStyleSheet, SheetIndexEntry>();
}

/**
 * Whether `sheet` declares `direction` on any rule in its tree — including
 * inside nesting, `@scope`, conditional at-rules, and `@import`ed sheets.
 *
 * Permissive on purpose: this is a pre-filter, so anything it cannot read is
 * reported as `true` and left for the caller's full (already guarded) walk. It
 * also ignores whether a conditional rule is currently active, because the
 * caller evaluates that itself.
 */
export function styleSheetDeclaresDirection(sheet: CSSStyleSheet): boolean {
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    return true;
  }

  const cached = sheetIndex.get(sheet);
  if (cached !== undefined && cached.ruleCount === rules.length) return cached.declaresDirection;

  const scan: ScanState = { declaresDirection: false, cacheable: true };
  scanRuleList(rules, scan);

  // A negative answer from a sheet with `@import` is the only unsound thing to
  // cache: the imported sheet may still be loading. A positive answer stays
  // positive no matter what an import adds later, so it is always cacheable.
  if (scan.cacheable || scan.declaresDirection) {
    sheetIndex.set(sheet, { ruleCount: rules.length, declaresDirection: scan.declaresDirection });
  } else {
    sheetIndex.delete(sheet);
  }
  return scan.declaresDirection;
}

interface ScanState {
  declaresDirection: boolean;
  cacheable: boolean;
}

function scanRuleList(rules: CSSRuleList | Iterable<CSSRule>, state: ScanState): void {
  for (const rule of Array.from(rules)) {
    if (state.declaresDirection) return;

    // CSSImportRule. An imported sheet loads asynchronously, so its importer's
    // rule count is not a sound key for a NEGATIVE result — scan it, but mark
    // the sheet uncacheable unless the scan comes back positive.
    if (Reflect.get(rule, 'type') === 3) {
      state.cacheable = false;
      const imported = Reflect.get(rule, 'styleSheet');
      if (imported) {
        try {
          const importedRules: unknown = Reflect.get(imported, 'cssRules');
          if (isRuleCollection(importedRules)) scanRuleList(importedRules, state);
        } catch {
          // Cross-origin imports deny CSSOM access; assume they could declare it.
          state.declaresDirection = true;
        }
      }
      continue;
    }

    // Mirrors `isCssStyleRule` in text-direction-css.ts: a style rule is the
    // only rule kind whose `direction` the walk can ever act on, and it is
    // identified by having both a `style` object and a string `selectorText`.
    const style: unknown = Reflect.get(rule, 'style');
    if (
      typeof style === 'object' &&
      style !== null &&
      typeof Reflect.get(rule, 'selectorText') === 'string' &&
      Boolean(Reflect.get(style, 'direction'))
    ) {
      state.declaresDirection = true;
      return;
    }

    if (!('cssRules' in rule)) continue;
    try {
      const nested: unknown = Reflect.get(rule, 'cssRules');
      if (isRuleCollection(nested)) scanRuleList(nested, state);
    } catch {
      state.declaresDirection = true;
      return;
    }
  }
}

function isRuleCollection(value: unknown): value is CSSRuleList | Iterable<CSSRule> {
  if (typeof CSSRuleList !== 'undefined' && value instanceof CSSRuleList) return true;
  if (Array.isArray(value)) return true;
  if (typeof value !== 'object' || value === null) return false;
  return typeof Reflect.get(value, Symbol.iterator) === 'function';
}
