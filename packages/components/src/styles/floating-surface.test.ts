import { describe, expect, test } from 'bun:test';

describe('floating surface shared recipe', () => {
  test('base surface keeps overflow visible so arrows are not clipped', async () => {
    const css = await Bun.file(`${import.meta.dir}/components/_floating-surface.css`).text();

    expect(css).toMatch(/\.cinder-_floating-surface\s*\{[\s\S]*?overflow:\s*visible;/);
    expect(css).toMatch(
      /\.cinder-_floating-surface:where\(\[role='listbox'\], \[role='menu'\]\)\s*\{[\s\S]*?overflow:\s*auto;/,
    );
  });
});
