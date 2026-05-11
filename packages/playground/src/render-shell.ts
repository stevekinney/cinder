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
 */
function jsonForScriptTag(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll(LINE_SEPARATOR, '\\u2028')
    .replaceAll(PARAGRAPH_SEPARATOR, '\\u2029');
}

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
    <script>
      // Pre-paint theme application. Runs synchronously before the shell
      // bundle loads so the user never sees a flash of system-default theme
      // when they have a persisted preference. Falls back silently to
      // "system" if localStorage is unavailable (private browsing, etc.).
      (function () {
        try {
          var theme = localStorage.getItem('cinder-playground-theme');
          if (theme === 'light' || theme === 'dark') {
            document.documentElement.style.colorScheme = theme;
          }
        } catch (e) { /* ignore */ }
      })();
    </script>
    <style>
      *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
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
