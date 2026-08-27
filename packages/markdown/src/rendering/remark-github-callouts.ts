/**
 * Remark plugin: GitHub alert syntax → Cinder Callout markup.
 *
 * GitHub renders
 *
 * ```md
 * > [!WARNING]
 * > This API is deprecated.
 * ```
 *
 * as a colored admonition. That syntax is a GitHub extension, not GFM —
 * `remark-gfm` does not implement it — so without this plugin the marker
 * survives as literal text and the reader sees a plain blockquote whose first
 * line is a stray `[!WARNING]`.
 *
 * The rewrite targets Cinder's `<Callout>` markup (see
 * `packages/components/src/components/callout/callout.svelte`) so the result
 * picks up `callout.css` and re-themes with the rest of the design system,
 * rather than needing a parallel set of styles.
 *
 * Two deliberate narrowings versus the Svelte component:
 *
 *   - The `semantic: 'note'` form (`<div role="note">`) is emitted rather than
 *     the default `<aside>`. `div` is already in the sanitizer's tag
 *     allowlist; `aside` would have to be added, and an `<aside>` at
 *     top level is a `complementary` landmark, which is a heavier promise than
 *     an inline admonition should make.
 *   - The icon channel is skipped. Icons mean inline `<svg>`, and allowing
 *     `<svg>` through the sanitizer widens the XSS surface substantially for
 *     a purely decorative gain — the visible title already carries the
 *     meaning, and the component marks the icon `aria-hidden` anyway.
 *
 * Emitted markup is produced through mdast `data.hName` / `data.hProperties`
 * (which `mdast-util-to-hast` applies during the remark→rehype step) rather
 * than raw `html` nodes, because `render.ts` strips every `html` node before
 * conversion as an injection guard — a raw-HTML implementation would be
 * silently deleted.
 *
 * @module
 */

import type { Blockquote, Paragraph, PhrasingContent, Root, Text } from 'mdast';
import type { Plugin } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

/** Cinder Callout variants reachable from GitHub's five alert types. */
type CalloutVariant = 'info' | 'success' | 'warning' | 'danger';

type AlertKind = {
  /** `data-cinder-variant` value, which selects the color treatment. */
  variant: CalloutVariant;
  /** Visible title. Also becomes the root's accessible name. */
  title: string;
};

/**
 * Default titles, keyed by GitHub alert type.
 *
 * NOTE and IMPORTANT both land on the `info` variant — Cinder has no separate
 * "elevated neutral" — so the title is what keeps them distinguishable.
 */
const DEFAULT_TITLES: Readonly<Record<string, string>> = {
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
};

/** GitHub's five alert types, mapped onto Cinder's four variants. */
const VARIANTS: Readonly<Record<string, CalloutVariant>> = {
  NOTE: 'info',
  TIP: 'success',
  IMPORTANT: 'info',
  WARNING: 'warning',
  CAUTION: 'danger',
};

/**
 * The marker opens the blockquote's first line. Anything else on that line is
 * captured as a custom title.
 *
 * The custom-title capture is a deliberate superset of GitHub, which requires
 * the marker to sit alone and renders `> [!NOTE] Heads up` as a literal
 * blockquote. Cinder's Callout takes a `title` prop, so the trailing text has
 * an obvious home, and the repo's own docs already write alerts this way (see
 * `packages/chat/src/lib/components/chat/README.md`). Anchoring to the start
 * of the line still keeps prose that merely mentions `[!NOTE]` mid-sentence
 * from being promoted.
 *
 * Only a plain-text title is picked up. If the rest of the line carries inline
 * markup (`[!WARNING] \`someApi\` is deprecated`), markdown has already split
 * it into separate inline nodes, so the marker consumes just its own text run
 * and the styled remainder stays in the body under the default title.
 *
 * Case-insensitive, matching GitHub's acceptance of `[!note]`.
 */
const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][^\S\r\n]*([^\r\n]*)(?:\r?\n|$)/i;

/** Class list mirroring callout.svelte's root element. */
const ROOT_CLASSES = [
  'cinder-callout',
  'cinder-_status-surface',
  'cinder-_status-surface-border',
  'cinder-_status-surface-stripe',
];

/**
 * Read the alert marker off a blockquote, consuming it from the tree.
 *
 * Returns `null` — leaving the node untouched — unless the blockquote opens
 * with a paragraph whose first text run is exactly a marker line.
 */
function takeMarker(blockquote: Blockquote): AlertKind | null {
  const firstChild = blockquote.children[0];
  if (firstChild?.type !== 'paragraph') return null;

  const firstInline = firstChild.children[0];
  // Only a literal text run can carry the marker. If markdown parsed the
  // brackets into something else (a link reference resolved by a matching
  // definition, say), the author wrote a link, not an alert.
  if (firstInline?.type !== 'text') return null;

  const match = MARKER.exec(firstInline.value);
  if (!match) return null;

  const type = (match[1] ?? '').toUpperCase();
  const variant = VARIANTS[type];
  const defaultTitle = DEFAULT_TITLES[type];
  if (!variant || !defaultTitle) return null;

  // Consume the marker line. Everything after it on the same paragraph is
  // real content and stays.
  const remainder = firstInline.value.slice(match[0].length);
  if (remainder === '') {
    firstChild.children.shift();
    // `> [!NOTE]` with the body on following blocks leaves an empty paragraph
    // behind; drop it so the callout does not open with a blank line.
    if (firstChild.children.length === 0) blockquote.children.shift();
  } else {
    firstInline.value = remainder;
  }

  const customTitle = (match[2] ?? '').trim();
  return { variant, title: customTitle === '' ? defaultTitle : customTitle };
}

/** Build the `<p class="cinder-callout__title">` node. */
function titleParagraph(title: string): Paragraph {
  const text: Text = { type: 'text', value: title };
  return {
    type: 'paragraph',
    children: [text satisfies PhrasingContent],
    data: { hProperties: { className: ['cinder-callout__title'] } },
  };
}

/**
 * Rewrite GitHub alert blockquotes into Cinder Callout markup.
 *
 * Registered immediately after `remarkGfm` in `render.ts` so it sees the same
 * mdast GFM produces.
 */
export const remarkGithubCallouts: Plugin<[], Root> = () => {
  return (tree: Root): undefined => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const kind = takeMarker(node);
      if (!kind) return;

      // The content wrapper. Modeled as a blockquote (a block container, so
      // the mdast types stay honest about its children) that renders as a
      // plain `div` via `hName`.
      const content: Blockquote = {
        type: 'blockquote',
        children: node.children,
        data: { hName: 'div', hProperties: { className: ['cinder-callout__content'] } },
      };

      node.children = [titleParagraph(kind.title), content];
      node.data = {
        hName: 'div',
        hProperties: {
          className: ROOT_CLASSES,
          dataCinderVariant: kind.variant,
          role: 'note',
          ariaLabel: kind.title,
        },
      };

      // Do not descend. The subtree we just built contains a blockquote of our
      // own making, and GitHub does not nest alerts either.
      return SKIP;
    });
  };
};
