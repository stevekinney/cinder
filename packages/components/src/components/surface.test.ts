/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import type { SurfaceTone } from '../_internal/surface-context.ts';
import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, waitFor } = await import('@testing-library/svelte');
const { default: Surface } = await import('./surface.svelte');
const { default: SurfaceContextProbe } =
  await import('../test/fixtures/surface-context-probe.svelte');
const { default: SurfaceToneMutator } =
  await import('../test/fixtures/surface-tone-mutator.svelte');
const { default: SurfaceWithProbe } = await import('../test/fixtures/surface-with-probe.svelte');
const { default: NestedSurfacesFixture } =
  await import('../test/fixtures/nested-surfaces-fixture.svelte');

const emptySnippet = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

describe('Surface rendering', () => {
  test('default tone renders correct data attribute', () => {
    const { container } = render(Surface, {
      props: { children: emptySnippet },
    });
    const root = container.querySelector('.cinder-surface');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-cinder-tone')).toBe('default');
  });

  test.each(['default', 'raised', 'inset', 'transparent'] as SurfaceTone[])(
    'tone "%s" renders correct data-cinder-tone attribute',
    (tone) => {
      const { container } = render(Surface, {
        props: { tone, children: emptySnippet },
      });
      expect(container.querySelector('.cinder-surface')?.getAttribute('data-cinder-tone')).toBe(
        tone,
      );
    },
  );

  test('custom class merges with cinder-surface', () => {
    const { container } = render(Surface, {
      props: { class: 'my-extra', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-surface');
    expect(root?.classList.contains('cinder-surface')).toBe(true);
    expect(root?.classList.contains('my-extra')).toBe(true);
  });

  test('rest props (id, data-*, aria-label) forward to root element', () => {
    const { container } = render(Surface, {
      props: {
        id: 'foo',
        'data-bar': 'baz',
        'aria-label': 'region',
        children: emptySnippet,
      },
    });
    const root = container.querySelector('.cinder-surface');
    expect(root?.getAttribute('id')).toBe('foo');
    expect(root?.getAttribute('data-bar')).toBe('baz');
    expect(root?.getAttribute('aria-label')).toBe('region');
  });

  test('children snippet renders inside the surface', () => {
    const childSnippet = createRawSnippet(() => ({
      render: () => `<span data-testid="child-content">hello</span>`,
      setup: () => {},
    }));
    const { container } = render(Surface, {
      props: { children: childSnippet },
    });
    expect(container.querySelector('.cinder-surface [data-testid="child-content"]')).not.toBeNull();
  });
});

describe('SurfaceContext', () => {
  test.each(['default', 'raised', 'inset', 'transparent'] as SurfaceTone[])(
    'context is readable by a real descendant component for tone "%s"',
    (tone) => {
      const { container } = render(SurfaceWithProbe, {
        props: { tone },
      });
      const probe = container.querySelector('.cinder-surface [data-testid="probe-tone"]');
      expect(probe?.getAttribute('data-tone')).toBe(tone);
    },
  );

  test('no-parent reader returns none sentinel', () => {
    const { container } = render(SurfaceContextProbe, {});
    const probe = container.querySelector('[data-testid="probe-tone"]');
    expect(probe?.getAttribute('data-tone')).toBe('none');
  });

  test('context updates reactively when tone changes', async () => {
    let handle: { setTone: (next: SurfaceTone) => void } | null = null;

    const { container } = render(SurfaceToneMutator, {
      props: {
        initial: 'default',
        onReady: (h: { setTone: (next: SurfaceTone) => void }) => {
          handle = h;
        },
      },
    });

    await waitFor(() => expect(handle).not.toBeNull());

    const surface = container.querySelector('.cinder-surface');
    const probe = container.querySelector('[data-testid="mutator-probe"]');
    expect(surface?.getAttribute('data-cinder-tone')).toBe('default');
    expect(probe?.getAttribute('data-tone')).toBe('default');

    handle!.setTone('inset');

    await waitFor(() => {
      expect(container.querySelector('.cinder-surface')?.getAttribute('data-cinder-tone')).toBe(
        'inset',
      );
      expect(
        container.querySelector('[data-testid="mutator-probe"]')?.getAttribute('data-tone'),
      ).toBe('inset');
    });
  });

  test('nested surfaces override context for their subtree', () => {
    const { container } = render(NestedSurfacesFixture, {});

    // Outer probe (between outer and inner Surface) reads the outer tone
    const outerProbe = container.querySelector('[data-testid="outer-probe"]');
    expect(outerProbe?.getAttribute('data-tone')).toBe('raised');

    // Inner probe (inside inner Surface) reads the inner tone
    const innerProbe = container.querySelector('[data-testid="inner-probe"]');
    expect(innerProbe?.getAttribute('data-tone')).toBe('transparent');
  });
});

describe('Surface CSS contract', () => {
  test('surface.css contains transparent tone rule with required declarations', async () => {
    const css = await Bun.file(new URL('../styles/components/surface.css', import.meta.url)).text();

    expect(css).toContain("[data-cinder-tone='transparent']");
    expect(css).toContain('background: transparent');
    expect(css).toContain('border: 1px solid var(--cinder-border)');
    expect(css).toContain('box-shadow: none');
  });
});
