/**
 * Snapshot mode for the cinder playground.
 *
 * When a page is loaded with `?snapshot=1`, the playground enters snapshot
 * mode: deterministic rendering without animation flicker, caret blink, or
 * font-loading jank. This is strictly opt-in — visiting any playground URL
 * WITHOUT `?snapshot=1` is byte-identical to the behavior before this module
 * existed.
 *
 * Font note: the codebase uses system font stacks via CSS variables
 * (`--cinder-font-sans`, `--cinder-font-mono`). No custom font file is
 * bundled, so `document.fonts.ready` resolves immediately in all tested
 * environments. No font-pinning asset is loaded here; this comment is the
 * Phase 1 audit record that font-pinning was evaluated and found unnecessary
 * for this codebase.
 *
 * Scrollbar hiding is intentionally NOT global. Components or fixtures that
 * need scrollbars hidden opt in via their own CSS selector. Adding a global
 * `::-webkit-scrollbar { display: none }` rule here would silently suppress
 * visible scrollbars that are part of the component's visual contract.
 */

/**
 * Detect whether snapshot mode is active from a URLSearchParams instance.
 *
 * Returns `true` only when the `snapshot` param is exactly `'1'`. Any other
 * value — absent, empty string, `'true'`, `'yes'` — returns `false`. The
 * strict equality prevents accidental activation via URL typos.
 */
export function isSnapshotMode(search: URLSearchParams): boolean {
  return search.get('snapshot') === '1';
}

/**
 * CSS rules that freeze motion in snapshot mode.
 *
 * Applied only inside `[data-snapshot-mode]` so normal playground pages are
 * completely unaffected. The `:not([data-preserve-motion])` and
 * `:not([data-preserve-motion] *)` guards let individual elements (e.g. a
 * loading spinner whose frozen state IS its visual contract) opt out by
 * receiving `data-preserve-motion` on themselves or a containing ancestor.
 */
export const SNAPSHOT_MODE_CSS = `
  /* Snapshot mode: zero all animation/transition durations so screenshots
     are stable. Elements with data-preserve-motion (or inside such an
     ancestor) are exempted — they render their own deterministic end state. */
  [data-snapshot-mode] *:not([data-preserve-motion]):not([data-preserve-motion] *) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }

  /* Hide text insertion carets globally. Prevents cursor-blink diffs between
     screenshot captures. */
  [data-snapshot-mode] {
    caret-color: transparent !important;
  }
`.trim();

/**
 * Return the HTML attribute string to add to the `<html>` element when
 * snapshot mode is active, or an empty string when it is not.
 *
 * Example return values:
 *   - snapshot active:   ` data-snapshot-mode=""`
 *   - snapshot inactive: `""`
 *
 * The attribute value is intentionally empty — its presence alone is the
 * signal; consumers should test `hasAttribute('data-snapshot-mode')`, not
 * the attribute's value.
 */
export function snapshotModeHtmlAttribute(active: boolean): string {
  return active ? ' data-snapshot-mode=""' : '';
}

/**
 * Return a `<style>` tag containing the snapshot-mode CSS when active, or an
 * empty string when inactive. Injected into the document `<head>` at render
 * time so it applies before any component JS runs.
 */
export function snapshotModeStyleTag(active: boolean): string {
  if (!active) return '';
  return `<style id="cinder-snapshot-mode">\n${SNAPSHOT_MODE_CSS}\n</style>`;
}
