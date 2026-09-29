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
 *   the floor in `documentation/css-audit/translucent-border-seams.md`;
 * - a `mix` feeds the tier into `color-mix()`, where the result inherits a
 *   fraction of the transparency;
 * - an `occlusion` paints a tier across an element that something opaque then
 *   covers, so only a seam survives;
 * - an `alias` redeclares a tier under a component-token name whose consumers
 *   use it as a border, so it inherits the border case unchanged.
 *
 * The audit prose claimed to enumerate these twice and was wrong twice. Both
 * misses were the same mistake -- a sweep narrow enough to only find sites
 * shaped like the ones already found. The first looked for
 * `background: var(--cinder-border*)` in `components/cinder`, and missed
 * `background-image` gradients, `color:`, inset `box-shadow`, and the
 * component-token alias hop. The second widened the properties but stayed in
 * one package, and missed the `.svelte` `<style>` blocks in Chat, Editor, and
 * the playground.
 *
 * So the enumeration lives here instead, across every workspace that ships or
 * renders cinder styles, where an unclassified site is a failing test rather
 * than a document nobody re-derives. Adding a site is fine; adding one
 * silently is not.
 *
 * This is still a SOURCE-TEXT scan, and CIN-602 exists because a source-text
 * scan cannot see two shapes no matter how far it is widened: a tier
 * reference that only exists once the cascade resolves it ACROSS files (an
 * opacity in one file compounding with a tier border in another), and a
 * non-border use reached through a custom-property alias whose own tier
 * reference lives in a different rule entirely (often the generated
 * `:root` block, which this scan deliberately excludes). Those two shapes are
 * covered instead by
 * `packages/testing/tests/border-tier-computed-audit.playwright.ts`, which
 * reads the real, rendered cascade via CDP rather than grepping text -- see
 * that file, and `border-tier-audit.ts` next to it, for the mechanism.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, test } from 'bun:test';

type Category = 'hairline' | 'area' | 'mix' | 'occlusion' | 'alias';

/**
 * A component-facing token in the DTCG corpus whose value or `cssRecipe`
 * resolves to a structural tier. These never appear in a hand-authored
 * stylesheet -- they reach the page through the generated `tokens-base.css`,
 * which this guard skips because the corpus gates it -- so they have to be
 * classified from the corpus side or they are invisible here. The Toggle track
 * is why that matters: it is an area fill that no `.css` or `.svelte` file
 * mentions.
 */
export const CORPUS_ALIASES: Record<string, Classification> = {
  // Consumed as borders by their own components, so they inherit the border case.
  'button.border': { declaration: 'button.border', category: 'alias' },
  'status.neutral.border': { declaration: 'status.neutral.border', category: 'alias' },
  'border.inverse': { declaration: 'border.inverse', category: 'alias' },
  'file-upload.border-color': { declaration: 'file-upload.border-color', category: 'alias' },

  // The Toggle track: the tier fills the whole track in the light arm. The dark
  // arm is an independent literal and is untouched.
  'toggle.track.off-resting': {
    declaration: 'toggle.track.off-resting',
    category: 'area',
    audit: 'toggle',
  },
  'toggle.track.off-hover-resting': {
    declaration: 'toggle.track.off-hover-resting',
    category: 'area',
    audit: 'toggle',
  },
};

/** Package-relative corpus documents whose entries can alias a tier. */
export const CORPUS_DOCUMENTS = [
  'src/tokens/themes/light.tokens.json',
  'src/tokens/themes/dark.tokens.json',
  'src/tokens/sets/components.tokens.json',
  'src/tokens/sets/colors.tokens.json',
  'src/tokens/sets/semantic.tokens.json',
];

export const CORPUS_TIER =
  /\{border\.(?:muted|control|strong)\}|var\(--cinder-border(?:-muted|-strong)?\)/;

/**
 * Tier borders that sit in a rule which also sets `opacity`, so the element
 * opacity compounds with the tier's own alpha. Each one's effective contrast is
 * recorded in the seam audit.
 *
 * CIN-603 removed two former entries here rather than leaving them stale:
 * SortableList's drag placeholder (`outline: 2px dashed var(--cinder-border-muted)`
 * under `opacity: 0.4`) and Slider's tick (`background: var(--cinder-border,
 * currentColor)` under `opacity: 0.6`) both had their same-rule `opacity`
 * dropped, so neither compounds with a tier anymore -- see the seam audit's
 * "Tier borders under an element opacity" section for the retuned values.
 */
const OPACITY_COMPOUNDED: readonly string[] = [
  // A disabled Button. The block scan straddles rules inside `@layer` and finds
  // this one imprecisely, but it belongs here on the merits either way: the
  // border comes from `button.css` and `opacity: 0.6` from `foundation.css`'s
  // shared disabled-visual rule, so it is genuinely compounded -- just not by
  // anything visible in a single rule body.
  'components/cinder/src/components/button/button.css  border-color: var(--cinder-border-muted);',
];

type Classification = {
  /** The trimmed declaration, exactly as it appears in the source. */
  readonly declaration: string;
  readonly category: Category;
  /** For an `area`, the name the seam audit has to mention. */
  readonly audit?: string;
  /**
   * How many times this exact declaration appears in this file. Defaults to 1.
   *
   * `(file, declaration)` is not a unique key -- `component-page.svelte` already
   * carries `background: var(--cinder-border-muted);` twice, for two different
   * rules. Both are hairlines today, so the shared entry is correct, but a THIRD
   * occurrence that happened to be an area fill would silently inherit the
   * hairline category. Pinning the count means a new occurrence fails until
   * someone looks at it.
   */
  readonly occurrences?: number;
};

export const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

/**
 * Every place cinder styles are authored. `components/cinder/src/styles`
 * carries the shared partials; the sibling workspaces render with the same
 * tokens, so a tier used as a fill there changed rendering just as much.
 */
const SCAN_ROOTS = [
  ['components/cinder/src/components', 'components/cinder/src/components'],
  ['components/cinder/src/styles', 'components/cinder/src/styles'],
  ['components/chat/src', 'components/chat/src'],
  ['components/editor/src', 'components/editor/src'],
  ['applications/desktop/src', 'applications/desktop/src'],
  ['packages/components/src/components', 'components/cinder/src/components'],
  ['packages/components/src/styles', 'components/cinder/src/styles'],
  ['packages/chat/src', 'components/chat/src'],
  ['packages/editor/src', 'components/editor/src'],
] as const;

/** `tokens-base.css` is generated from the corpus, where the aliases are already gated. */
const GENERATED = 'tokens-base.css';

const TIER_REFERENCE = /var\(--cinder-border(?:-muted|-strong)?[\s,)]/;
const BORDER_PROPERTY = /^(?:border|outline)(?:-[a-z-]+)?$/;

/**
 * Every classified site, keyed by FILE and declaration.
 *
 * Keyed by file deliberately. An earlier version matched on declaration text
 * alone, with a per-file map layered on top for the exceptions -- which meant a
 * NEW multi-pixel fill spelled `background: var(--cinder-border);` silently
 * inherited the generic `hairline` entry and sailed through both this test and
 * the area-audit gate without anyone looking at it. The guard defaulted to the
 * permissive answer, which is the one thing a guard must never do. Now an
 * unlisted site is an unlisted site, whatever it is spelled like.
 */
export const CLASSIFIED: Record<string, readonly Classification[]> = {
  'components/chat/src/lib/components/chat/message/chat-date-separator.svelte': [
    { declaration: 'background: var(--cinder-border-muted);', category: 'hairline' },
  ],
  'components/chat/src/lib/components/chat/message/chat-message.svelte': [
    {
      declaration:
        'background: color-mix(in oklch, var(--cinder-surface), var(--cinder-border-muted) 10%);',
      category: 'mix',
    },
  ],
  'components/chat/src/lib/components/chat/message/entry-frame.svelte': [
    { declaration: 'background: var(--cinder-border);', category: 'area', audit: 'entry-frame' },
  ],
  'components/chat/src/lib/components/chat/message/parts/reasoning-part.svelte': [
    { declaration: '--cinder-chat-reasoning-border: var(--cinder-border);', category: 'alias' },
  ],
  'components/chat/src/lib/components/chat/message/parts/suggestion-part.svelte': [
    { declaration: '--cinder-chat-suggestion-border: var(--cinder-border);', category: 'alias' },
  ],
  'components/chat/src/lib/components/chat/artifact/artifact-panel.svelte': [
    { declaration: 'box-shadow: inset 0 -1px 0 var(--cinder-border-muted);', category: 'hairline' },
  ],
  'components/cinder/src/components/button-group/button-group.css': [
    { declaration: 'background: var(--cinder-border);', category: 'hairline' },
  ],
  'components/cinder/src/components/chip/chip.css': [
    { declaration: 'var(--cinder-border) 65%', category: 'mix' },
  ],
  'components/cinder/src/components/color-field/color-field.css': [
    { declaration: 'var(--cinder-border) 45%,', category: 'area', audit: 'color-field' },
    { declaration: 'var(--cinder-border) 55%,', category: 'area', audit: 'color-field' },
  ],
  'components/cinder/src/components/data-grid/data-grid.css': [
    { declaration: 'inset -1px 0 0 var(--cinder-border),', category: 'hairline' },
    { declaration: 'inset 1px 0 0 var(--cinder-border),', category: 'hairline' },
  ],
  'components/cinder/src/components/divider/divider.css': [
    { declaration: 'background-color: var(--cinder-border-muted);', category: 'hairline' },
    { declaration: 'background-color: var(--cinder-border-strong);', category: 'hairline' },
  ],
  'components/cinder/src/components/drawer/drawer.css': [
    { declaration: 'background: var(--cinder-border);', category: 'area', audit: 'drawer' },
  ],
  'components/cinder/src/components/feed-boundary/feed-boundary.css': [
    { declaration: 'background: var(--cinder-border-muted);', category: 'hairline' },
  ],
  'components/cinder/src/components/feed-event/feed-event.css': [
    { declaration: 'background: var(--cinder-border-muted);', category: 'hairline' },
    {
      declaration: 'background: var(--cinder-border-strong);',
      category: 'area',
      audit: 'feed-event',
    },
  ],
  'components/cinder/src/components/kbd/kbd.css': [
    { declaration: 'box-shadow: inset 0 -1px 0 var(--cinder-border-muted);', category: 'hairline' },
  ],
  'components/cinder/src/components/media-controls/media-controls.css': [
    {
      declaration: 'background-color: var(--cinder-border);',
      category: 'area',
      audit: 'media-controls',
    },
  ],
  'components/cinder/src/components/mega-menu/mega-menu.css': [
    // CIN-603: moved from `border.muted` to `border.control`.
    {
      declaration: 'background: var(--cinder-border);',
      category: 'area',
      audit: 'mega-menu',
    },
  ],
  'components/cinder/src/components/parameter-field/parameter-field.css': [
    // CIN-603: moved from `border.muted` to `border.control`.
    {
      declaration: 'background: var(--cinder-border);',
      category: 'area',
      audit: 'parameter-field',
    },
  ],
  'components/cinder/src/components/rating/rating.css': [
    {
      declaration: '--_cinder-rating-empty: var(--cinder-border-strong);',
      category: 'area',
      audit: 'rating',
    },
  ],
  'components/cinder/src/components/resizable-panels/resizable-panels.css': [
    {
      declaration: 'color: var(--cinder-border-strong);',
      category: 'area',
      audit: 'resizable-panels',
    },
  ],
  'components/cinder/src/components/run-step-timeline/run-step-timeline.css': [
    { declaration: 'background: var(--cinder-border-muted);', category: 'hairline' },
  ],
  'components/cinder/src/components/slider/slider.css': [
    {
      declaration: 'background: var(--cinder-border, currentColor);',
      category: 'area',
      audit: 'slider',
    },
  ],
  'components/cinder/src/components/statistic-group/statistic-group.css': [
    { declaration: 'background: var(--cinder-border);', category: 'occlusion' },
  ],
  'components/cinder/src/components/status-dot/status-dot.css': [
    {
      declaration: '--cinder-status-dot-color: var(--cinder-border-strong);',
      category: 'area',
      audit: 'status-dot',
    },
  ],
  'components/cinder/src/components/steps/steps.css': [
    { declaration: 'background: var(--cinder-border-muted);', category: 'hairline' },
    {
      declaration: 'box-shadow: inset 0 0 0 1px var(--cinder-border-muted);',
      category: 'hairline',
    },
  ],
  'components/cinder/src/components/timeline/timeline.css': [
    { declaration: 'background: var(--cinder-border-muted);', category: 'hairline' },
  ],
  'components/cinder/src/styles/components/_row-item.css': [
    { declaration: 'background: var(--cinder-border-muted);', category: 'hairline' },
  ],
  'components/editor/src/lib/components/markdown-editor/editor-toolbar/toolbar-separator.svelte': [
    { declaration: 'background: var(--cinder-border);', category: 'hairline' },
  ],
  'components/editor/src/lib/components/review-editor/review-editor-controls.svelte': [
    { declaration: 'background: var(--cinder-border);', category: 'hairline' },
  ],
};

function styleFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...styleFiles(path));
      continue;
    }
    if (path.endsWith('.css') || path.endsWith('.svelte')) found.push(path);
  }
  return found;
}

/**
 * Every tier reference in `source` that is not the value of a `border*` or
 * `outline*` declaration, as trimmed declaration text.
 *
 * Split on `;` rather than by line so an inline `style="…; border: 1px solid
 * var(--cinder-border-muted)"` on markup is read the same way as a rule in a
 * `<style>` block.
 */
function tierUseFromFragment(line: string, fragment: string): string | undefined {
  if (!TIER_REFERENCE.test(fragment)) return undefined;
  const attribute = fragment.lastIndexOf('="');
  const trimmed = (attribute === -1 ? fragment : fragment.slice(attribute + 2)).trim();
  const colon = trimmed.indexOf(':');
  const property = colon === -1 ? '' : trimmed.slice(0, colon).trim();
  if (BORDER_PROPERTY.test(property)) return undefined;
  return line.includes(`${trimmed};`) ? `${trimmed};` : trimmed;
}

function tierUses(source: string): string[] {
  const uses: string[] = [];
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!TIER_REFERENCE.test(line)) continue;
    // A tier named in prose is not a use.
    if (line.startsWith('*') || line.startsWith('//') || line.startsWith('/*')) continue;
    for (const fragment of line.split(';')) {
      const use = tierUseFromFragment(line, fragment);
      if (use !== undefined) uses.push(use);
    }
  }
  return uses;
}

/**
 * Every use site in the repository, as `[relativePath, declaration]`.
 *
 * Memoised: every test in this file needs the whole list, and the walk reads
 * ~250 `.css` and `.svelte` files across six workspace roots. The filesystem
 * does not change during a run.
 */
let cachedUseSites: Array<readonly [string, string]> | undefined;

export function allUseSites(): Array<readonly [string, string]> {
  return (cachedUseSites ??= scanUseSites());
}

function scanUseSites(): Array<readonly [string, string]> {
  const sites: Array<readonly [string, string]> = [];
  for (const [root, canonicalRoot] of SCAN_ROOTS) {
    const absoluteRoot = join(REPOSITORY_ROOT, root);
    if (!statSync(absoluteRoot, { throwIfNoEntry: false })) continue;
    for (const path of styleFiles(absoluteRoot)) {
      if (path.endsWith(GENERATED)) continue;
      const relativePath = relative(REPOSITORY_ROOT, path).replace(root, canonicalRoot);
      for (const use of tierUses(readFileSync(path, 'utf8'))) sites.push([relativePath, use]);
    }
  }
  return sites;
}

export function classify(file: string, declaration: string): Classification | undefined {
  const listed = CLASSIFIED[file]?.find((entry) => entry.declaration === declaration);
  if (listed !== undefined) return listed;
  return undefined;
}

describe('CIN-245: structural border tiers used outside a border declaration', () => {
  test('a tier under an element opacity is classified', () => {
    // A fractional element `opacity` multiplies the tier's own alpha, so
    // composing the tier compounds with it rather than replacing an opaque
    // value. That matters for EVERY tier declaration, not only the borders the
    // scan above exempts -- an area fill under an opacity is measured wrong by
    // the audit unless the opacity is folded in. Both shapes are here:
    // SortableList's `border.muted` outline under `opacity: 0.4` (40% effective
    // ink to 7.6%), and Slider's tick, a `border.control` FILL under
    // `opacity: 0.6`, whose real contrast is ~1.9 rather than the 3.1-3.6 the
    // tier measures undiluted.
    //
    // This is meant to catch the same-rule shape only, and the Button entry in
    // `OPACITY_COMPOUNDED` below is legitimately caught by it, but not for the
    // reason its own comment gives. `button.css` has an icon-only-variant
    // disabled rule that pairs `border-color: var(--cinder-border-muted)` and
    // `opacity: 0.6` in ONE rule body -- a genuine same-rule match, which is
    // what this scan actually finds. The disabled Button ALSO matches
    // `foundation.css`'s broader shared disabled-visual rule at the same time
    // (its selector list matches any disabled `.cinder-button`, icon-only
    // variants included), which redundantly contributes the identical
    // `opacity: 0.6` from a second file -- real, but not what this same-rule
    // scan is seeing here. The shape this scan genuinely CANNOT see is the
    // PLAIN (non-icon-only) disabled button: `button.css`'s base disabled rule
    // sets `border-color` alone and says so explicitly ("opacity centralized
    // in foundation.css disabled-visual rule"), relying entirely on that other
    // file for its opacity -- no rule in either file pairs the two for that
    // element. CIN-602's
    // `packages/testing/tests/border-tier-computed-audit.playwright.ts` proves
    // BOTH shapes from the real cascade via CDP's `CSS.getMatchedStylesForNode`:
    // the icon-only Button's same-rule-plus-shared-rule compound, and the
    // plain (secondary-variant) disabled Button's cross-file-only compound,
    // each with its own `AUDITED_SITES` entry.
    const offenders: string[] = [];
    for (const [root, canonicalRoot] of SCAN_ROOTS) {
      const absoluteRoot = join(REPOSITORY_ROOT, root);
      if (!statSync(absoluteRoot, { throwIfNoEntry: false })) continue;
      for (const path of styleFiles(absoluteRoot)) {
        if (path.endsWith(GENERATED)) continue;
        const source = readFileSync(path, 'utf8');
        // Rule bodies, roughly: everything between a `{` and the next `}`.
        for (const block of source.split('}')) {
          const body = block.slice(block.lastIndexOf('{') + 1);
          // A FRACTIONAL resting opacity. `opacity: 0` is the entry state of
          // an animated overlay -- HoverCard, Popover, Modal, CommandPalette
          // all declare it and all resolve to 1 once open -- and `opacity: 1`
          // multiplies by nothing.
          if (!/(?:^|[;\s])opacity\s*:\s*0?\.\d+\s*(?:;|$)/.test(body)) continue;
          for (const rawFragment of body.split(';')) {
            const fragment = rawFragment.trim();
            if (!TIER_REFERENCE.test(fragment)) continue;
            const site = `${relative(REPOSITORY_ROOT, path).replace(root, canonicalRoot)}  ${fragment};`;
            if (!OPACITY_COMPOUNDED.includes(site)) offenders.push(site);
          }
        }
      }
    }
    expect(
      offenders,
      'A structural tier is used as a border or outline in a rule that also sets `opacity`. ' +
        "Element opacity multiplies the tier's own alpha, so this is not the plain border case " +
        'the scan above exempts -- record it here and give its effective contrast in the seam ' +
        'audit.',
    ).toEqual([]);
  });
});
