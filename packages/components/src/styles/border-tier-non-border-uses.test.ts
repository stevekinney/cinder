/**
 * CIN-245: every use of a structural border tier OUTSIDE a `border`/`outline`
 * declaration is classified, and the classification is checked rather than
 * asserted.
 *
 * The three tiers -- `--cinder-border-muted`, `--cinder-border`, and
 * `--cinder-border-strong` -- became alpha over one ink. Wherever one is used
 * as a border that is exactly the intent. Wherever one is used as something
 * else, it now carries transparency into a place that was previously opaque,
 * and each of those places needs a deliberate answer:
 *
 * - a `hairline` behaves identically to a border, because a 1px rule sits
 *   directly on one surface and composites once;
 * - an `area` covers more than a hairline, so the tier's alpha is visible over
 *   whatever is behind it -- these are the sites whose contrast has to clear
 *   the floor in `docs/css-audit/translucent-border-seams.md`;
 * - a `mix` feeds the tier into `color-mix()`, where the result inherits a
 *   fraction of the transparency;
 * - an `occlusion` paints a tier across an element that something opaque then
 *   covers, so only a seam survives.
 *
 * The audit prose claimed to enumerate these twice and was wrong twice -- a
 * `background:`-only sweep missed `background-image` gradients, `color:`, inset
 * `box-shadow`, and component-token aliases. So the enumeration lives here
 * instead, where an unclassified site is a failing test rather than a document
 * nobody re-derives. Adding a site is fine; adding one silently is not.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, test } from 'bun:test';

type Category = 'hairline' | 'area' | 'mix' | 'occlusion';

const STYLES_DIRECTORY = import.meta.dirname;
const COMPONENTS_DIRECTORY = join(STYLES_DIRECTORY, '..', 'components');

/**
 * A tier reference that is NOT the value of a `border*` or `outline*`
 * declaration. Matches the three structural tiers only: `border.faint` is
 * still opaque and `border.ink` is the source rather than a tier.
 */
const TIER_REFERENCE = /var\(--cinder-border(?:-muted|-strong)?[\s,)]/;
const BORDER_DECLARATION = /^\s*(?:border|outline)(?:-[a-z-]+)?\s*:/;
const CUSTOM_PROPERTY_DECLARATION = /^\s*--/;

/**
 * Every classified site, keyed by path relative to `src/`. The value is the
 * trimmed source line, so a new use in a classified file fails just as loudly
 * as a use in a new file.
 */
const CLASSIFIED: Record<string, ReadonlyArray<readonly [string, Category]>> = {
  'styles/components/_row-item.css': [['background: var(--cinder-border-muted);', 'hairline']],
  'components/kbd/kbd.css': [
    // Sits inside the padding box, so it lands on the pixel ABOVE the border
    // rather than on it -- measured, not assumed: the two rows read
    // rgb(210,211,213) and rgb(141,144,148) rather than one combined row.
    ['box-shadow: inset 0 -1px 0 var(--cinder-border-muted);', 'hairline'],
  ],
  'components/run-step-timeline/run-step-timeline.css': [
    ['background: var(--cinder-border-muted);', 'hairline'],
  ],
  'components/steps/steps.css': [
    ['box-shadow: inset 0 0 0 1px var(--cinder-border-muted);', 'hairline'],
    ['background: var(--cinder-border-muted);', 'hairline'],
  ],
  'components/divider/divider.css': [
    ['background-color: var(--cinder-border-muted);', 'hairline'],
    ['background-color: var(--cinder-border-strong);', 'hairline'],
  ],
  'components/timeline/timeline.css': [['background: var(--cinder-border-muted);', 'hairline']],
  'components/feed-boundary/feed-boundary.css': [
    ['background: var(--cinder-border-muted);', 'hairline'],
  ],
  'components/data-grid/data-grid.css': [
    // Same adjacency as Kbd: the pin shadow is inset, so it sits beside the
    // cell's own `border-inline-end` rather than on top of it.
    ['inset -1px 0 0 var(--cinder-border),', 'hairline'],
    ['inset 1px 0 0 var(--cinder-border),', 'hairline'],
  ],
  'components/button-group/button-group.css': [['background: var(--cinder-border);', 'hairline']],
  'components/feed-event/feed-event.css': [
    ['background: var(--cinder-border-strong);', 'area'],
    ['background: var(--cinder-border-muted);', 'hairline'],
  ],
  'components/parameter-field/parameter-field.css': [
    ['background: var(--cinder-border-muted);', 'area'],
  ],
  'components/drawer/drawer.css': [['background: var(--cinder-border);', 'area']],
  'components/mega-menu/mega-menu.css': [['background: var(--cinder-border-muted);', 'area']],
  'components/rating/rating.css': [
    ['--_cinder-rating-empty: var(--cinder-border-strong);', 'area'],
  ],
  'components/status-dot/status-dot.css': [
    ['--cinder-status-dot-color: var(--cinder-border-strong);', 'area'],
  ],
  'components/slider/slider.css': [['background: var(--cinder-border, currentColor);', 'area']],
  'components/resizable-panels/resizable-panels.css': [
    ['color: var(--cinder-border-strong);', 'area'],
  ],
  'components/color-field/color-field.css': [
    ['var(--cinder-border) 45%,', 'area'],
    ['var(--cinder-border) 55%,', 'area'],
  ],
  'components/media-controls/media-controls.css': [
    ['background-color: var(--cinder-border);', 'area'],
  ],
  'components/statistic-group/statistic-group.css': [
    ['background: var(--cinder-border);', 'occlusion'],
  ],
  'components/chip/chip.css': [['var(--cinder-border) 65%', 'mix']],
};

function cssFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...cssFiles(path));
      continue;
    }
    if (path.endsWith('.css')) found.push(path);
  }
  return found;
}

/** Every non-border tier reference in `path`, as trimmed source lines. */
function tierUses(path: string): string[] {
  const uses: string[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!TIER_REFERENCE.test(line)) continue;
    if (BORDER_DECLARATION.test(line)) continue;
    // A component-token alias is a corpus concern, gated by the token pipeline
    // and measured in `check-token-contrast.test.ts`; the two here are local
    // `--_cinder-*` privates and stay in scope.
    if (CUSTOM_PROPERTY_DECLARATION.test(line) && !line.includes('--cinder-status-dot-color')) {
      if (!line.trimStart().startsWith('--_cinder')) continue;
    }
    const trimmed = line.trim();
    // A tier named in prose is not a use.
    if (trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    uses.push(trimmed);
  }
  return uses;
}

describe('CIN-245: structural border tiers used outside a border declaration', () => {
  test('every site is classified', () => {
    const root = join(STYLES_DIRECTORY, '..');
    const found: Record<string, string[]> = {};
    for (const path of [...cssFiles(COMPONENTS_DIRECTORY), ...cssFiles(STYLES_DIRECTORY)]) {
      // `tokens-base.css` is generated from the corpus, where the aliases are
      // already gated; it is not a hand-authored use site.
      if (path.endsWith('tokens-base.css')) continue;
      const uses = tierUses(path);
      if (uses.length > 0) found[relative(root, path)] = uses;
    }

    const unclassified: string[] = [];
    for (const [file, uses] of Object.entries(found)) {
      const expected = (CLASSIFIED[file] ?? []).map(([snippet]) => snippet);
      for (const use of uses) {
        if (!expected.includes(use)) unclassified.push(`${file}  ${use}`);
      }
    }

    expect(
      unclassified,
      'A structural border tier is used outside a border declaration at a site that is not ' +
        "classified. Every such use carries the tier's alpha somewhere a border would not: " +
        'decide whether it is a hairline, an area, a mix, or an occlusion, add it to ' +
        'CLASSIFIED here, and record an area in docs/css-audit/translucent-border-seams.md ' +
        'with its measured contrast.',
    ).toEqual([]);
  });

  test('the classification has no stale entries', () => {
    const root = join(STYLES_DIRECTORY, '..');
    const found = new Set<string>();
    for (const path of [...cssFiles(COMPONENTS_DIRECTORY), ...cssFiles(STYLES_DIRECTORY)]) {
      if (path.endsWith('tokens-base.css')) continue;
      for (const use of tierUses(path)) found.add(`${relative(root, path)}  ${use}`);
    }

    const stale: string[] = [];
    for (const [file, entries] of Object.entries(CLASSIFIED)) {
      for (const [snippet] of entries) {
        if (!found.has(`${file}  ${snippet}`)) stale.push(`${file}  ${snippet}`);
      }
    }

    expect(stale, 'A classified site no longer exists; remove it from CLASSIFIED.').toEqual([]);
  });

  test('every area fill is named in the seam audit', () => {
    const audit = readFileSync(
      join(STYLES_DIRECTORY, '..', '..', 'docs', 'css-audit', 'translucent-border-seams.md'),
      'utf8',
    );
    const missing: string[] = [];
    for (const [file, entries] of Object.entries(CLASSIFIED)) {
      if (!entries.some(([, category]) => category === 'area')) continue;
      // The audit names components by slug, which is the directory name.
      const slug = file.split('/').at(-2) ?? file;
      if (!audit.includes(slug)) missing.push(slug);
    }
    expect(
      missing,
      'An area fill carries the tier alpha over a real surface, so the audit has to name it ' +
        'and record its measured contrast.',
    ).toEqual([]);
  });
});
