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
 *   covers, so only a seam survives;
 * - an `alias` redeclares a tier under a component-token name whose consumers
 *   use it as a border, so it inherits the border case unchanged.
 *
 * The audit prose claimed to enumerate these twice and was wrong twice. Both
 * misses were the same mistake -- a sweep narrow enough to only find sites
 * shaped like the ones already found. The first looked for
 * `background: var(--cinder-border*)` in `packages/components`, and missed
 * `background-image` gradients, `color:`, inset `box-shadow`, and the
 * component-token alias hop. The second widened the properties but stayed in
 * one package, and missed the `.svelte` `<style>` blocks in Chat, Editor, and
 * the playground.
 *
 * So the enumeration lives here instead, across every workspace that ships or
 * renders cinder styles, where an unclassified site is a failing test rather
 * than a document nobody re-derives. Adding a site is fine; adding one
 * silently is not.
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
const CORPUS_ALIASES: Record<string, Classification> = {
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

/** Corpus documents whose entries can alias a tier. */
const CORPUS_DOCUMENTS = [
  'packages/components/src/tokens/themes/light.tokens.json',
  'packages/components/src/tokens/themes/dark.tokens.json',
  'packages/components/src/tokens/sets/components.tokens.json',
  'packages/components/src/tokens/sets/colors.tokens.json',
  'packages/components/src/tokens/sets/semantic.tokens.json',
];

const CORPUS_TIER =
  /\{border\.(?:muted|control|strong)\}|var\(--cinder-border(?:-muted|-strong)?\)/;

type Classification = {
  /** The trimmed declaration, exactly as it appears in the source. */
  readonly declaration: string;
  readonly category: Category;
  /** For an `area`, the name the seam audit has to mention. */
  readonly audit?: string;
};

const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

/**
 * Every place cinder styles are authored. `packages/components/src/styles`
 * carries the shared partials; the sibling workspaces render with the same
 * tokens, so a tier used as a fill there changed rendering just as much.
 */
const SCAN_ROOTS = [
  'packages/components/src/components',
  'packages/components/src/styles',
  'packages/chat/src',
  'packages/editor/src',
  'packages/playground/src',
];

/** `tokens-base.css` is generated from the corpus, where the aliases are already gated. */
const GENERATED = 'tokens-base.css';

const TIER_REFERENCE = /var\(--cinder-border(?:-muted|-strong)?[\s,)]/;
const BORDER_PROPERTY = /^(?:border|outline)(?:-[a-z-]+)?$/;

const CLASSIFIED: readonly Classification[] = [
  // --- hairlines: a 1px rule drawn as a filled element or an inset shadow ---
  { declaration: 'background: var(--cinder-border-muted);', category: 'hairline' },
  { declaration: 'background-color: var(--cinder-border-muted);', category: 'hairline' },
  { declaration: 'background-color: var(--cinder-border-strong);', category: 'hairline' },
  { declaration: 'background: var(--cinder-border);', category: 'hairline' },
  // Kbd's keycap underline and Steps' skipped-marker ring. An inset shadow is
  // clipped to the padding box, so it lands on the pixel BESIDE a border rather
  // than on it -- measured, not assumed: the two rows at Kbd's bottom edge read
  // rgb(210,211,213) and rgb(141,144,148) rather than one combined row.
  { declaration: 'box-shadow: inset 0 -1px 0 var(--cinder-border-muted);', category: 'hairline' },
  { declaration: 'box-shadow: inset 0 0 0 1px var(--cinder-border-muted);', category: 'hairline' },
  // DataGrid's pinned columns: same adjacency, on the cell's inline-end edge.
  { declaration: 'inset -1px 0 0 var(--cinder-border),', category: 'hairline' },
  { declaration: 'inset 1px 0 0 var(--cinder-border),', category: 'hairline' },

  // --- areas: the tier's alpha is visible over whatever is behind it ---
  {
    declaration: 'background: var(--cinder-border, currentColor);',
    category: 'area',
    audit: 'slider',
  },
  {
    declaration: 'background-color: var(--cinder-border);',
    category: 'area',
    audit: 'media-controls',
  },
  {
    declaration: 'color: var(--cinder-border-strong);',
    category: 'area',
    audit: 'resizable-panels',
  },
  {
    declaration: 'background: var(--cinder-border-strong);',
    category: 'area',
    audit: 'feed-event',
  },
  {
    declaration: '--_cinder-rating-empty: var(--cinder-border-strong);',
    category: 'area',
    audit: 'rating',
  },
  {
    declaration: '--cinder-status-dot-color: var(--cinder-border-strong);',
    category: 'area',
    audit: 'status-dot',
  },
  { declaration: 'var(--cinder-border) 45%,', category: 'area', audit: 'color-field' },
  { declaration: 'var(--cinder-border) 55%,', category: 'area', audit: 'color-field' },

  // --- component-token aliases, consumed as borders by their own components ---
  { declaration: '--cinder-chat-reasoning-border: var(--cinder-border);', category: 'alias' },
  { declaration: '--cinder-chat-suggestion-border: var(--cinder-border);', category: 'alias' },
  { declaration: '--cinder-chat-tool-approval-border: var(--cinder-border);', category: 'alias' },

  // --- mixes and occlusions ---
  { declaration: 'var(--cinder-border) 65%', category: 'mix' },
  {
    declaration:
      'background: color-mix(in oklch, var(--cinder-surface), var(--cinder-border-muted) 10%);',
    category: 'mix',
  },
];

/**
 * Sites whose classification depends on the FILE, not just the declaration
 * text -- `background: var(--cinder-border-muted)` is a 1px rule in most
 * places and a 3px rail in ParameterField.
 */
const BY_FILE: Record<string, readonly Classification[]> = {
  'packages/components/src/components/parameter-field/parameter-field.css': [
    {
      declaration: 'background: var(--cinder-border-muted);',
      category: 'area',
      audit: 'parameter-field',
    },
  ],
  'packages/components/src/components/mega-menu/mega-menu.css': [
    {
      declaration: 'background: var(--cinder-border-muted);',
      category: 'area',
      audit: 'mega-menu',
    },
  ],
  'packages/components/src/components/drawer/drawer.css': [
    { declaration: 'background: var(--cinder-border);', category: 'area', audit: 'drawer' },
  ],
  'packages/components/src/components/statistic-group/statistic-group.css': [
    { declaration: 'background: var(--cinder-border);', category: 'occlusion' },
  ],
  'packages/chat/src/lib/components/chat/message/entry-frame.svelte': [
    { declaration: 'background: var(--cinder-border);', category: 'area', audit: 'entry-frame' },
  ],
  'packages/playground/src/component-page.svelte': [
    { declaration: 'background: var(--cinder-border-muted);', category: 'hairline' },
    {
      declaration: 'background: var(--cinder-border-strong);',
      category: 'area',
      audit: 'dx-stage',
    },
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
function tierUses(source: string): string[] {
  const uses: string[] = [];
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!TIER_REFERENCE.test(line)) continue;
    // A tier named in prose is not a use.
    if (line.startsWith('*') || line.startsWith('//') || line.startsWith('/*')) continue;
    for (const fragment of line.split(';')) {
      if (!TIER_REFERENCE.test(fragment)) continue;
      // An inline `style="border: …"` arrives with the attribute still
      // attached, so the property would read as `style="border`.
      const attribute = fragment.lastIndexOf('="');
      const trimmed = (attribute === -1 ? fragment : fragment.slice(attribute + 2)).trim();
      const colon = trimmed.indexOf(':');
      const property = colon === -1 ? '' : trimmed.slice(0, colon).trim();
      if (BORDER_PROPERTY.test(property)) continue;
      // Restore the `;` that `split` removed, so the recorded text matches the
      // source for a complete declaration.
      uses.push(line.includes(`${trimmed};`) ? `${trimmed};` : trimmed);
    }
  }
  return uses;
}

/** Every use site in the repository, as `[relativePath, declaration]`. */
function allUseSites(): Array<readonly [string, string]> {
  const sites: Array<readonly [string, string]> = [];
  for (const root of SCAN_ROOTS) {
    for (const path of styleFiles(join(REPOSITORY_ROOT, root))) {
      if (path.endsWith(GENERATED)) continue;
      const relativePath = relative(REPOSITORY_ROOT, path);
      for (const use of tierUses(readFileSync(path, 'utf8'))) sites.push([relativePath, use]);
    }
  }
  return sites;
}

/**
 * The documentation placeholder hatch, built out of a doubly-diluted tier in
 * eleven `packages/playground/src/examples/**` files. One shape, many copies,
 * and not part of the shipped component surface -- matched by shape rather
 * than transcribed eleven times.
 */
const PLACEHOLDER_HATCH =
  /^background: repeating-linear-gradient\(-45deg,.*color-mix\(in oklch, var\(--cinder-border-muted\), transparent \d+%\)/;

function classify(file: string, declaration: string): Classification | undefined {
  const byFile = BY_FILE[file]?.find((entry) => entry.declaration === declaration);
  if (byFile !== undefined) return byFile;
  const exact = CLASSIFIED.find((entry) => entry.declaration === declaration);
  if (exact !== undefined) return exact;
  if (file.startsWith('packages/playground/src/examples/') && PLACEHOLDER_HATCH.test(declaration)) {
    return { declaration, category: 'mix' };
  }
  return undefined;
}

describe('CIN-245: structural border tiers used outside a border declaration', () => {
  test('every site in every workspace is classified', () => {
    const unclassified = allUseSites()
      .filter(([file, declaration]) => classify(file, declaration) === undefined)
      .map(([file, declaration]) => `${file}  ${declaration}`);

    expect(
      unclassified,
      'A structural border tier is used outside a border declaration at a site that is not ' +
        "classified. Every such use carries the tier's alpha somewhere a border would not: " +
        'decide whether it is a hairline, an area, a mix, or an occlusion, add it here, and ' +
        'record an area in docs/css-audit/translucent-border-seams.md with its measured ' +
        'contrast.',
    ).toEqual([]);
  });

  test('the file-specific classifications all still exist', () => {
    const sites = new Set(allUseSites().map(([file, declaration]) => `${file}  ${declaration}`));
    const stale: string[] = [];
    for (const [file, entries] of Object.entries(BY_FILE)) {
      for (const entry of entries) {
        if (!sites.has(`${file}  ${entry.declaration}`))
          stale.push(`${file}  ${entry.declaration}`);
      }
    }
    expect(stale, 'A classified site no longer exists; remove it.').toEqual([]);
  });

  test('every corpus alias into a tier is classified', () => {
    const unclassified: string[] = [];
    for (const document of CORPUS_DOCUMENTS) {
      const parsed: unknown = JSON.parse(readFileSync(join(REPOSITORY_ROOT, document), 'utf8'));
      const walk = (node: unknown, path: string[]): void => {
        if (typeof node !== 'object' || node === null) return;
        const entry = node as Record<string, unknown>;
        const extensions = entry['$extensions'] as Record<string, unknown> | undefined;
        const cinder = extensions?.['com.lostgradient.cinder'] as
          | Record<string, unknown>
          | undefined;
        for (const candidate of [cinder?.['cssRecipe'], entry['$value']]) {
          if (typeof candidate !== 'string' || !CORPUS_TIER.test(candidate)) continue;
          const name = path.join('.');
          if (CORPUS_ALIASES[name] === undefined) unclassified.push(`${document}  ${name}`);
        }
        for (const [key, child] of Object.entries(entry)) {
          if (key.startsWith('$')) continue;
          walk(child, [...path, key]);
        }
      };
      walk(parsed, []);
    }
    expect(
      [...new Set(unclassified)],
      'A corpus token aliases a structural tier. It reaches the page through the generated ' +
        'stylesheet, so no hand-authored file mentions it and the scan above cannot see it. ' +
        'Classify it here, and if it is an area fill, record it in the seam audit.',
    ).toEqual([]);
  });

  test('every area fill is named in the seam audit', () => {
    const audit = readFileSync(
      join(REPOSITORY_ROOT, 'packages/components/docs/css-audit/translucent-border-seams.md'),
      'utf8',
    );
    const missing = new Set<string>();
    for (const [file, declaration] of allUseSites()) {
      const entry = classify(file, declaration);
      if (entry?.category !== 'area') continue;
      const name = entry.audit ?? file;
      if (!audit.includes(name)) missing.add(name);
    }
    for (const entry of Object.values(CORPUS_ALIASES)) {
      if (entry.category !== 'area') continue;
      const name = entry.audit ?? entry.declaration;
      if (!audit.includes(name)) missing.add(name);
    }
    expect(
      [...missing],
      'An area fill carries the tier alpha over a real surface, so the audit has to name it ' +
        'and record its measured contrast.',
    ).toEqual([]);
  });
});
