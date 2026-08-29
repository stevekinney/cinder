import { describe, expect, test } from 'bun:test';

const utilitiesCss = await Bun.file(`${import.meta.dir}/utilities.css`).text();

describe('markdown inline code', () => {
  test('clones decoration across wrapped fragments and isolates bidirectional text', () => {
    const rule = utilitiesCss.match(
      /\.cinder-markdown-content\s+:where\(:not\(pre\)\s*>\s*code\)\s*\{([^}]*)\}/,
    )?.[1];

    expect(rule).toContain('-webkit-box-decoration-break: clone');
    expect(rule).toContain('box-decoration-break: clone');
    expect(rule).toContain('unicode-bidi: isolate');
  });
});
