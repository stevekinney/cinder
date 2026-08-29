import { describe, expect, test } from 'bun:test';

const source = await Bun.file(`${import.meta.dir}/message-content.svelte`).text();

describe('live text shimmer', () => {
  test('uses a stepped text-clipped scan with readable hover and reduced-motion states', () => {
    expect(source).toContain('background-clip: text');
    expect(source).toContain('steps(48, end)');
    expect(source).toMatch(
      /\.message-content-streaming:hover[\s\S]*?color:\s*var\(--cinder-text-default\)/,
    );
    expect(source).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.message-content-streaming[\s\S]*?animation:\s*none/,
    );
  });
});
