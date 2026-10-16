import { describe, expect, it } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import type { IconComponent, IconProps } from './index.ts';
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

  it('types every exported icon as an IconComponent that takes size and stroke props alone', () => {
    // A type-level regression as much as a runtime one: `@lucide/svelte`'s own
    // `IconProps` requires icon data and its icons are Svelte 5 function
    // components, so an `IconProps` or `IconComponent` copied from it, or the
    // legacy class-component `ComponentType`, rejects these assignments.
    const props: IconProps = { size: 16, strokeWidth: 1.5, 'aria-label': 'More' };
    const renamedUpstream: IconComponent[] = [icons.MoreHorizontal, icons.Trash2];
    for (const icon of renamedUpstream) {
      const result = render(icon, props);
      try {
        const svg = result.container.querySelector('svg.lucide');
        expect(svg?.getAttribute('width')).toBe('16');
        expect(svg?.getAttribute('stroke-width')).toBe('1.5');
      } finally {
        cleanup();
      }
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
