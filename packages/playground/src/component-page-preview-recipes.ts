/**
 * Per-component preview scaffolding for the classes of component that no amount
 * of prop seeding can make legible.
 *
 * Three of them:
 *
 *  - LAYOUT primitives (`Container`, `Grid`, `BentoCell`, `Masonry`) render a box
 *    whose entire job is arranging children. With one text run there are no
 *    columns, no tracks, and no gutters to see — and unlike a static example,
 *    placeholder children re-flow live as `columns` / `minItemWidth` / `maxWidth`
 *    change, which is exactly what the reader came to the playground for.
 *  - STYLING primitives (`Surface`) are invisible in isolation: with no reference
 *    surface beside it, a tone is just "the page", and `surface.css` sets no
 *    padding so text sits flush against the border.
 *  - BEHAVIOR-only wrappers (`FocusTrap`, `ClickAwayListener`, `LocaleProvider`,
 *    `Portal`) render their children and nothing else. There is no visual state a
 *    recipe could make legible, so they route to their authored example instead,
 *    which demonstrates the behavior interactively.
 *
 * The markup here is a repo constant, never reader input, which is why it is
 * inserted raw rather than through the escaping path `toMountProps` uses for the
 * editable `children` text control.
 */

/** Scaffolding for one component's live-preview stage. */
export type PreviewRecipe = {
  /**
   * Deterministic props required for a meaningful bare preview but not useful
   * as editable controls. In particular, controls whose contract requires an
   * accessible name receive a domain-specific name here rather than mounting
   * in a warning-producing state.
   */
  props?: Readonly<Record<string, unknown>>;
  /**
   * Raw HTML mounted as the component's `children`, replacing the synthesized
   * name-as-text seed.
   */
  childrenHtml?: string;
  /**
   * Raw HTML rendered as a SIBLING of the component inside the stage, before it.
   * Used to give a styling primitive something to be compared against.
   */
  referenceHtml?: string;
  /**
   * True when the component has no useful bare preview at all and should fall
   * through to its authored example.
   *
   * Deliberately separate from `requiresExamplePlayground`, which additionally
   * suppresses the prop CONTROLS. A reader on `Portal` still wants to see
   * `target` / `disabled` / `inheritAttributes` listed.
   */
  prefersFeaturedExample?: boolean;
};

/** Three numbered placeholder boxes, so a layout's tracks and gutters are visible. */
const PLACEHOLDER_BOXES = [1, 2, 3]
  .map(
    (n) =>
      `<div class="dx-recipe-box" style="padding:var(--cinder-space-4);border:1px dashed var(--cinder-border);border-radius:var(--cinder-radius-sm);background:var(--cinder-surface-inset);color:var(--cinder-text-muted);font-family:var(--cinder-font-mono);font-size:var(--cinder-text-xs)">Item ${n}</div>`,
  )
  .join('');

const LAYOUT_RECIPE: PreviewRecipe = { childrenHtml: PLACEHOLDER_BOXES };

export const PREVIEW_RECIPES: Readonly<Record<string, PreviewRecipe>> = {
  'floating-action': { props: { 'aria-label': 'Create item' } },
  meter: { props: { ariaLabel: 'Storage usage' } },
  'phone-input': { props: { id: 'playground-phone-input', label: 'Phone number' } },
  'pin-input': { props: { id: 'playground-pin-input', label: 'Verification code' } },
  progress: { props: { ariaLabel: 'Task progress' } },
  rating: { props: { id: 'playground-rating', label: 'Rating' } },
  container: LAYOUT_RECIPE,
  grid: LAYOUT_RECIPE,
  'grid-item': LAYOUT_RECIPE,
  'bento-cell': LAYOUT_RECIPE,
  masonry: LAYOUT_RECIPE,
  'aspect-ratio': {
    childrenHtml:
      '<div style="display:grid;place-items:center;block-size:100%;background:var(--cinder-surface-inset);color:var(--cinder-text-muted);font-family:var(--cinder-font-mono);font-size:var(--cinder-text-xs)">Aspect-ratio content</div>',
  },
  surface: {
    // A tone is only readable against another tone, and the component itself
    // supplies no padding — so the recipe supplies both the reference and the
    // inner spacing.
    referenceHtml:
      '<div style="padding:var(--cinder-space-4);border-radius:var(--cinder-radius-md);background:var(--cinder-surface);color:var(--cinder-text-muted);font-size:var(--cinder-text-sm)">Reference surface (default tone)</div>',
    childrenHtml:
      '<div style="padding:var(--cinder-space-4);color:var(--cinder-text);font-size:var(--cinder-text-sm)">This Surface, at the selected tone</div>',
  },
  'focus-trap': { prefersFeaturedExample: true },
  'click-away-listener': { prefersFeaturedExample: true },
  portal: { prefersFeaturedExample: true },
  // LocaleProvider renders a bare `{@render children?.()}` and ships no example,
  // so there is nothing to show either way. Marking it keeps the stage from
  // reserving a frame that never fills.
  'locale-provider': { prefersFeaturedExample: true },
};

/** The recipe for a component, or `undefined` when it needs no scaffolding. */
export function previewRecipeFor(kebabName: string): PreviewRecipe | undefined {
  return PREVIEW_RECIPES[kebabName];
}
