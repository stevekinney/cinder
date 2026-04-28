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
 * Renders the full HTML shell for the cinder component playground.
 *
 * Returns a plain HTML string — no framework, no bundler dependency.
 * The shell consists of a fixed sidebar nav listing all components
 * alphabetically and a main area containing an iframe for the active component.
 * A small inline script establishes a Server-Sent Events connection to `/events`
 * and reloads the page on a `reload` message.
 */
export function renderShell(activeComponent: string | null, components: string[]): string {
  const title = activeComponent
    ? `cinder playground — ${escapeHtml(activeComponent)}`
    : 'cinder playground';

  const navItems = components
    .map((name) => {
      const isActive = name === activeComponent;
      const ariaCurrent = isActive ? ' aria-current="page"' : '';
      // Component names are validated by isSafeSegment (/^[a-z0-9][a-z0-9-]*$/),
      // so they're safe in URL paths. Escape only the visible text node.
      return `      <li><a href="/c/${name}"${ariaCurrent}>${escapeHtml(name)}</a></li>`;
    })
    .join('\n');

  // Component names are path-safe; escaping is only needed in title attribute and visible text.
  const mainContent = activeComponent
    ? `<iframe src="/c/${activeComponent}" title="${escapeHtml(activeComponent)} preview"></iframe>`
    : `<div class="placeholder"><p>Select a component from the sidebar to preview it.</p></div>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      html, body {
        height: 100%;
      }

      body {
        display: flex;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        background: #f5f5f5;
        color: #111;
      }

      nav {
        width: 220px;
        min-width: 220px;
        height: 100vh;
        position: fixed;
        top: 0;
        left: 0;
        background: #fff;
        border-right: 1px solid #e5e5e5;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }

      nav .nav-header {
        padding: 16px;
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #666;
        border-bottom: 1px solid #e5e5e5;
      }

      nav ul {
        list-style: none;
        padding: 8px 0;
        flex: 1;
      }

      nav ul li a {
        display: block;
        padding: 6px 16px;
        text-decoration: none;
        color: #333;
        border-radius: 4px;
        margin: 1px 8px;
        transition: background 0.1s;
      }

      nav ul li a:hover {
        background: #f0f0f0;
      }

      nav ul li a[aria-current="page"] {
        background: #e8f0fe;
        color: #1a56db;
        font-weight: 600;
      }

      main {
        margin-left: 220px;
        flex: 1;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }

      main iframe {
        flex: 1;
        width: 100%;
        height: 100%;
        border: none;
        background: #fff;
      }

      main .placeholder {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #888;
      }

      main .placeholder p {
        font-size: 16px;
      }
    </style>
  </head>
  <body>
    <nav>
      <div class="nav-header">cinder</div>
      <ul>
${navItems}
      </ul>
    </nav>
    <main>
      ${mainContent}
    </main>
    <script>
      const es = new EventSource('/events');
      es.addEventListener('reload', () => location.reload());
    </script>
  </body>
</html>`;
}
