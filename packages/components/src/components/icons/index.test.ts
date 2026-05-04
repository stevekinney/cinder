import { describe, expect, it } from 'bun:test';

import * as icons from './index.ts';

describe('icons/index', () => {
  it('exports a non-empty set of distinct, function-shaped Svelte components', () => {
    const entries = Object.entries(icons);

    expect(entries.length).toBeGreaterThan(0);

    for (const [name, icon] of entries) {
      expect(typeof icon, `${name} should be a function (Svelte component)`).toBe('function');
    }

    const components = entries.map(([, icon]) => icon);
    expect(new Set(components).size, 'every export must have distinct identity (no aliasing)').toBe(
      components.length,
    );
  });
});
