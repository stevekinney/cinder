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
});
