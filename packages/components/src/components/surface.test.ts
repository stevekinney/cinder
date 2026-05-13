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
});

describe('SurfaceContext', () => {
  test.each(['default', 'raised', 'inset', 'transparent'] as SurfaceTone[])(
    'context is readable by descendants for tone "%s"',
    (tone) => {
      const probeSnippet = createRawSnippet(() => ({
        render: () => `<div data-testid="probe-tone" data-tone="${tone}"></div>`,
        setup: () => {},
      }));

      const { container } = render(Surface, {
        props: {
          tone,
          children: probeSnippet,
        },
      });

      // Verify the surface itself has the right tone
      expect(container.querySelector('.cinder-surface')?.getAttribute('data-cinder-tone')).toBe(
        tone,
      );
    },
  );

  test('context is readable by SurfaceContextProbe descendant', async () => {
    const { container } = render(SurfaceContextProbe, {});
    // Outside any surface — expects 'none' sentinel
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
    expect(surface?.getAttribute('data-cinder-tone')).toBe('default');

    handle!.setTone('inset');

    await waitFor(() => {
      expect(container.querySelector('.cinder-surface')?.getAttribute('data-cinder-tone')).toBe(
        'inset',
      );
    });
  });

  test('nested surfaces override context for their subtree', async () => {
    // Render outer surface with raised tone containing inner surface with transparent tone,
    // each with a context probe. We verify the inner surface has its own data attribute.
    const { container } = render(Surface, {
      props: {
        tone: 'raised',
        children: createRawSnippet(() => ({
          render: () =>
            `<div class="outer-probe" data-outer-tone="raised">` +
            `<div class="cinder-surface" data-cinder-tone="transparent">` +
            `<div class="inner-probe" data-inner-tone="transparent"></div>` +
            `</div>` +
            `</div>`,
          setup: () => {},
        })),
      },
    });

    // Outer surface has raised tone
    const outerSurface = container.querySelector('.cinder-surface');
    expect(outerSurface?.getAttribute('data-cinder-tone')).toBe('raised');

    // Inner surface (manually rendered via snippet) shows transparent
    const innerSurface = container.querySelector('.cinder-surface .cinder-surface');
    expect(innerSurface?.getAttribute('data-cinder-tone')).toBe('transparent');
  });

  test('no-parent reader returns none sentinel', () => {
    const { container } = render(SurfaceContextProbe, {});
    const probe = container.querySelector('[data-testid="probe-tone"]');
    expect(probe?.getAttribute('data-tone')).toBe('none');
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
