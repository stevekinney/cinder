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
        try {
          var stored = localStorage.getItem('cinder-playground-theme');
          if (stored === 'light' || stored === 'dark' || stored === 'system') theme = stored;
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

export function renderShell(activeComponent: string | null, components: string[]): string {
  const title = activeComponent
    ? `cinder playground — ${escapeHtml(activeComponent)}`
    : 'cinder playground';

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
    <script>${PRE_PAINT_THEME_SCRIPT}</script>
    <style>
      *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      /* light-dark() needs an active color-scheme to know which value to
         return. Without this declaration, light-dark() always returns its
         first argument, so system-preference dark-mode users see a light
         flash before the SPA mounts. The pre-paint script overrides this
         to a concrete light/dark for explicit theme choices. */
      html {
        color-scheme: light dark;
      }

      html, body, #shell-root {
        height: 100%;
      }

      body {
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        background: light-dark(#f5f5f5, #1a1a1a);
        color: light-dark(#111, #eee);
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
