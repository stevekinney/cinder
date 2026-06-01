/**
 * Renders the minimal HTML scaffold for the cinder playground shell.
 *
 * The scaffold is intentionally tiny: it sets up a `#shell-root` mount point,
 * embeds initial data via a `<script type="application/json">` data island,
 * and loads the compiled shell-app bundle. Everything else — sidebar, top
 * control bar, iframe — is rendered by the Svelte 5 SPA that boots from
 * `shell-app/shell-entry.ts`.
 *
 * The data-island pattern (instead of `window.__GLOBAL__ = JSON.stringify(...)`)
 * eliminates `</script>` injection vectors and is the standard SSR-hydration
 * shape. The JSON body still gets defensive escaping for `<`, `>`, `&`, and
 * the Unicode line separators U+2028/U+2029, which are valid in JSON but
 * terminate a script body in some parsers.
 */

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Self-contained favicon as a data URI: a rounded square in the cinder ember
 * orange with a lowercase "c". Inlined so every page has an icon without a
 * /favicon.svg route (which neither handleRequest nor vercel.json serves) and
 * therefore without a guaranteed 404 in devtools and server logs.
 */
const FAVICON_DATA_URI =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
      '<rect width="32" height="32" rx="7" fill="#e8590c"/>' +
      '<text x="16" y="23" font-family="system-ui,sans-serif" font-size="22" ' +
      'font-weight="700" fill="#fff" text-anchor="middle">c</text>' +
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
 * Inline script body that applies a persisted theme to `:root` before any
 * stylesheet or bundle runs. Same source of truth for both the shell scaffold
 * and the iframe page (`renderComponentPage`) so the localStorage key, the
 * try/catch policy, and the validation rules stay in sync. If you change the
 * theme storage key, change `THEME_STORAGE_KEY` in `preview-store.svelte.ts`
 * to match.
 */
export const PRE_PAINT_THEME_SCRIPT = `
      (function () {
        var theme = 'system';
        // URL wins over localStorage — a shareable ?theme=dark link must
        // paint dark even if this browser's stored preference is light.
        try {
          var urlTheme = new URLSearchParams(window.location.search).get('theme');
          if (urlTheme === 'light' || urlTheme === 'dark' || urlTheme === 'system') {
            theme = urlTheme;
          } else {
            var stored = localStorage.getItem('cinder-playground-theme');
            if (stored === 'light' || stored === 'dark' || stored === 'system') theme = stored;
          }
        } catch (e) { /* ignore — localStorage unavailable in private mode etc. */ }
        if (theme === 'light' || theme === 'dark') {
          document.documentElement.style.colorScheme = theme;
        }
        // data-cinder-theme is the authoritative theme-choice signal — read it
        // from CSS instead of sniffing the inline color-scheme style. Reflects
        // 'system' explicitly so CSS can branch on prefers-color-scheme.
        document.documentElement.dataset.cinderTheme = theme;
      })();
    `;

/** Escape a string for safe use in HTML text content and attribute values. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  const baseUrl = (options.baseUrl ?? Bun.env['PLAYGROUND_BASE_URL'] ?? '').replace(/\/+$/, '');

  const title = activeComponent
    ? `cinder playground — ${escapeHtml(activeComponent)}`
    : 'cinder playground';

  const description = activeComponent
    ? `Explore the ${escapeHtml(activeComponent)} component in the cinder playground — live examples, props, and CSS variables.`
    : 'Interactive component playground for cinder — a Svelte 5 accessible component library.';

  // Shell routes: `/c/<component>` for a specific component, `/` for the root.
  const path = activeComponent ? `/c/${encodeURIComponent(activeComponent)}` : '/';
  const canonicalUrl = baseUrl ? escapeHtml(`${baseUrl}${path}`) : '';
  // TODO(bf3680cd): /social.png is a placeholder — shipping the actual social
  // card image is a separate task.
  const imageUrl = baseUrl ? escapeHtml(`${baseUrl}/social.png`) : '';

  const meta = [
    `<meta name="description" content="${description}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    canonicalUrl ? `<meta property="og:url" content="${canonicalUrl}" />` : '',
    imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : '',
    `<meta property="og:site_name" content="cinder playground" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : '',
    canonicalUrl ? `<link rel="canonical" href="${canonicalUrl}" />` : '',
    // Inline data-URI favicon: a self-contained SVG ember mark. Embedding it
    // avoids a guaranteed 404 on every page (there is no /favicon.svg route in
    // handleRequest or rewrite in vercel.json) without adding a static asset
    // pipeline. Swap for a shipped /favicon.svg if a richer icon is ever wanted.
    `<link rel="icon" href="${FAVICON_DATA_URI}" />`,
  ]
    .filter(Boolean)
    .join('\n    ');

  const initialData = {
    component: activeComponent ?? '',
    components,
  };

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    ${meta}
    <script>${PRE_PAINT_THEME_SCRIPT}</script>
    <style>
      /* Register cinder.reset as the FIRST layer (least priority) so the universal
         box/margin/padding reset below can never beat component styles. This
         declaration runs before /styles/shell.css so the reset slot is reserved
         at the bottom of the cascade — shell.css then registers the rest of the
         order (cinder.tokens, foundation, components, utilities) and imports the
         Cinder component styles used by the shell, all of which come later and
         therefore win over the reset. */
      @layer cinder.reset, cinder.tokens, cinder.foundation, cinder.components, cinder.utilities;
    </style>
    <link rel="stylesheet" href="/styles/shell.css" />
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
         :root so it resolves for the top bar, the sidebar, and the main
         column alike — .top-bar only reaches its own descendants, so siblings
         (sidebar.svelte, shell.svelte) previously had to duplicate this token.
         Hoisting it here lets those components reference it without fallbacks. */
      :root {
        --cinder-top-bar-height: 52px;
      }

      html, body, #shell-root {
        height: 100%;
      }

      body {
        font-family: var(--cinder-font-sans);
        font-size: var(--cinder-text-base);
        background: var(--cinder-bg);
        color: var(--cinder-text);
      }
    </style>
  </head>
  <body>
    <script type="application/json" id="cinder-initial">${jsonForScriptTag(initialData)}</script>
    <div id="shell-root"></div>
    <script type="module" src="/shell-bundle/shell.js"></script>
  </body>
</html>`;
}
