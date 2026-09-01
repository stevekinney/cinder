/**
 * The `tokens:generate` CLI entry point.
 *
 * `generate.ts` owns `tokens-base.css` and the resolved-context JSON files
 * (Stage 4's artifacts) and stays a pure library with no CLI trigger of its
 * own -- it cannot import this package's token registry (`registry.ts`)
 * without creating an import cycle, because `registry.ts` itself reuses
 * `generate.ts`'s corpus-walking machinery (`collectEntries`, `loadCorpus`,
 * `CorpusEntry`). This file is the one place allowed to depend on BOTH: it
 * assembles every `tokens:generate` output --
 *
 *   - `tokens-base.css` and `src/tokens/resolved/*.json` (delegated to
 *     `generate.ts`'s `buildGeneratedOutputs`, unchanged from Stage 4)
 *   - `src/tokens/registry.generated.json` (Stage 5 deliverable 1 -- the
 *     machine-readable registry CIN-32/CIN-34 are blocked on, and the data
 *     CIN-31 imports `registry.ts`'s extraction to build a package-exported
 *     module from)
 *   - `docs/tokens.md`'s generated token tables, rewritten between
 *     `<!-- BEGIN/END GENERATED TOKEN TABLE -->` markers (Stage 5 deliverable
 *     2) -- hand-written prose outside the markers is preserved (Prettier
 *     reformats the spliced document as a whole, so that prose keeps its
 *     content and structure but not necessarily its exact bytes)
 *   - `packages/playground/src/shell-app/color-token-registry.generated.ts`
 *     (Stage 5 deliverable 3's data half; `color-token-registry.ts` stays
 *     hand-written and imports this). The data itself -- group membership,
 *     labels, member order -- is authored in the corpus, at the foundation
 *     set's `com.lostgradient.cinder.playgroundGroups` resolver extension
 *     (`cinder.resolver.json`), not in this script: the playground panel
 *     must carry no hand-maintained color-token list of its own, and a
 *     literal array in this file would just move that list's ADDRESS, not
 *     eliminate it. See {@link readPlaygroundColorTokenGroups}.
 *
 * -- and drives the shared `--check`/write contract `generate.ts`'s CSS/JSON
 * pair already established, now across every artifact at once.
 */

import { mkdir, readFile } from 'node:fs/promises';

import { format } from 'prettier';
import babelPlugin from 'prettier/plugins/babel';
import estreePlugin from 'prettier/plugins/estree';
import markdownPlugin from 'prettier/plugins/markdown';
import typescriptPlugin from 'prettier/plugins/typescript';

import {
  buildGeneratedOutputs,
  colorTokenRegistryGeneratedPath,
  type CorpusEntry,
  findDriftedPaths,
  JSON_PLUGINS,
  loadCorpus,
  PRETTIER_OPTIONS,
  readExisting,
  REGENERATE_COMMAND,
  registryJsonPath,
  registryModulePath,
  RESOLVED_CONTEXT_COMBOS,
  resolvedDirectory,
  serializeEntryValue,
  tokenIndexPath,
  tokensDocPath,
} from './generate.ts';
import {
  buildBaseDocuments,
  buildBaseIndex,
  buildTokenRegistryFromIndexes,
  serializeTokenRegistry,
  themeAwarePaths,
  type TokenRegistry,
} from './registry.ts';
import { createValueResolver, type ValueResolver } from './resolve.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';

const MARKDOWN_PLUGINS = [markdownPlugin];
const TYPESCRIPT_PLUGINS = [typescriptPlugin, estreePlugin, babelPlugin];

// ---------------------------------------------------------------------------
// docs/tokens.md -- generated token tables between BEGIN/END markers.
// ---------------------------------------------------------------------------

/**
 * The section-to-token curation the docs generator regenerates from. This is
 * docs/tokens.md's editorial structure (which cssProperties are documented
 * under which heading, and in what order) -- NOT derivable from corpus
 * `category`/`component` metadata alone, since the doc groups by reader
 * intent (e.g. "Status — solid" vs. "Status — semantic triples" are both
 * corpus `category: "color"`). Mirrors the established pattern of curating
 * membership in the generator itself (see `check-pipeline-coverage.ts`'s
 * `DECLARATION_TABLE`, `component-conventions.ts`'s checklist source of
 * truth): adding a token to the corpus requires a human decision about which
 * doc section it belongs under, so it is added here too. `validateDocSections`
 * (below) fails `tokens:generate` loudly if a corpus token is left out, listed
 * twice, or a section here has no matching marker in docs/tokens.md.
 */
/**
 * `headings` is the trail of enclosing Markdown headings written EXACTLY as
 * they appear in the document -- hashes included -- outermost first, below the
 * document title. `buildTokensDocMarkdown` compares it to the marker's actual
 * trail for equality.
 *
 * Two earlier, weaker forms each left a hole. Matching the leaf label alone let
 * `### Base` and its marker move beneath a different `##` parent, since the six
 * button sections nest under `## Button`. Matching a suffix of label-only
 * entries then let a section be DEMOTED -- `## Spacing` becoming `### Spacing`
 * under `## Typography` still ends in `Spacing`. Carrying the hashes pins the
 * level and the ancestry together, and has the side benefit of being checkable
 * against the document by eye.
 */
export type DocSection = {
  slug: string;
  headings: readonly string[];
  cssProperties: readonly string[];
};

const DOC_SECTIONS: readonly DocSection[] = [
  {
    slug: 'spacing',
    headings: ['## Spacing'],
    cssProperties: [
      '--cinder-space-0',
      '--cinder-space-0-5',
      '--cinder-space-1',
      '--cinder-space-1-5',
      '--cinder-space-2',
      '--cinder-space-2-5',
      '--cinder-space-3',
      '--cinder-space-3-5',
      '--cinder-space-4',
      '--cinder-space-5',
      '--cinder-space-6',
      '--cinder-space-7',
      '--cinder-space-8',
      '--cinder-space-10',
      '--cinder-space-12',
      '--cinder-space-16',
      '--cinder-space-20',
      '--cinder-space-24',
      '--cinder-space-32',
    ],
  },
  {
    slug: 'radii-and-shadows',
    headings: ['## Radii and shadows'],
    cssProperties: [
      '--cinder-radius-sm',
      '--cinder-radius-md',
      '--cinder-radius-lg',
      '--cinder-radius-full',
      '--cinder-shadow-sm',
      '--cinder-shadow-md',
      '--cinder-shadow-lg',
      '--cinder-shadow-overlay',
    ],
  },
  {
    slug: 'control-heights',
    headings: ['## Control heights'],
    cssProperties: [
      '--cinder-control-height-xs',
      '--cinder-control-height-sm',
      '--cinder-control-height-lg',
    ],
  },
  {
    slug: 'typography',
    headings: ['## Typography'],
    cssProperties: [
      '--cinder-font-sans',
      '--cinder-font-mono',
      '--cinder-text-2xs',
      '--cinder-text-xs',
      '--cinder-text-sm',
      '--cinder-text-base',
      '--cinder-text-md',
      '--cinder-text-lg',
      '--cinder-text-xl',
      '--cinder-text-2xl',
      '--cinder-text-3xl',
      '--cinder-text-4xl',
      '--cinder-text-5xl',
      '--cinder-leading-none',
      '--cinder-leading-tight',
      '--cinder-leading-snug',
      '--cinder-leading-normal',
      '--cinder-leading-relaxed',
      '--cinder-tracking-tight',
      '--cinder-tracking-normal',
      '--cinder-tracking-wide',
      '--cinder-font-normal',
      '--cinder-font-medium',
      '--cinder-font-semibold',
      '--cinder-font-bold',
      '--cinder-type-tab-size',
      '--cinder-touch-target-min',
    ],
  },
  {
    slug: 'layout',
    headings: ['## Layout'],
    cssProperties: [
      '--cinder-content-width',
      '--cinder-content-width-prose',
      '--cinder-content-width-narrow',
      '--cinder-content-width-wide',
    ],
  },
  {
    slug: 'motion',
    headings: ['## Motion'],
    cssProperties: [
      '--cinder-duration-instant',
      '--cinder-duration-fast',
      '--cinder-duration-base',
      '--cinder-duration-normal',
      '--cinder-duration-moderate',
      '--cinder-duration-slow',
      '--cinder-duration-spin',
      '--cinder-duration-pulse',
      '--cinder-duration-progress-bar-indeterminate',
      '--cinder-duration-progress-ring-spin',
      '--cinder-ease-standard',
      '--cinder-ease-decelerate',
      '--cinder-ease-accelerate',
      '--cinder-ease-spring',
      '--cinder-ease-in-out',
    ],
  },
  {
    slug: 'surfaces',
    headings: ['## Surfaces'],
    cssProperties: [
      '--cinder-surface-canvas',
      '--cinder-surface',
      '--cinder-surface-raised',
      '--cinder-surface-inset',
      '--cinder-surface-hover',
      '--cinder-surface-pressed',
      '--cinder-surface-raised-hover',
      '--cinder-surface-raised-pressed',
      '--cinder-surface-upcoming-marker',
      '--cinder-surface-inverse',
      '--cinder-text-inverse',
      '--cinder-border-inverse',
    ],
  },
  {
    slug: 'text-colors',
    headings: ['## Text colors'],
    cssProperties: [
      '--cinder-text-default',
      '--cinder-text-muted',
      '--cinder-text-subtle',
      '--cinder-text-disabled',
      '--cinder-fill-disabled',
      '--cinder-terminal-ansi-black',
      '--cinder-terminal-ansi-red',
      '--cinder-terminal-ansi-green',
      '--cinder-terminal-ansi-yellow',
      '--cinder-terminal-ansi-blue',
      '--cinder-terminal-ansi-magenta',
      '--cinder-terminal-ansi-cyan',
      '--cinder-terminal-ansi-white',
      '--cinder-terminal-ansi-bright-black',
      '--cinder-terminal-ansi-bright-red',
      '--cinder-terminal-ansi-bright-green',
      '--cinder-terminal-ansi-bright-yellow',
      '--cinder-terminal-ansi-bright-blue',
      '--cinder-terminal-ansi-bright-magenta',
      '--cinder-terminal-ansi-bright-cyan',
      '--cinder-terminal-ansi-bright-white',
    ],
  },
  {
    slug: 'borders',
    headings: ['## Borders'],
    cssProperties: [
      '--cinder-border',
      '--cinder-border-faint',
      '--cinder-border-muted',
      '--cinder-border-strong',
      '--cinder-toggle-track-off-resting',
      '--cinder-toggle-track-off-hover-resting',
    ],
  },
  {
    slug: 'opacity',
    headings: ['## Opacity'],
    cssProperties: [
      '--cinder-opacity-disabled',
      '--cinder-opacity-muted',
      '--cinder-opacity-faint',
    ],
  },
  {
    slug: 'accent',
    headings: ['## Accent'],
    cssProperties: [
      '--cinder-accent-solid',
      '--cinder-accent-contrast',
      '--cinder-accent-text',
      '--cinder-accent-text-hover',
      '--cinder-accent-solid-hover',
      '--cinder-accent-solid-active',
      '--cinder-accent-solid-active-on-fill',
    ],
  },
  {
    slug: 'semantic-aliases',
    headings: ['## Semantic aliases'],
    cssProperties: [
      '--cinder-pad-control',
      '--cinder-pad-card',
      '--cinder-gap-stack',
      '--cinder-gap-inline',
      '--cinder-radius-control',
      '--cinder-radius-surface',
    ],
  },
  {
    slug: 'status-solid',
    headings: ['## Status — solid'],
    cssProperties: [
      '--cinder-status-info-solid',
      '--cinder-status-success-solid',
      '--cinder-status-warning-solid',
      '--cinder-status-danger-solid',
      '--cinder-status-danger-contrast',
      '--cinder-status-danger-solid-hover',
      '--cinder-status-danger-solid-active',
      '--cinder-status-info-solid-hover',
      '--cinder-status-info-solid-active',
      '--cinder-status-success-solid-hover',
      '--cinder-status-success-solid-active',
      '--cinder-status-warning-solid-hover',
      '--cinder-status-warning-solid-active',
      '--cinder-status-success-contrast',
      '--cinder-status-warning-contrast',
      '--cinder-status-info-contrast',
      '--cinder-severity-critical',
      '--cinder-severity-critical-background',
    ],
  },
  {
    slug: 'status-semantic-triples',
    headings: ['## Status — semantic triples'],
    cssProperties: [
      '--cinder-status-info-background',
      '--cinder-status-info-text',
      '--cinder-status-info-border',
      '--cinder-status-success-background',
      '--cinder-status-success-text',
      '--cinder-status-success-border',
      '--cinder-status-warning-background',
      '--cinder-status-warning-text',
      '--cinder-status-warning-border',
      '--cinder-status-danger-background',
      '--cinder-status-danger-text',
      '--cinder-status-danger-border',
      '--cinder-status-neutral-background',
      '--cinder-status-neutral-text',
      '--cinder-status-neutral-border',
      '--cinder-accent-background',
      // `--cinder-accent-text` is documented in the Accent section. The soft
      // family's foreground was a pure alias of it and folded into it during the
      // CIN-33 rename, so it is no longer a separate token to list here.
      '--cinder-accent-border',
      '--cinder-status-info-muted',
      '--cinder-status-info-subtle',
      '--cinder-status-success-muted',
      '--cinder-status-success-subtle',
      '--cinder-status-warning-muted',
      '--cinder-status-warning-subtle',
      '--cinder-status-danger-muted',
      '--cinder-status-danger-subtle',
    ],
  },
  {
    slug: 'transparency-checkerboard',
    headings: ['## Transparency checkerboard'],
    cssProperties: ['--cinder-checker-base', '--cinder-checker-tile'],
  },
  {
    slug: 'chart-series',
    headings: ['## Chart series'],
    cssProperties: [
      '--cinder-chart-series-1',
      '--cinder-chart-series-2',
      '--cinder-chart-series-3',
      '--cinder-chart-series-4',
      '--cinder-chart-series-5',
      '--cinder-chart-series-6',
      '--cinder-chart-series-7',
      '--cinder-chart-series-8',
    ],
  },
  {
    slug: 'focus-ring',
    headings: ['## Focus ring'],
    cssProperties: [
      '--cinder-ring-width',
      '--cinder-ring-offset',
      '--cinder-ring-offset-color',
      '--cinder-ring-color',
      '--cinder-ring-on-accent',
    ],
  },
  {
    slug: 'z-index-layers',
    headings: ['## Z-index layers'],
    cssProperties: [
      '--cinder-z-tooltip',
      '--cinder-z-dropdown',
      '--cinder-z-popover',
      '--cinder-z-backdrop',
      '--cinder-z-modal',
      '--cinder-z-toast',
      '--cinder-z-focused-affordance',
      '--cinder-z-drag-preview',
    ],
  },
  {
    slug: 'overlay-surfaces',
    headings: ['## Overlay surfaces'],
    cssProperties: [
      '--cinder-overlay-backdrop',
      '--cinder-overlay-blur',
      '--cinder-overlay-padding',
      '--cinder-overlay-radius',
    ],
  },
  {
    slug: 'scrollbars',
    headings: ['## Scrollbars'],
    cssProperties: [
      '--cinder-scrollbar-size',
      '--cinder-scrollbar-track',
      '--cinder-scrollbar-thumb',
      '--cinder-scrollbar-thumb-hover',
    ],
  },
  {
    slug: 'button-base',
    headings: ['## Button', '### Base'],
    cssProperties: [
      '--cinder-button-background',
      '--cinder-button-foreground',
      '--cinder-button-border',
      '--cinder-button-radius',
    ],
  },
  {
    slug: 'button-size-xs',
    headings: ['## Button', '### Size: xs'],
    cssProperties: [
      '--cinder-button-padding-x-xs',
      '--cinder-button-padding-y-xs',
      '--cinder-button-height-xs',
      '--cinder-button-font-size-xs',
      '--cinder-button-radius-xs',
    ],
  },
  {
    slug: 'button-size-sm',
    headings: ['## Button', '### Size: sm'],
    cssProperties: [
      '--cinder-button-padding-x-sm',
      '--cinder-button-padding-y-sm',
      '--cinder-button-height-sm',
      '--cinder-button-font-size-sm',
      '--cinder-button-radius-sm',
    ],
  },
  {
    slug: 'button-size-md',
    headings: ['## Button', '### Size: md'],
    cssProperties: [
      '--cinder-button-padding-x-md',
      '--cinder-button-padding-y-md',
      '--cinder-button-height-md',
      '--cinder-button-font-size-md',
      '--cinder-button-radius-md',
    ],
  },
  {
    slug: 'button-size-lg',
    headings: ['## Button', '### Size: lg'],
    cssProperties: [
      '--cinder-button-padding-x-lg',
      '--cinder-button-padding-y-lg',
      '--cinder-button-height-lg',
      '--cinder-button-font-size-lg',
      '--cinder-button-radius-lg',
    ],
  },
  {
    slug: 'button-size-xl',
    headings: ['## Button', '### Size: xl'],
    cssProperties: [
      '--cinder-button-padding-x-xl',
      '--cinder-button-padding-y-xl',
      '--cinder-button-height-xl',
      '--cinder-button-font-size-xl',
      '--cinder-button-radius-xl',
    ],
  },
  {
    slug: 'accordion-item',
    headings: ['## Component tokens', '### Accordion Item'],
    cssProperties: [
      '--cinder-accordion-item-trigger-gap',
      '--cinder-accordion-item-trigger-padding-block',
      '--cinder-accordion-item-trigger-padding-inline',
      '--cinder-accordion-item-trigger-font-size',
      '--cinder-accordion-item-trigger-font-weight',
      '--cinder-accordion-item-panel-inner-padding-block-start',
      '--cinder-accordion-item-panel-inner-padding-block-end',
      '--cinder-accordion-item-panel-inner-padding-inline',
      '--cinder-accordion-item-panel-font-size',
      '--cinder-accordion-item-panel-line-height',
    ],
  },
  {
    slug: 'action-row',
    headings: ['## Component tokens', '### Action Row'],
    cssProperties: [
      '--cinder-action-row-padding-block',
      '--cinder-action-row-padding-inline',
      '--cinder-action-row-layout-column-gap',
      '--cinder-action-row-layout-row-gap',
      '--cinder-action-row-body-gap',
      '--cinder-action-row-title-font-size',
      '--cinder-action-row-description-font-size',
      '--cinder-action-row-meta-font-size',
      '--cinder-action-row-trailing-gap',
    ],
  },
  {
    slug: 'alert',
    headings: ['## Component tokens', '### Alert'],
    cssProperties: ['--cinder-alert-info'],
  },
  {
    slug: 'avatar-group',
    headings: ['## Component tokens', '### Avatar Group'],
    cssProperties: ['--cinder-avatar-group-overlap'],
  },
  {
    slug: 'card',
    headings: ['## Component tokens', '### Card'],
    cssProperties: ['--cinder-card-mobile-bleed'],
  },
  {
    slug: 'carousel',
    headings: ['## Component tokens', '### Carousel'],
    cssProperties: [
      '--cinder-carousel-slide-size',
      '--cinder-carousel-gap',
      '--cinder-carousel-aspect-ratio',
      '--cinder-carousel-dot-size',
    ],
  },
  {
    slug: 'code-block',
    headings: ['## Component tokens', '### Code Block'],
    cssProperties: [
      '--cinder-code-block-background',
      '--cinder-code-block-font-size',
      '--cinder-code-block-height',
      '--cinder-code-block-line-height',
      '--cinder-code-block-padding',
    ],
  },
  {
    slug: 'data-table',
    headings: ['## Component tokens', '### Data Table'],
    cssProperties: ['--cinder-data-table-height'],
  },
  {
    slug: 'feed-event',
    headings: ['## Component tokens', '### Feed Event'],
    cssProperties: ['--cinder-feed-event-rail-size'],
  },
  {
    slug: 'file-upload',
    headings: ['## Component tokens', '### File Upload'],
    cssProperties: [
      '--cinder-file-upload-background',
      '--cinder-file-upload-border-color',
      '--cinder-file-upload-progress-background',
      '--cinder-file-upload-progress-fill',
    ],
  },
  {
    slug: 'kanban-board',
    headings: ['## Component tokens', '### Kanban Board'],
    cssProperties: [
      '--cinder-kanban-column-width',
      '--cinder-kanban-column-gap',
      '--cinder-kanban-column-background',
      '--cinder-kanban-card-background',
      '--cinder-kanban-board-scroll-edge',
    ],
  },
  {
    slug: 'marquee',
    headings: ['## Component tokens', '### Marquee'],
    cssProperties: ['--cinder-marquee-duration', '--cinder-marquee-gap'],
  },
  {
    slug: 'modal',
    headings: ['## Component tokens', '### Modal'],
    cssProperties: ['--cinder-modal-backdrop'],
  },
  {
    slug: 'selectable-row',
    headings: ['## Component tokens', '### Selectable Row'],
    cssProperties: [
      '--cinder-selectable-row-padding-block',
      '--cinder-selectable-row-padding-inline',
      '--cinder-selectable-row-column-gap',
      '--cinder-selectable-row-content-gap',
      '--cinder-selectable-row-leading-gap',
      '--cinder-selectable-row-trailing-actions-gap',
    ],
  },
  {
    slug: 'side-navigation',
    headings: ['## Component tokens', '### Side Navigation'],
    cssProperties: ['--cinder-side-navigation-list-gap'],
  },
  {
    slug: 'spinner',
    headings: ['## Component tokens', '### Spinner'],
    cssProperties: ['--cinder-spinner-indicator', '--cinder-spinner-size'],
  },
  {
    slug: 'statistic',
    headings: ['## Component tokens', '### Statistic'],
    cssProperties: [
      '--cinder-statistic-row-gap',
      '--cinder-statistic-column-gap',
      '--cinder-statistic-label-font-size',
      '--cinder-statistic-value-font-size',
      '--cinder-statistic-value-font-weight',
      '--cinder-statistic-value-line-height',
      '--cinder-statistic-change-gap',
      '--cinder-statistic-change-font-size',
    ],
  },
  {
    slug: 'statistic-group',
    headings: ['## Component tokens', '### Statistic Group'],
    cssProperties: [
      '--cinder-statistic-group-gap',
      '--cinder-statistic-group-card-padding',
      '--cinder-statistic-group-shared-cell-padding',
    ],
  },
  {
    slug: 'status-dot',
    headings: ['## Component tokens', '### Status Dot'],
    cssProperties: ['--cinder-status-dot-color', '--cinder-status-dot-size'],
  },
  {
    slug: 'table-of-contents',
    headings: ['## Component tokens', '### Table Of Contents'],
    cssProperties: [
      '--cinder-table-of-contents-link-color',
      '--cinder-table-of-contents-link-active-color',
      '--cinder-table-of-contents-link-indent-step',
    ],
  },
  {
    slug: 'tree',
    headings: ['## Component tokens', '### Tree'],
    cssProperties: [
      '--cinder-tree-drop-line-color',
      '--cinder-tree-drop-line-thickness',
      '--cinder-tree-item-dragging-opacity',
    ],
  },
  {
    slug: 'virtual-list',
    headings: ['## Component tokens', '### Virtual List'],
    cssProperties: ['--cinder-virtual-list-height'],
  },
];

/**
 * `\r?\n` rather than `\n`: the repository has no `.gitattributes` pinning
 * `eol`, so a checkout with `core.autocrlf=true` gives `docs/tokens.md` CRLF
 * endings. Matching only `\n` would then find no blocks at all and the
 * generator would report every marker missing while every marker is present.
 */
export const DOC_MARKER_PATTERN =
  /<!-- BEGIN GENERATED TOKEN TABLE: ([a-z0-9-]+) -->\r?\n[\s\S]*?<!-- END GENERATED TOKEN TABLE -->/g;

/**
 * The literal marker text `buildTokensDocMarkdown` splices on. Corpus strings
 * are interpolated into the generated block, so a description or value
 * containing one of these would be written inside the table and then read back
 * as the block's own delimiter on the next scan: the rewrite would terminate at
 * the injected text, leave the real remainder stranded, and `tokens:generate
 * -- --check` could never stabilize -- a self-inflicted, permanent failure of a
 * required gate.
 *
 * This is rejected rather than escaped on purpose. Neutralizing the text would
 * change how a cell is represented, which under this file's own rule means the
 * drift parser has to change with it; and there is no representation that both
 * hides the marker from this regex and still renders inside a code span, where
 * HTML entities are not decoded. Refusing to emit a document that cannot be
 * regenerated stably is the honest boundary.
 */
const GENERATED_MARKER_FRAGMENTS = [
  '<!-- BEGIN GENERATED TOKEN TABLE',
  '<!-- END GENERATED TOKEN TABLE',
] as const;

/**
 * Checked against the NORMALIZED cell, not the raw source string. `toTableCell`
 * collapses interior line breaks to single spaces, so normalization can
 * SYNTHESIZE a marker that the raw text does not contain -- a description
 * carrying `<!-- END\nGENERATED TOKEN TABLE -->` passes a raw scan and then
 * collapses into the exact closing marker.
 */
function assertNoGeneratedMarkers(text: string, field: string, cssProperty: string): void {
  for (const fragment of GENERATED_MARKER_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(
        `The ${field} for "${cssProperty}" contains the generated-table marker ` +
          `"${fragment}", which would terminate the block it is written into. ` +
          `Remove the marker text from the token source.`,
      );
    }
  }
}

/**
 * Every `DOC_SECTIONS` cssProperty must resolve to a real corpus token, must
 * not be listed twice, and every registry token must appear in EXACTLY one
 * section -- the same "documents exactly the tokens declared" completeness
 * guarantee `tokens-doc-drift.test.ts` enforced against `tokens-base.css`
 * before this stage, now enforced at generate time against the registry.
 */
function validateDocSections(registry: TokenRegistry): void {
  const allCssProperties = DOC_SECTIONS.flatMap((section) => section.cssProperties);

  // Membership, not truthiness: `collectEntries` gives a document-level `$root`
  // token the path "" (a shape `resolve.test.ts` supports), and an empty string is
  // falsy, so a truthiness check would report a legitimately-present token absent.
  const unknown = allCssProperties.filter(
    (cssProperty) => !Object.hasOwn(registry.cssPropertyToPath, cssProperty),
  );
  if (unknown.length > 0) {
    throw new Error(
      `docs/tokens.md's DOC_SECTIONS (generate-artifacts.ts) references cssProperties that ` +
        `are not in the corpus: ${unknown.join(', ')}.`,
    );
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const cssProperty of allCssProperties) {
    if (seen.has(cssProperty)) duplicates.add(cssProperty);
    seen.add(cssProperty);
  }
  if (duplicates.size > 0) {
    throw new Error(
      `docs/tokens.md's DOC_SECTIONS lists these cssProperties in more than one section: ` +
        `${[...duplicates].join(', ')}.`,
    );
  }

  const missing = registry.entries
    .map((entry) => entry.cssProperty)
    .filter((cssProperty) => !seen.has(cssProperty));
  if (missing.length > 0) {
    throw new Error(
      `docs/tokens.md's DOC_SECTIONS (generate-artifacts.ts) is missing these corpus tokens: ` +
        `${missing.join(', ')}. Add each to a section, or a new one, so it is documented.`,
    );
  }
}

/**
 * Makes ANY string safe to sit inside one Markdown table cell.
 *
 * Deliberately ONE function used for every cell rather than per-column
 * handling. Descriptions and values were sanitized by two parallel code paths,
 * and each hazard was fixed on one path while the other kept it: newline
 * normalization landed on descriptions only, then pipe escaping landed on
 * descriptions before values, then value pipes were escaped without teaching
 * the drift parser to decode them. Routing every cell through one function is
 * what stops the next hazard from being fixed in only half the places.
 *
 * A line break terminates the row, and GFM reads `|` as a column delimiter even
 * inside a backtick code span, so both must go.
 */
function toCodeSpan(content: string): string {
  // CommonMark: a code span's delimiter must be a backtick run longer than any
  // run inside it, and the content needs one space of padding when it starts or
  // ends with a backtick. Hard-coding a single backtick would let a value
  // containing one close the span early, producing malformed Markdown that the
  // drift parser then reads back truncated.
  const longestRun = [...content.matchAll(/`+/g)].reduce(
    (longest, match) => Math.max(longest, match[0].length),
    0,
  );
  const fence = '`'.repeat(longestRun + 1);
  const padding = content.startsWith('`') || content.endsWith('`') ? ' ' : '';
  return `${fence}${padding}${content}${padding}${fence}`;
}

/**
 * Escapes a `|` in a cell body so GFM always reads it as a literal pipe, never a
 * column delimiter -- WITHOUT double-escaping a value that already contains a
 * `\|` (a value that, taken alone, is itself a legally-escaped pipe).
 *
 * Unconditionally appending a backslash (`.replaceAll('|', '\\|')`, this
 * function's predecessor) turns an already-escaped `foo\|bar` into
 * `foo\\|bar`: GFM's left-to-right backslash pairing reads the two leading
 * backslashes as one escaped backslash, leaving the `|` unescaped after all --
 * a malformed row (see this file's git history for the CIN-470 fix, and
 * `tokens-doc-drift.test.ts`'s `extractDocTokens`, which decodes the inverse
 * of exactly this).
 *
 * Naively conditioning on "escape only when the existing run is already odd"
 * is not the fix: `foo|bar` (0 backslashes) and `foo\|bar` (1 backslash) would
 * both then encode to the identical cell text `foo\|bar`, which no decoder can
 * un-collapse back to two different originals -- and `tokens-doc-drift.test.ts`
 * must decode ANY corpus value back to itself, not just the ones the corpus
 * happens to contain today. So the run of backslashes immediately preceding
 * each `|` is DOUBLED first (protecting every backslash that was already
 * there, the same way any backslash-escaping scheme must protect its own
 * escape character) and only THEN is the escaping backslash for the pipe
 * itself appended -- a run of length `k` becomes `2k + 1`, always odd (GFM
 * escaped), and losslessly invertible: `extractDocTokens` recovers `k` as
 * `(2k + 1 - 1) / 2`.
 */
function normalizeTableCell(text: string): string {
  return text.replaceAll(/\s*[\r\n]\s*/g, ' ').trim();
}

function toTableCell(text: string): string {
  return normalizeTableCell(text).replace(
    /(\\*)\|/g,
    (_match, backslashes: string) => `${backslashes}${backslashes}\\|`,
  );
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('|', '&#124;');
}

function renderValueCell(value: string): string {
  // Backslash-escaped pipes cannot be displayed faithfully inside a Markdown
  // code span: CommonMark preserves the escape characters there. HTML entities
  // display the exact value while escaping both Markdown and HTML metacharacters,
  // so emphasis-like or tag-like token values stay literal.
  if (value.includes('|')) return escapeHtml(value);
  return toCodeSpan(value);
}

export async function renderDocTable(
  section: DocSection,
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver,
): Promise<string> {
  const header = '| Token | Default | Description |\n| --- | --- | --- |\n';
  // Index once rather than rescanning every corpus entry per row. `set` keeps the
  // FIRST claimant, matching registry.ts's canonical-path rule, so `$extends`
  // duplicates resolve identically here and in the registry.
  const entryByCssProperty = new Map<string, CorpusEntry>();
  for (const candidate of baseIndex.values()) {
    if (candidate.cssProperty && !entryByCssProperty.has(candidate.cssProperty)) {
      entryByCssProperty.set(candidate.cssProperty, candidate);
    }
  }
  const rows = section.cssProperties.map((cssProperty) => {
    const entry = entryByCssProperty.get(cssProperty);
    if (!entry) {
      throw new Error(
        `No base corpus entry has cssProperty "${cssProperty}" (section "${section.slug}").`,
      );
    }
    const value = renderValueCell(
      normalizeTableCell(serializeEntryValue(entry, baseIndex, resolveReferences)),
    );
    const description = toTableCell(entry.description ?? '');
    assertNoGeneratedMarkers(value, 'value', cssProperty);
    assertNoGeneratedMarkers(description, 'description', cssProperty);
    // Escape pipes in the value as well as the description. GFM treats `|` as a
    // column delimiter even inside a backtick code span, so a token serializing to
    // a value containing one -- a fontFamily whose family name is `A|B` becomes the
    // valid CSS string 'A|B' -- would commit a structurally malformed row that the
    // drift parser still happily reads back.
    return `| ${toCodeSpan(cssProperty)} | ${renderValueCell(value)} | ${description} |`;
  });
  const raw = `${header}${rows.join('\n')}\n`;
  return format(raw, { ...PRETTIER_OPTIONS, parser: 'markdown', plugins: MARKDOWN_PLUGINS });
}

/**
 * The trail of ATX headings enclosing `offset`, outermost first: the nearest
 * heading, then the nearest heading above it of a shallower level, and so on.
 * Empty when the marker sits before any heading.
 *
 * Walking backwards and keeping only strictly-shallower levels is what makes
 * this the ENCLOSING trail rather than a list of everything above -- a sibling
 * `### Size: sm` earlier in the document does not enclose `### Size: md`.
 */
function enclosingHeadings(markdown: string, offset: number): string[] {
  const before = markdown.slice(0, offset);
  const headings = [...before.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm)];
  const trail: string[] = [];
  let level = Number.POSITIVE_INFINITY;
  for (let index = headings.length - 1; index >= 0; index -= 1) {
    const match = headings[index];
    const hashes = match?.[1];
    const text = match?.[2];
    if (hashes === undefined || text === undefined) continue;
    if (hashes.length < level) {
      trail.unshift(`${hashes} ${text.trim()}`);
      level = hashes.length;
    }
  }
  // The document title encloses everything, so declaring it in all 26 sections
  // would be noise. Dropping exactly one leading `#` heading keeps the
  // comparison anchored rather than a suffix match: a demoted section gains an
  // ancestor and no longer matches, which a suffix match would have accepted.
  return trail[0]?.startsWith('# ') ? trail.slice(1) : trail;
}

/**
 * Rewrites every `<!-- BEGIN/END GENERATED TOKEN TABLE -->` block in
 * `existingMarkdown` in place. Content outside those markers -- headings,
 * prose, callouts -- is preserved but NOT byte-identical: the spliced document
 * is handed to Prettier as a whole, which is what keeps `tokens:generate
 * -- --check` stable against the commit hook's own formatting pass, and which
 * can also normalize whitespace in the surrounding prose. Fails loudly (rather than
 * silently skipping) when a marker names a section `DOC_SECTIONS` does not
 * know, or when a `DOC_SECTIONS` entry has no matching marker in the file, so
 * a heading/marker edit and this generator's curation can never silently
 * drift apart.
 */
export async function buildTokensDocMarkdown(
  existingMarkdown: string,
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver,
): Promise<string> {
  const sectionsBySlug = new Map(DOC_SECTIONS.map((section) => [section.slug, section]));
  const foundSlugs = new Set<string>();
  const matches = [...existingMarkdown.matchAll(DOC_MARKER_PATTERN)];

  let rewritten = '';
  let cursor = 0;
  for (const match of matches) {
    const slug = match[1];
    if (slug === undefined) continue;
    const start = match.index;
    // `RegExpMatchArray.index` is typed `number | undefined` because the type
    // covers `String.prototype.match` with a non-global pattern (which can
    // return `null` overall, but TypeScript still carries the optional
    // modifier through this shared array type). Every match here comes from
    // `matchAll`, which always sets `index` -- but that guarantee lives in
    // the DOM/ECMAScript spec, not in this array's type, so a bare `!`
    // would assert past a real (if here unreachable) code path instead of
    // documenting why it can't happen.
    if (start === undefined) {
      throw new Error(
        `Unexpected match with no index while scanning docs/tokens.md for generated-table markers.`,
      );
    }
    const end = start + match[0].length;
    const section = sectionsBySlug.get(slug);
    if (!section) {
      throw new Error(
        `docs/tokens.md has a generated-table marker for unknown section "${slug}". Add it to ` +
          'DOC_SECTIONS in generate-artifacts.ts, or fix the marker.',
      );
    }
    // `DocSection.headings` was declared for every section and read by nothing,
    // so it documented a guarantee nothing enforced. Moving a marker under a
    // different heading, or renaming that heading, left the generator happily
    // rewriting the spacing table under "Typography": the slug still matched,
    // `tokens:generate -- --check` stabilised on the misplaced output, and the
    // drift test compares tokens globally rather than per section, so nothing
    // anywhere noticed.
    //
    // Compared for EQUALITY against the full trail below the document title,
    // hashes included. A suffix match over label-only entries accepted a
    // demoted section, and a leaf-only match accepted a nested pair moved under
    // another parent.
    const trail = enclosingHeadings(existingMarkdown, start);
    const trailMatchesDeclaration =
      trail.length === section.headings.length &&
      section.headings.every((heading, index) => trail[index] === heading);
    if (!trailMatchesDeclaration) {
      throw new Error(
        `docs/tokens.md has the "${slug}" generated-table marker under headings ` +
          `${trail.length === 0 ? '(none)' : trail.map((h) => `"${h}"`).join(' > ')}, but ` +
          `DOC_SECTIONS declares it belongs under ` +
          `${section.headings.map((h) => `"${h}"`).join(' > ')}. Move the marker back, or ` +
          'update the section headings in generate-artifacts.ts.',
      );
    }

    // A slug appearing twice would regenerate both blocks, listing every token
    // in that section twice -- and `tokens:generate -- --check` would then
    // stabilise on the doubled output and accept it forever.
    if (foundSlugs.has(slug)) {
      throw new Error(
        `docs/tokens.md has more than one generated-table marker for section "${slug}". ` +
          'Each section must appear exactly once.',
      );
    }
    foundSlugs.add(slug);
    const table = await renderDocTable(section, baseIndex, resolveReferences);
    rewritten += existingMarkdown.slice(cursor, start);
    rewritten += `<!-- BEGIN GENERATED TOKEN TABLE: ${slug} -->\n${table}<!-- END GENERATED TOKEN TABLE -->`;
    cursor = end;
  }
  rewritten += existingMarkdown.slice(cursor);

  const missingMarkers = DOC_SECTIONS.filter((section) => !foundSlugs.has(section.slug));
  if (missingMarkers.length > 0) {
    throw new Error(
      `docs/tokens.md is missing a generated-table marker for: ` +
        `${missingMarkers.map((section) => section.slug).join(', ')}.`,
    );
  }

  // Format the SPLICED document, not just each table. Tables are formatted in
  // isolation above, but prettier's markdown printer also normalises the
  // surrounding document -- it puts a blank line either side of an HTML
  // comment node, which the splice above does not. Without this pass the
  // committed file and the generator's output can never agree: lint-staged
  // reformats on commit, `tokens:generate -- --check` regenerates without
  // that formatting, and CI reports drift on a file nobody edited.
  return format(rewritten, {
    ...PRETTIER_OPTIONS,
    parser: 'markdown',
    plugins: MARKDOWN_PLUGINS,
  });
}

// ---------------------------------------------------------------------------
// packages/playground/src/shell-app/color-token-registry.generated.ts
// ---------------------------------------------------------------------------

export type PlaygroundColorToken = { name: string; label: string };
export type PlaygroundColorTokenGroup = {
  id: string;
  label: string;
  tokens: readonly PlaygroundColorToken[];
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the playground color panel's group membership and display labels
 * from the corpus itself: the foundation set's
 * `$extensions["com.lostgradient.cinder"].playgroundGroups` in
 * `cinder.resolver.json`. Like `DOC_SECTIONS` above, this is editorial
 * curation the corpus's `category` extension cannot express on its own (it
 * only distinguishes `color` from every other category, not "Accent" from
 * "Status Surfaces") -- but unlike `DOC_SECTIONS`, it is NOT hand-maintained
 * in this script: the playground panel must carry no hand-maintained
 * color-token list of its own, corpus-authored or not, and a literal array
 * here would only move that list's address, not eliminate it.
 * `INTENTIONALLY_UNREGISTERED_COLOR_TOKENS` in `color-token-registry.test.ts`
 * stays the separate, hand-maintained opt-out list for color tokens
 * deliberately NOT exposed here -- unrelated and unaffected by this move.
 *
 * Shape-validates the raw extension data (free-form per the DTCG resolver
 * schema, so nothing upstream checks it) before trusting it: every group
 * needs a string `id`/`label` and a `members` array, every member needs a
 * string `cssProperty`/`label`. {@link validatePlaygroundColorTokenGroups}
 * separately checks the referenced `cssProperty`s are real, current corpus
 * tokens.
 */
export function readPlaygroundColorTokenGroups(
  resolver: ResolverDocument,
): readonly PlaygroundColorTokenGroup[] {
  const foundationSet = resolver.sets['foundation'];
  const cinderExtensions = foundationSet?.$extensions?.['com.lostgradient.cinder'];
  const playgroundGroups = isPlainRecord(cinderExtensions)
    ? cinderExtensions['playgroundGroups']
    : undefined;
  if (!Array.isArray(playgroundGroups)) {
    throw new Error(
      'cinder.resolver.json\'s foundation set has no $extensions["com.lostgradient.cinder"]' +
        '.playgroundGroups array -- the playground color panel has nothing to generate from.',
    );
  }

  return playgroundGroups.map((rawGroup, groupIndex): PlaygroundColorTokenGroup => {
    if (
      !isPlainRecord(rawGroup) ||
      typeof rawGroup['id'] !== 'string' ||
      typeof rawGroup['label'] !== 'string' ||
      rawGroup['label'].trim() === '' ||
      // No whitespace in an id: color-token-panel.svelte interpolates it into
      // both `id="color-token-group-{id}"` and `aria-labelledby`, and
      // aria-labelledby parses whitespace as an ID-reference SEPARATOR -- so a
      // group id like "status solid" silently leaves the section unnamed to
      // assistive technology rather than failing visibly.
      /\s/.test(rawGroup['id']) ||
      rawGroup['id'].trim() === '' ||
      !Array.isArray(rawGroup['members'])
    ) {
      throw new Error(
        `cinder.resolver.json's playgroundGroups[${groupIndex}] must be ` +
          '{ id: string, label: string, members: array }.',
      );
    }
    const tokens = rawGroup['members'].map((rawMember, memberIndex): PlaygroundColorToken => {
      if (
        !isPlainRecord(rawMember) ||
        typeof rawMember['cssProperty'] !== 'string' ||
        typeof rawMember['label'] !== 'string' ||
        rawMember['label'].trim() === ''
      ) {
        throw new Error(
          `cinder.resolver.json's playgroundGroups[${groupIndex}].members[${memberIndex}] must be ` +
            '{ cssProperty: string, label: string }.',
        );
      }
      return { name: rawMember['cssProperty'], label: rawMember['label'] };
    });
    return { id: rawGroup['id'], label: rawGroup['label'], tokens };
  });
}

/**
 * Every `playgroundGroups` member's `cssProperty` must resolve to a real
 * corpus token, must not be listed twice, and must be a `category: "color"`
 * token -- protects the corpus-authored curation against a typo or a stale
 * reference left behind by a token rename or removal, AND against a
 * valid-but-wrong reference like `--cinder-space-4`: that cssProperty exists
 * in the corpus, so an existence-only check waves it through, the generated
 * color panel then offers a color picker for a spacing property, and
 * `applyColorTokenOverridesToDocument()` applies whatever the user picks
 * there via `style`.
 */
export function validatePlaygroundColorTokenGroups(
  groups: readonly PlaygroundColorTokenGroup[],
  registry: TokenRegistry,
): void {
  const entryByPath = new Map(registry.entries.map((entry) => [entry.path, entry]));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const unknown: string[] = [];
  const nonColor: string[] = [];
  const nonPublic: string[] = [];
  for (const group of groups) {
    for (const token of group.tokens) {
      if (seen.has(token.name)) duplicates.add(token.name);
      seen.add(token.name);

      // Membership, not truthiness -- see validateDocSections: a document-level
      // `$root` colour token resolves to the empty-string path.
      if (!Object.hasOwn(registry.cssPropertyToPath, token.name)) {
        unknown.push(token.name);
        continue;
      }
      const path = registry.cssPropertyToPath[token.name]!;
      const entry = entryByPath.get(path);
      if (entry?.category !== 'color') nonColor.push(token.name);
      // Category alone is not enough. A private `--_cinder-*` token can carry
      // `category: "color"`, and the panel writes each control's value straight
      // to the document root -- so listing one would expose and let a user
      // redefine an implementation token the package reserves from
      // customization. Public is the customization contract; category only says
      // what kind of value it holds.
      if (entry !== undefined && !entry.public) nonPublic.push(token.name);
    }
  }
  if (unknown.length > 0) {
    throw new Error(
      `cinder.resolver.json's playgroundGroups references cssProperties that are not in the ` +
        `corpus: ${unknown.join(', ')}.`,
    );
  }
  if (nonColor.length > 0) {
    throw new Error(
      `cinder.resolver.json's playgroundGroups references cssProperties that are not ` +
        `category: "color" tokens: ${nonColor.join(', ')}.`,
    );
  }
  if (nonPublic.length > 0) {
    throw new Error(
      `cinder.resolver.json's playgroundGroups references private cssProperties, which the ` +
        `package reserves from customization: ${nonPublic.join(', ')}.`,
    );
  }
  if (duplicates.size > 0) {
    throw new Error(
      `cinder.resolver.json's playgroundGroups lists these cssProperties more than once: ` +
        `${[...duplicates].join(', ')}.`,
    );
  }
}

async function buildColorTokenRegistryModule(
  resolver: ResolverDocument,
  registry: TokenRegistry,
): Promise<string> {
  const groups = readPlaygroundColorTokenGroups(resolver);
  validatePlaygroundColorTokenGroups(groups, registry);
  const groupsLiteral = JSON.stringify(groups);
  const source = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Source: packages/components/src/tokens/cinder.resolver.json (the
 * foundation set's com.lostgradient.cinder.playgroundGroups extension).
 * Regenerate: ${REGENERATE_COMMAND}
 */

export type ColorToken = {
  name: string;
  label: string;
};

export type ColorTokenGroup = {
  id: string;
  label: string;
  tokens: readonly ColorToken[];
};

export const COLOR_TOKEN_GROUPS = ${groupsLiteral} as const;
`;
  return format(source, { ...PRETTIER_OPTIONS, parser: 'typescript', plugins: TYPESCRIPT_PLUGINS });
}

/**
 * The `@lostgradient/cinder/tokens/registry` module: the same registry data
 * `registry.generated.json` holds, as a typed TypeScript module.
 *
 * Two artifacts rather than one because they serve different consumers. The
 * JSON is read by this repository's own tooling, which wants a file it can
 * parse without a build step. The module is what an external consumer imports,
 * and it carries the types alongside the data so a consumer gets
 * `TokenRegistryEntry` without re-declaring it.
 *
 * It is plain data with no browser-versus-node behaviour, which is why every
 * export condition can point at this single source.
 *
 * The emitted type declares `category`, `component`, and `description` as
 * OPTIONAL KEYS rather than required keys of type `string | undefined`, which
 * is how `registry.ts` models them in-repo. That is not a drift: the data
 * reaches this module through `JSON.stringify`, which omits an undefined value
 * entirely, so a required key would be missing from the emitted literal and the
 * module would not typecheck against its own type.
 */
async function buildTokenRegistryModule(registry: TokenRegistry): Promise<string> {
  const source = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Source: the DTCG token corpus under packages/components/src/tokens/.
 * Regenerate: ${REGENERATE_COMMAND}
 */

/** One token's registry record. */
export type TokenRegistryEntry = {
  /** Dotted corpus path, e.g. \`space.4\`. */
  path: string;
  /** The custom property this token emits. */
  cssProperty: string;
  /** The token's category, when it declares one. */
  category?: string;
  /** The owning component, for component-scoped tokens. */
  component?: string;
  /** Whether the token is part of the public \`--cinder-*\` surface. */
  public: boolean;
  /** Whether a theme document overrides this token. */
  themeAware: boolean;
  /** The DTCG \`$deprecated\` value: \`false\`, \`true\`, or a message. */
  deprecated: boolean | string;
  /** The token's description, when it has one. */
  description?: string;
};

/** The registry's shape: every token, plus the lookups built over them. */
export type TokenRegistry = {
  entries: readonly TokenRegistryEntry[];
  pathToCssProperty: Readonly<Record<string, string>>;
  cssPropertyToPath: Readonly<Record<string, string>>;
  cssPropertyToPaths: Readonly<Record<string, readonly string[]>>;
  byCategory: Readonly<Record<string, readonly string[]>>;
  byComponent: Readonly<Record<string, readonly string[]>>;
};

/**
 * Declared as \`TokenRegistry\` rather than emitted \`as const\`.
 *
 * A literal type looks like a free upgrade -- exact keys, autocompletion -- but
 * it breaks both documented ways of using this data. Every lookup map keeps
 * only its generated keys and no string index signature, so
 * \`TOKEN_REGISTRY.pathToCssProperty[path]\` for a \`string\` path fails with
 * TS7053; and \`entries\` becomes a literal tuple whose elements each omit the
 * optional keys they happen not to carry, so reading \`.component\` while
 * iterating fails on any entry without one.
 *
 * Intersecting the literal with \`TokenRegistry\` fixes the first and not the
 * second. Since the value is generated data whose keys a consumer discovers at
 * runtime, the declared type is what they actually want.
 */
export const TOKEN_REGISTRY: TokenRegistry = ${serializeTokenRegistry(registry)};

export default TOKEN_REGISTRY;
`;
  return format(source, { ...PRETTIER_OPTIONS, parser: 'typescript', plugins: TYPESCRIPT_PLUGINS });
}

/**
 * The `@lostgradient/cinder/tokens` index: what the token surface contains and
 * which subpath each part is published at.
 *
 * The ticket names bare `/tokens` as one of seven mandatory subpaths, so it has
 * to resolve to something importable; it also says the unresolved sources are
 * COPIED rather than transformed, so it cannot be a merged document. An index
 * satisfies both -- it describes the surface without restating any token -- and
 * it is the same shape as the package's existing `./manifest` entry, which
 * points at `components.json` rather than at any component.
 *
 * It also makes the per-file subpaths discoverable: a consumer reads this to
 * learn which `sets`/`themes`/`modes` documents exist rather than guessing.
 */
async function buildTokenIndex(
  documentsByPath: Map<string, TokenDocument>,
  registry: TokenRegistry,
): Promise<string> {
  const sources = [...documentsByPath.keys()].sort().map((relativePath) => ({
    file: relativePath,
    subpath: `@lostgradient/cinder/tokens/${relativePath.replace(/\.tokens\.json$/, '').replace(/\.json$/, '')}`,
  }));
  const index = {
    $comment: `GENERATED FILE. Do not edit by hand. Regenerate: ${REGENERATE_COMMAND}`,
    version: '2025.10',
    tokenCount: registry.entries.length,
    resolver: '@lostgradient/cinder/tokens/resolver',
    registry: '@lostgradient/cinder/tokens/registry',
    sources,
    resolvedContexts: RESOLVED_CONTEXT_COMBOS.map(({ name }) => ({
      name,
      subpath: `@lostgradient/cinder/tokens/resolved/${name}`,
    })),
  };
  return format(JSON.stringify(index), {
    ...PRETTIER_OPTIONS,
    parser: 'json',
    plugins: JSON_PLUGINS,
  });
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

async function buildAllGeneratedOutputs(): Promise<Map<string, string>> {
  const cssAndResolved = await buildGeneratedOutputs();

  const { resolver, documentsByPath } = await loadCorpus();
  const baseIndex = buildBaseIndex(resolver, documentsByPath);
  const baseDocuments = buildBaseDocuments(resolver, documentsByPath);
  const baseResolveReferences = createValueResolver(baseDocuments);
  const registry = buildTokenRegistryFromIndexes(
    baseIndex,
    themeAwarePaths(resolver, documentsByPath),
  );

  validateDocSections(registry);

  const existingDocMarkdown = await readFile(tokensDocPath, 'utf8');
  const [docMarkdown, registryJson, colorTokenRegistryModule, registryModule, tokenIndex] =
    await Promise.all([
      buildTokensDocMarkdown(existingDocMarkdown, baseIndex, baseResolveReferences),
      format(serializeTokenRegistry(registry), {
        ...PRETTIER_OPTIONS,
        parser: 'json',
        plugins: JSON_PLUGINS,
      }),
      buildColorTokenRegistryModule(resolver, registry),
      buildTokenRegistryModule(registry),
      buildTokenIndex(documentsByPath, registry),
    ]);

  const generated = new Map(cssAndResolved);
  generated.set(registryJsonPath, registryJson);
  generated.set(tokensDocPath, docMarkdown);
  generated.set(colorTokenRegistryGeneratedPath, colorTokenRegistryModule);
  generated.set(registryModulePath, registryModule);
  generated.set(tokenIndexPath, tokenIndex);
  return generated;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const generated = await buildAllGeneratedOutputs();

  if (check) {
    const existing = await readExisting(generated.keys());
    const drifted = findDriftedPaths(generated, existing);
    if (drifted.length > 0) {
      throw new Error(
        `Generated token output drifted from the committed files:\n${drifted
          .map((path) => `  - ${path}`)
          .join('\n')}\nRun ${REGENERATE_COMMAND}.`,
      );
    }
    return;
  }

  await mkdir(resolvedDirectory, { recursive: true });
  for (const [path, content] of generated) await Bun.write(path, content);
}

if (import.meta.main) await main();
