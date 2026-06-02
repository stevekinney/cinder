/**
 * Tests for the small surface exposed by `render-shell.ts`:
 *
 * - `jsonForScriptTag` is the escaping policy that keeps the
 *   `<script type="application/json" id="cinder-initial">` data island safe
 *   from `</script>` injection and U+2028/U+2029 historical edge cases.
 * - `renderShell` integrates the policy with the rest of the scaffold and
 *   must always produce a payload that parses cleanly back to the original
 *   shape after `JSON.parse`.
 */

import { describe, expect, it } from 'bun:test';

import { jsonForScriptTag, renderShell } from './render-shell.ts';

describe('jsonForScriptTag', () => {
  it('escapes < and > so a `</script>` substring cannot close the tag', () => {
    const escaped = jsonForScriptTag({ component: '</script><img src=x>' });
    expect(escaped).not.toContain('</script>');
    expect(escaped).not.toContain('<img');
    expect(escaped).toContain('\\u003c');
  });

  it('escapes ampersand so HTML-encoded sequences in values stay literal', () => {
    const escaped = jsonForScriptTag({ component: 'a&b' });
    expect(escaped).not.toContain('&');
    expect(escaped).toContain('\\u0026');
  });

  it('escapes U+2028 (LINE SEPARATOR)', () => {
    const dangerous = `line${String.fromCharCode(0x2028)}separator`;
    const escaped = jsonForScriptTag({ component: dangerous });
    expect(escaped).not.toContain(String.fromCharCode(0x2028));
    expect(escaped).toContain('\\u2028');
  });

  it('escapes U+2029 (PARAGRAPH SEPARATOR)', () => {
    const dangerous = `para${String.fromCharCode(0x2029)}separator`;
    const escaped = jsonForScriptTag({ component: dangerous });
    expect(escaped).not.toContain(String.fromCharCode(0x2029));
    expect(escaped).toContain('\\u2029');
  });

  it('produces valid JSON that round-trips through JSON.parse', () => {
    const payload = { component: 'button', components: ['button', 'avatar', '<x>'] };
    const escaped = jsonForScriptTag(payload);
    const parsed = JSON.parse(escaped) as typeof payload;
    expect(parsed).toEqual(payload);
  });
});

describe('renderShell', () => {
  it('embeds the active component and component list in the data island', () => {
    const html = renderShell('button', ['button', 'avatar']);
    const match = /<script type="application\/json" id="cinder-initial">([^<]+)<\/script>/.exec(
      html,
    );
    expect(match).not.toBeNull();
    const payload = JSON.parse(match![1]!) as { component: string; components: string[] };
    expect(payload.component).toBe('button');
    expect(payload.components).toEqual(['button', 'avatar']);
  });

  it('renders the shell-bundle script tag and #shell-root mount point', () => {
    const html = renderShell('button', ['button']);
    expect(html).toContain('id="shell-root"');
    expect(html).toContain('/shell-bundle/shell.js');
  });

  it('does not allow component names to break the data island via injection', () => {
    // A hypothetical bad component name is still valid input to the renderer
    // (the kebab-case invariant is enforced separately by the server); the
    // escaper has to handle whatever comes in.
    const html = renderShell('button', ['button', '</script><script>alert(1)</script>']);
    expect(html).not.toContain('</script><script>alert(1)</script>');
    expect(html).toContain('id="cinder-initial"');
  });

  it('loads the shell CSS bundle for Cinder components used by the shell', () => {
    const html = renderShell('button', ['button']);
    expect(html).toContain('href="/styles/shell.css"');
    expect(html).not.toContain('href="/styles/all.css"');
    expect(html).not.toContain('href="/styles/index.css"');
  });

  it('registers cinder.reset layer before /styles/shell.css so component CSS wins', () => {
    // Regression: when the universal `* { padding: 0 }` reset was unlayered
    // it beat every cinder.components layered rule, leaving SegmentedControl,
    // NumberInput, Card, Accordion all rendered without padding in the shell.
    // The fix declares the layer order in an inline <style> BEFORE the
    // stylesheet link so cinder.reset is reserved at the bottom of the
    // cascade. If anyone reorders these elements this test fails loudly.
    const html = renderShell('button', ['button']);
    const layerDeclaration =
      '@layer cinder.reset, cinder.tokens, cinder.foundation, cinder.components, cinder.utilities';
    const stylesheetLink = '<link rel="stylesheet" href="/styles/shell.css"';
    const layerIndex = html.indexOf(layerDeclaration);
    const linkIndex = html.indexOf(stylesheetLink);
    expect(layerIndex).toBeGreaterThan(-1);
    expect(linkIndex).toBeGreaterThan(-1);
    expect(layerIndex).toBeLessThan(linkIndex);
  });

  it('wraps the universal reset in the cinder.reset layer', () => {
    // Catches accidental un-layering of the reset block.
    const html = renderShell('button', ['button']);
    const layerBlockMatch =
      /@layer cinder\.reset\s*\{[^}]*\*,\s*\*::before,\s*\*::after\s*\{[^}]*padding:\s*0/i.exec(
        html,
      );
    expect(layerBlockMatch).not.toBeNull();
  });

  it('declares --cinder-top-bar-height once on :root', () => {
    // The token is the single source of truth for the fixed top bar's height.
    // It must live on :root so the top bar, sidebar, and main column all
    // inherit it without each re-declaring (and drifting out of sync).
    const html = renderShell('button', ['button']);
    const rootDeclaration = /:root\s*\{[^}]*--cinder-top-bar-height:\s*52px/.exec(html);
    expect(rootDeclaration).not.toBeNull();
  });
});

describe('renderShell metadata and Open Graph', () => {
  const ROOT_DESCRIPTION =
    'Interactive component playground for cinder — an accessible, SSR-safe Svelte 5 component library. Browse live examples, props, and themes.';
  const ROOT_TITLE = 'cinder playground — Svelte 5 component library';

  describe('root page', () => {
    it('emits the root description and base Open Graph / Twitter tags', () => {
      const html = renderShell(null, ['button']);
      expect(html).toContain(`<meta name="description" content="${ROOT_DESCRIPTION}" />`);
      expect(html).toContain(`<meta property="og:title" content="${ROOT_TITLE}" />`);
      expect(html).toContain(`<meta property="og:description" content="${ROOT_DESCRIPTION}" />`);
      expect(html).toContain(`<meta property="og:type" content="website" />`);
      expect(html).toContain(`<meta property="og:site_name" content="cinder playground" />`);
      expect(html).toContain(`<meta name="twitter:card" content="summary_large_image" />`);
      expect(html).toContain(`<meta name="twitter:title" content="${ROOT_TITLE}" />`);
      expect(html).toContain(`<meta name="twitter:description" content="${ROOT_DESCRIPTION}" />`);
      // Favicon is a self-contained data-URI SVG of the brick emoji — no
      // external request and no /favicon.svg route (which would 404).
      expect(html).toContain(`<link rel="icon" href="data:image/svg+xml,`);
      expect(html).not.toContain('href="/favicon.svg"');
      expect(html).not.toContain('fav.farm');
    });

    it('omits absolute-URL tags when no base URL is provided', () => {
      const html = renderShell(null, ['button'], { baseUrl: '' });
      expect(html).not.toContain('property="og:url"');
      expect(html).not.toContain('property="og:image"');
      expect(html).not.toContain('name="twitter:image"');
      expect(html).not.toContain('rel="canonical"');
    });

    it('emits absolute URL tags rooted at "/" when a base URL is provided', () => {
      const html = renderShell(null, ['button'], { baseUrl: 'https://playground.cinder.dev' });
      expect(html).toContain('<meta property="og:url" content="https://playground.cinder.dev/" />');
      expect(html).toContain(
        '<meta property="og:image" content="https://playground.cinder.dev/social.png" />',
      );
      expect(html).toContain(
        '<meta name="twitter:image" content="https://playground.cinder.dev/social.png" />',
      );
      expect(html).toContain('<link rel="canonical" href="https://playground.cinder.dev/" />');
    });
  });

  describe('per-component page', () => {
    const PER_COMPONENT_DESCRIPTION =
      'Button component for cinder: live, interactive examples plus a full props/API reference. Toggle light and dark themes and preview responsive breakpoints.';
    const PER_COMPONENT_TITLE = 'Button — cinder playground';

    it('emits a per-component description and matching og/twitter title', () => {
      const html = renderShell('button', ['button']);
      expect(html).toContain(`<meta name="description" content="${PER_COMPONENT_DESCRIPTION}" />`);
      expect(html).toContain(
        `<meta property="og:description" content="${PER_COMPONENT_DESCRIPTION}" />`,
      );
      expect(html).toContain(`<meta property="og:title" content="${PER_COMPONENT_TITLE}" />`);
      expect(html).toContain(`<meta name="twitter:title" content="${PER_COMPONENT_TITLE}" />`);
      expect(html).toContain(
        `<meta name="twitter:description" content="${PER_COMPONENT_DESCRIPTION}" />`,
      );
    });

    it('omits absolute-URL tags when no base URL is provided', () => {
      const html = renderShell('button', ['button'], { baseUrl: '' });
      expect(html).not.toContain('property="og:url"');
      expect(html).not.toContain('property="og:image"');
      expect(html).not.toContain('name="twitter:image"');
      expect(html).not.toContain('rel="canonical"');
    });

    it('builds the absolute canonical/og:url from the component path when a base URL is set', () => {
      const html = renderShell('button', ['button'], {
        baseUrl: 'https://playground.cinder.dev',
      });
      expect(html).toContain(
        '<meta property="og:url" content="https://playground.cinder.dev/c/button" />',
      );
      expect(html).toContain(
        '<link rel="canonical" href="https://playground.cinder.dev/c/button" />',
      );
      expect(html).toContain(
        '<meta property="og:image" content="https://playground.cinder.dev/social.png" />',
      );
      expect(html).toContain(
        '<meta name="twitter:image" content="https://playground.cinder.dev/social.png" />',
      );
    });

    it('strips a trailing slash from the base URL before composing absolute URLs', () => {
      const html = renderShell('button', ['button'], {
        baseUrl: 'https://playground.cinder.dev/',
      });
      expect(html).toContain(
        '<meta property="og:url" content="https://playground.cinder.dev/c/button" />',
      );
      expect(html).not.toContain('cinder.dev//c/button');
    });
  });

  it('HTML-escapes the component name inside metadata values', () => {
    // The kebab-case invariant is enforced by the server, but the renderer must
    // still escape whatever it is handed so a crafted name cannot break out of
    // an attribute value.
    const html = renderShell('"><script>', ['button']);
    expect(html).not.toContain('"><script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });
});
