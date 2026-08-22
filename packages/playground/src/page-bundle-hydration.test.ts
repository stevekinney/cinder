import { describe, expect, test } from 'bun:test';

describe('page bundle hydration policy', () => {
  test('starts hydration eagerly and never uses scrolling as the trigger', async () => {
    const source = await Bun.file(new URL('./page-bundle.ts', import.meta.url)).text();

    expect(source).not.toContain("window.addEventListener('scroll'");
    expect(source).toContain('void hydratePage().catch');
  });
});
