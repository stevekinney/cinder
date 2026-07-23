import { describe, expect, test } from 'bun:test';

describe('DiffLine CSS contract', () => {
  test('modified gutter rules use the info foreground token', async () => {
    const source = await Bun.file(new URL('./diff-line.svelte', import.meta.url)).text();
    const modifiedGutterBlocks =
      source.match(/\.diff-line-modified(?:-final|-original)? \.diff-gutter\s*\{[^}]*\}/g) ?? [];

    expect(modifiedGutterBlocks.length).toBe(3);
    for (const block of modifiedGutterBlocks) {
      expect(block).toContain('color: var(--cinder-color-info-fg)');
      expect(block).not.toContain('color: var(--cinder-color-info-bg)');
    }
  });
});
