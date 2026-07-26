import { describe, expect, test } from 'bun:test';

import { stripInlineSourcemaps } from './strip-inline-sourcemaps.ts';

describe('stripInlineSourcemaps', () => {
  test('removes an inline sourcemap comment from a style tag', () => {
    const head = `<style id="svelte-abc123">
  .card.svelte-abc123 { color: red; }

/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozfQ== */</style>`;

    const stripped = stripInlineSourcemaps(head);

    expect(stripped).not.toContain('sourceMappingURL');
    expect(stripped).toContain('.card.svelte-abc123 { color: red; }');
    expect(stripped).toContain('<style id="svelte-abc123">');
    expect(stripped).toContain('</style>');
  });

  test('removes every comment when several style tags are present', () => {
    const head = [
      '<style id="a">.a{color:red}/*# sourceMappingURL=data:application/json;base64,AAA= */</style>',
      '<style id="b">.b{color:blue}/*# sourceMappingURL=data:application/json;base64,BBB= */</style>',
    ].join('\n');

    const stripped = stripInlineSourcemaps(head);

    expect(stripped).not.toContain('sourceMappingURL');
    expect(stripped).toContain('.a{color:red}');
    expect(stripped).toContain('.b{color:blue}');
  });

  test('handles a payload that spans multiple lines', () => {
    const head = `<style>.x{color:red}/*# sourceMappingURL=data:application/json;base64,AAAA
BBBB
CCCC */</style>`;

    expect(stripInlineSourcemaps(head)).not.toContain('sourceMappingURL');
  });

  test('returns the input unchanged when there is no sourcemap comment', () => {
    const head = '<style id="svelte-xyz">.a.svelte-xyz { color: red; }</style>';

    expect(stripInlineSourcemaps(head)).toBe(head);
  });

  test('leaves ordinary CSS comments alone', () => {
    const css = '/* keep me */ .a { color: red; } /* and me */';

    expect(stripInlineSourcemaps(css)).toBe(css);
  });

  test('preserves declarations that follow a stripped comment', () => {
    const css =
      '.a{color:red}/*# sourceMappingURL=data:application/json;base64,AA= */.b{color:blue}';

    const stripped = stripInlineSourcemaps(css);

    expect(stripped).toBe('.a{color:red}.b{color:blue}');
  });

  test('is idempotent', () => {
    const head =
      '<style>.a{color:red}/*# sourceMappingURL=data:application/json;base64,AA= */</style>';

    const once = stripInlineSourcemaps(head);

    expect(stripInlineSourcemaps(once)).toBe(once);
  });
});
