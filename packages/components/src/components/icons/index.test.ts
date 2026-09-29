import { describe, expect, it } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import * as icons from './index.ts';

setupHappyDom();
const { render, cleanup } = await import('@testing-library/svelte');
const { Link, LinkIcon } = await import('@lostgradient/cinder');

describe('icons/index', () => {
  it('exposes the Link icon separately from the Link component through the package root', () => {
    expect(LinkIcon).not.toBe(Link);
    const result = render(LinkIcon, { 'aria-label': 'Insert link' });
    try {
      expect(result.container.querySelector('svg')?.getAttribute('aria-label')).toBe('Insert link');
      expect(result.container.querySelector('a')).toBeNull();
    } finally {
      cleanup();
    }
  });

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
