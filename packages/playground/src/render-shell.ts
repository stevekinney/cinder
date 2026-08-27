/**
 * Renders the HTML document around the cinder playground shell.
 *
 * Canonical component routes place server-rendered shell and documentation
 * markup inside `#shell-root`; the client bundle hydrates that exact tree.
 * Initial props travel through a `<script type="application/json">` data
 * island so hydration does not repeat any documentation work.
 *
 * The data-island pattern (instead of `window.__GLOBAL__ = JSON.stringify(...)`)
 * eliminates `</script>` injection vectors and is the standard SSR-hydration
 * shape. The JSON body still gets defensive escaping for `<`, `>`, `&`, and
 * the Unicode line separators U+2028/U+2029, which are valid in JSON but
 * terminate a script body in some parsers.
 */

import type { ComponentDocumentationPayload } from './component-documentation-types.ts';
import { humanizeComponentName } from './shell-app/humanize.ts';
import { stripInlineSourcemaps } from './strip-inline-sourcemaps.ts';

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

export const SITE_NAME = 'Cinder';
export const SOCIAL_IMAGE_PATH = '/social.png';
export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;
export const SOCIAL_IMAGE_ALT = 'Cinder component library interface illustration';

/**
 * Favicon: the brick (🧱) emoji rendered inline as an SVG data URI. Inlining
 * (rather than pointing at fav.farm or any external/static-asset URL) keeps the
 * playground fully self-contained — no third-party request on every page and
 * iframe load, works offline and behind a strict CSP, and leaks no usage
 * metadata. The emoji is the glyph the icon shows; the SVG is just the carrier.
 */
export const FAVICON_HREF =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<text x="50" y="52" font-size="80" text-anchor="middle" dominant-baseline="central">🧱</text>' +
      '</svg>',
  );

/**
 * Escape a string value so it's safe to embed inside the body of a
 * `<script type="application/json">` tag. JSON.stringify alone is not enough
 * because the resulting string may contain literal `</script>` substrings (if
 * a value embedded a tag close) or U+2028/U+2029 (which are valid in JSON but
 * have terminated script bodies in some historical parsers). Replacing these
 * with `\uXXXX` escapes keeps the payload valid JSON AND safe inside a script
 * tag.
 *
 * Exported so the same escaping policy can be verified by unit tests.
 */
export function jsonForScriptTag(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll(LINE_SEPARATOR, '\\u2028')
    .replaceAll(PARAGRAPH_SEPARATOR, '\\u2029');
}

/**
 * Inline script body that applies the persisted theme override to `:root`
 * before any stylesheet or bundle runs. Same source of truth for both the shell
 * scaffold and the iframe page (`renderComponentPage`) so the localStorage key,
 * the try/catch policy, and the validation rules stay in sync. If you change the
 * theme storage key, change `THEME_STORAGE_KEY` in `preview-store.svelte.ts`
 * to match.
 *
 * The only persisted/shareable values are explicit overrides — `light` or
 * `dark`. With no override the playground follows the browser's
 * `prefers-color-scheme`: the inline `color-scheme` is left unset so the base
 * `color-scheme: light dark` declaration governs, and `data-cinder-theme` is
 * seeded with the resolved preference so the authoritative CSS signal still
 * reflects the theme actually in effect.
 */
export const PRE_PAINT_THEME_SCRIPT = `
      (function () {
        var override = null;
        // URL wins over localStorage — a shareable ?theme=dark link must
        // paint dark even if this browser's stored preference differs.
        try {
          var urlTheme = new URLSearchParams(window.location.search).get('theme');
          if (urlTheme === 'light' || urlTheme === 'dark') {
            override = urlTheme;
          } else {
            var stored = localStorage.getItem('cinder-playground-theme');
            if (stored === 'light' || stored === 'dark') override = stored;
          }
        } catch (e) { /* ignore — localStorage unavailable in private mode etc. */ }
        if (override) {
          // Explicit override wins over the OS setting.
          document.documentElement.style.colorScheme = override;
          document.documentElement.dataset.cinderTheme = override;
        } else {
          // No override: follow the browser. Leave color-scheme to the base
          // 'color-scheme: light dark' declaration and seed data-cinder-theme
          // with the resolved prefers-color-scheme so CSS reads the live theme.
          var prefersDark =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.dataset.cinderTheme = prefersDark ? 'dark' : 'light';
        }
      })();
    `;

/**
 * CSS custom properties consumed by the `depict` Shiki theme.
 *
 * `CSS_VARIABLE_THEME` in `@lostgradient/markdown/rendering/highlighter` maps
 * every TextMate scope to a bare `var(--syntax-*)` reference (plus
 * `var(--surface-inset)` / `var(--text)` for the editor chrome). Those names
 * are NOT Cinder tokens — Cinder namespaces everything under `--cinder-*` —
 * so until they are declared somewhere, every highlighted token resolves to
 * `unset`, inherits the surrounding prose color, and the fence renders as if
 * it were never highlighted at all.
 *
 * This block is the declaration site. Each name is aliased to a real Cinder
 * token so the palette follows the active light/dark theme for free (the
 * tokens are `light-dark()` pairs) and no raw color is authored here.
 *
 * Declared in the shell's inline `<style>` rather than a component's scoped
 * CSS because the fences are injected as raw HTML (`{@html}`) from the
 * markdown pipeline: Svelte's style scoper never sees those elements, so a
 * scoped rule would not apply to them.
 *
 * Exported so `render-shell.test.ts` can cross-check the declared names
 * against the ones `CSS_VARIABLE_THEME` actually references.
 */
export const DEPICT_THEME_VARIABLES = `      /* Palette for the \`depict\` Shiki theme — see DEPICT_THEME_VARIABLES. */
      :root {
        /* Editor chrome (theme \`colors\`). */
        --surface-inset: var(--cinder-surface-inset);
        --text: var(--cinder-text-default);

        /* Token scopes (theme \`tokenColors\`). Hues are borrowed from the
           status/accent token families so the palette stays inside the
           design system and re-themes with it. */
        --syntax-comment: var(--cinder-text-subtle);
        --syntax-string: var(--cinder-status-success-text);
        --syntax-keyword: var(--cinder-accent-text);
        --syntax-function: var(--cinder-status-info-text);
        --syntax-variable: var(--cinder-text-default);
        --syntax-type: var(--cinder-status-info-text);
        --syntax-number: var(--cinder-status-warning-text);
        --syntax-operator: var(--cinder-text-subtle);
        --syntax-constant: var(--cinder-status-warning-text);
        --syntax-property: var(--cinder-text-muted);
        --syntax-tag: var(--cinder-status-danger-text);
        --syntax-attribute: var(--cinder-status-warning-text);
        --syntax-regex: var(--cinder-status-danger-text);
        --syntax-inserted: var(--cinder-status-success-text);
        --syntax-deleted: var(--cinder-status-danger-text);
      }`;

/** Escape a string for safe use in HTML text content and attribute values. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type DocumentationPageMetadata = {
  canonicalPath: string;
  title: string;
  description: string;
  componentName?: string;
};

/**
 * The one metadata source for visible document titles, canonical links, social
 * cards, and structured data. Keeping the canonical path here prevents static
 * export, the component route, and the landing route from inventing subtly
 * different URL shapes.
 */
export function documentationPageMetadata(componentName: string | null): DocumentationPageMetadata {
  if (componentName === null) {
    return {
      canonicalPath: '/',
      title: 'Cinder — Svelte 5 component library',
      description:
        'Interactive component documentation for Cinder, an accessible and SSR-safe Svelte 5 component library.',
    };
  }

  const humanName = humanizeComponentName(componentName);
  return {
    canonicalPath: `/page/${encodeURIComponent(componentName)}`,
    title: `${humanName} — Cinder component documentation`,
    description: `${humanName} component documentation for Cinder, including live examples and a complete props reference.`,
    componentName: humanName,
  };
}

export function normalizedBaseUrl(baseUrl = Bun.env['PLAYGROUND_BASE_URL'] ?? ''): string {
  return baseUrl.replace(/\/+$/, '');
}

export function absoluteDocumentationUrl(baseUrl: string, path: string): string {
  return `${normalizedBaseUrl(baseUrl)}${path}`;
}

export function documentationMetadataTags(
  metadata: DocumentationPageMetadata,
  baseUrl = Bun.env['PLAYGROUND_BASE_URL'] ?? '',
): string {
  const normalized = normalizedBaseUrl(baseUrl);
  const canonicalUrl = normalized
    ? absoluteDocumentationUrl(normalized, metadata.canonicalPath)
    : '';
  const imageUrl = normalized ? absoluteDocumentationUrl(normalized, SOCIAL_IMAGE_PATH) : '';
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);

  return [
    `<meta name="description" content="${description}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    canonicalUrl ? `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />` : '',
    imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />` : '',
    imageUrl ? '<meta property="og:image:type" content="image/png" />' : '',
    imageUrl ? `<meta property="og:image:width" content="${SOCIAL_IMAGE_WIDTH}" />` : '',
    imageUrl ? `<meta property="og:image:height" content="${SOCIAL_IMAGE_HEIGHT}" />` : '',
    imageUrl ? `<meta property="og:image:alt" content="${SOCIAL_IMAGE_ALT}" />` : '',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />` : '',
    imageUrl ? `<meta name="twitter:image:alt" content="${SOCIAL_IMAGE_ALT}" />` : '',
    canonicalUrl ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
}

export function documentationJsonLd(
  metadata: DocumentationPageMetadata,
  baseUrl = Bun.env['PLAYGROUND_BASE_URL'] ?? '',
): string {
  const normalized = normalizedBaseUrl(baseUrl);
  if (normalized === '') return '';

  const canonicalUrl = absoluteDocumentationUrl(normalized, metadata.canonicalPath);
  const imageUrl = absoluteDocumentationUrl(normalized, SOCIAL_IMAGE_PATH);
  const graph =
    metadata.componentName === undefined
      ? [
          {
            '@type': 'WebSite',
            '@id': `${canonicalUrl}#website`,
            name: SITE_NAME,
            url: canonicalUrl,
            description: metadata.description,
          },
          {
            '@type': 'SoftwareApplication',
            name: SITE_NAME,
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Web',
            url: canonicalUrl,
            description: metadata.description,
            image: imageUrl,
          },
        ]
      : [
          {
            '@type': 'TechArticle',
            '@id': `${canonicalUrl}#documentation`,
            headline: metadata.title,
            description: metadata.description,
            url: canonicalUrl,
            mainEntityOfPage: canonicalUrl,
            image: imageUrl,
            about: { '@type': 'SoftwareApplication', name: metadata.componentName },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${normalized}/` },
              {
                '@type': 'ListItem',
                position: 2,
                name: metadata.componentName,
                item: canonicalUrl,
              },
            ],
          },
        ];
  return `<script type="application/ld+json">${jsonForScriptTag({
    '@context': 'https://schema.org',
    '@graph': graph,
  })}</script>`;
}

/**
 * Options for {@link renderShell}.
 */
export type RenderShellOptions = {
  /**
   * Absolute origin (e.g. `https://playground.cinder.dev`) used to build the
   * canonical and Open Graph URLs. When empty (the default), the URL-bearing
   * tags that require an absolute address — `og:url`, `og:image`,
   * `twitter:image`, and `<link rel="canonical">` — are omitted entirely
   * rather than emitted with a misleading relative path. Defaults to
   * `PLAYGROUND_BASE_URL` from the environment, falling back to an empty
   * string. Any trailing slashes are stripped before composing URLs.
   */
  baseUrl?: string;
  /**
   * Sanitized HTML rendered from the repository README. Embedded only on the
   * root shell route, where the Svelte shell renders it as landing-page prose.
   */
  readmeHtml?: string;
  /**
   * Validated documentation embedded for the canonical component route.
   */
  documentation?: ComponentDocumentationPayload | null;
  /**
   * Server-rendered Shell markup. The client hydrates this exact tree.
   */
  shellBody?: string;
  /** Server-rendered Svelte head output, including scoped component styles. */
  shellHead?: string;
  /** Request query used to seed identical server and client toolbar state. */
  initialSearch?: string;
};

/**
 * Render the playground shell HTML for either the root page (`activeComponent`
 * is `null`) or a specific component page. Emits a complete `<head>` with SEO,
 * Open Graph, and Twitter card metadata in addition to the mount point and the
 * data island.
 *
 * @param activeComponent - The component being shown, or `null` for the root.
 * @param components - The list of components to embed for the sidebar.
 * @param options - Optional rendering options; see {@link RenderShellOptions}.
 * @returns A complete HTML document string.
 */
export function renderShell(
  activeComponent: string | null,
  components: string[],
  options: RenderShellOptions = {},
): string {
  const metadata = documentationPageMetadata(activeComponent);
  const meta = documentationMetadataTags(metadata, options.baseUrl);
  const structuredData = documentationJsonLd(metadata, options.baseUrl);

  const initialData = {
    component: activeComponent ?? '',
    components,
    readmeHtml: options.readmeHtml ?? '',
    documentation: options.documentation ?? null,
    initialSearch: options.initialSearch ?? '',
  };

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(metadata.title)}</title>
    ${meta}
    ${structuredData}
    <link rel="icon" href="${FAVICON_HREF}" />
    ${stripInlineSourcemaps(options.shellHead ?? '')}
    <script>${PRE_PAINT_THEME_SCRIPT}</script>
    <style>
      /* Register cinder.reset as the FIRST layer (least priority) so the universal
         box/margin/padding reset below can never beat component styles. This
         declaration runs before the route-scoped stylesheet so the reset slot
         is reserved at the bottom of the cascade — that stylesheet registers the rest of the
         order (cinder.tokens, foundation, components, utilities) and imports the
         Cinder component styles, all of which come later and therefore win over
         the reset. */
      @layer cinder.reset, cinder.tokens, cinder.foundation, cinder.components, cinder.utilities;
    </style>
    <!-- This bundles the base stylesheet and only the primitives rendered by
         the landing and documentation surfaces. It intentionally excludes the
         unrelated component-family graph behind /styles/all.css. -->
    <link rel="stylesheet" href="/playground-styles/landing.css" />
    <style>
      @layer cinder.reset {
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
      }

      /* light-dark() needs an active color-scheme to know which value to
         return. Without this declaration, light-dark() always returns its
         first argument, so system-preference dark-mode users see a light
         flash before the SPA mounts. The pre-paint script overrides this
         to a concrete light/dark for explicit theme choices. */
      html {
        color-scheme: light dark;
      }

      /* Single source of truth for the fixed top bar's height. Declared on
         :root (rather than scoped to the top bar's own element) so any
         sibling that needs it — e.g. color-token-panel.svelte's fixed
         positioning — can read it directly, with a 0px fallback for
         contexts (like the canonical documentation page) that render no
         shell top bar at all. */
      :root {
        --cinder-top-bar-height: 52px;
      }

${DEPICT_THEME_VARIABLES}

      html, body, #shell-root {
        height: 100%;
      }

      body {
        font-family: var(--cinder-font-sans);
        font-size: var(--cinder-text-base);
        background: var(--cinder-surface-raised);
        color: var(--cinder-text-default);
      }
    </style>
  </head>
  <body>
    <script type="application/json" id="cinder-initial">${jsonForScriptTag(initialData)}</script>
    <div id="shell-root">${options.shellBody ?? ''}</div>
    <script type="module" src="/shell-bundle/shell.js"></script>
  </body>
</html>`;
}
