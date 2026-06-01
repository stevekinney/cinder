/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: ButtonGroup } = await import('./button-group.svelte');

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Snippet helpers
// ---------------------------------------------------------------------------

function singleButtonSnippet(label: string) {
  return createRawSnippet(() => ({
    render: () => `<button type="button">${label}</button>`,
    setup: () => {},
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ButtonGroup', () => {
  test('role and aria-label with label prop', () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Document actions', children: singleButtonSnippet('Save') },
    });
    const group = container.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute('aria-label')).toBe('Document actions');
  });

  test('role and aria-labelledby with labelledBy prop', () => {
    const { container } = render(ButtonGroup, {
      props: { labelledBy: 'heading-id', children: singleButtonSnippet('Save') },
    });
    const group = container.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute('aria-labelledby')).toBe('heading-id');
    expect(group?.hasAttribute('aria-label')).toBe(false);
  });

  test('label prop produces no aria-labelledby', () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', children: singleButtonSnippet('Save') },
    });
    const group = container.querySelector('[role="group"]');
    expect(group?.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('labelledBy prop produces no aria-label', () => {
    const { container } = render(ButtonGroup, {
      props: { labelledBy: 'x', children: singleButtonSnippet('Save') },
    });
    const group = container.querySelector('[role="group"]');
    expect(group?.hasAttribute('aria-label')).toBe(false);
  });

  test('data-cinder-orientation defaults to horizontal', () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', children: singleButtonSnippet('Save') },
    });
    const group = container.querySelector('[role="group"]');
    // aria-orientation is intentionally absent — it is not a valid attribute for role="group"
    expect(group?.hasAttribute('aria-orientation')).toBe(false);
    expect(group?.getAttribute('data-cinder-orientation')).toBe('horizontal');
  });

  test('data-cinder-orientation is set to vertical when orientation="vertical"', () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', orientation: 'vertical', children: singleButtonSnippet('Save') },
    });
    const group = container.querySelector('[role="group"]');
    // aria-orientation is intentionally absent — it is not a valid attribute for role="group"
    expect(group?.hasAttribute('aria-orientation')).toBe(false);
    expect(group?.getAttribute('data-cinder-orientation')).toBe('vertical');
  });

  test('warns in dev mode when label is empty string', () => {
    const warnSpy = mock(() => {});
    const original = console.warn;
    console.warn = warnSpy;

    try {
      render(ButtonGroup, {
        props: { label: '', children: singleButtonSnippet('Save') },
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect((warnSpy.mock.calls[0] as string[])[0]).toStartWith('[cinder/ButtonGroup]');
    } finally {
      console.warn = original;
    }
  });

  test('warns in dev mode when label is whitespace-only', () => {
    const warnSpy = mock(() => {});
    const original = console.warn;
    console.warn = warnSpy;

    try {
      render(ButtonGroup, {
        props: { label: '   ', children: singleButtonSnippet('Save') },
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect((warnSpy.mock.calls[0] as string[])[0]).toStartWith('[cinder/ButtonGroup]');
    } finally {
      console.warn = original;
    }
  });

  test('warns in dev mode when labelledBy is empty string', () => {
    const warnSpy = mock(() => {});
    const original = console.warn;
    console.warn = warnSpy;

    try {
      render(ButtonGroup, {
        props: { labelledBy: '', children: singleButtonSnippet('Save') },
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect((warnSpy.mock.calls[0] as string[])[0]).toStartWith('[cinder/ButtonGroup]');
    } finally {
      console.warn = original;
    }
  });

  test('class passthrough merges with cinder-button-group', () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', class: 'extra', children: singleButtonSnippet('Save') },
    });
    const group = container.querySelector('[role="group"]');
    expect(group?.classList.contains('cinder-button-group')).toBe(true);
    expect(group?.classList.contains('extra')).toBe(true);
  });

  test('rest spread attributes reach the rendered div', () => {
    const { container } = render(ButtonGroup, {
      props: {
        label: 'Actions',
        'data-testid': 'my-group',
        children: singleButtonSnippet('Save'),
      } as any,
    });
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('data-testid')).toBe('my-group');
  });

  test('no selection ARIA on the container', () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', children: singleButtonSnippet('Save') },
    });
    const group = container.querySelector('[role="group"]');
    expect(group?.hasAttribute('aria-activedescendant')).toBe(false);
    expect(group?.hasAttribute('aria-multiselectable')).toBe(false);
    expect(group?.hasAttribute('aria-checked')).toBe(false);
    expect(group?.hasAttribute('aria-orientation')).toBe(false);
    expect(group?.getAttribute('role')).not.toBe('radiogroup');
  });

  test('direct child carries the styling-contract attribute after mount', () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', children: singleButtonSnippet('Save') },
    });

    const group = container.querySelector('.cinder-button-group');
    const directChild = group?.children[0];
    expect(directChild).not.toBeUndefined();
    expect(directChild?.hasAttribute('data-cinder-button-group-item')).toBe(true);
  });

  test('styling-contract attribute carries a non-empty group ID for ownership', () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', children: singleButtonSnippet('Save') },
    });

    const group = container.querySelector('.cinder-button-group');
    const directChild = group?.children[0];
    const value = directChild?.getAttribute('data-cinder-button-group-item');
    expect(value).not.toBeNull();
    expect(value?.length).toBeGreaterThan(0);
  });

  test('styling-contract attribute is removed from a child after it is removed from the group', async () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', children: singleButtonSnippet('Save') },
    });

    const group = container.querySelector('.cinder-button-group')!;
    const child = group.children[0] as Element;
    expect(child.hasAttribute('data-cinder-button-group-item')).toBe(true);

    group.removeChild(child);
    // MutationObserver callbacks are batched as microtasks. In happy-dom,
    // a setTimeout(0) reliably flushes the callback queue.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(child.hasAttribute('data-cinder-button-group-item')).toBe(false);
  });

  test('styling-contract attribute is added to a child appended after mount', async () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', children: singleButtonSnippet('Save') },
    });

    const group = container.querySelector('.cinder-button-group')!;
    const newButton = document.createElement('button');
    newButton.textContent = 'Cancel';
    group.appendChild(newButton);

    // MutationObserver callbacks are batched as microtasks. In happy-dom,
    // a setTimeout(0) reliably flushes the callback queue.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(newButton.hasAttribute('data-cinder-button-group-item')).toBe(true);
  });

  test('button group styles stretch dropdown participants for split-button composition', async () => {
    const css = await Bun.file(new URL('./button-group.css', import.meta.url)).text();

    expect(css).toMatch(/\.cinder-button-group\s*\{[\s\S]*?align-items:\s*stretch;/);
    expect(css).toMatch(
      /\.cinder-button-group\s*>\s*\.cinder-dropdown\[data-cinder-button-group-item\]\s*\{[\s\S]*?display:\s*inline-flex;/,
    );
    expect(css).toMatch(
      /\.cinder-button-group[\s\S]*?>\s*\.cinder-dropdown\[data-cinder-button-group-item\][\s\S]*?>\s*\.cinder-dropdown-trigger\s*\{[\s\S]*?min-block-size:\s*100%;/,
    );
  });

  test('seams use a pseudo-element line, not negative-margin overlap', async () => {
    const css = await Bun.file(new URL('./button-group.css', import.meta.url)).text();

    // Negative-margin seams are gone.
    expect(css).not.toContain('margin-inline-start: -1px');
    expect(css).not.toContain('margin-block-start: -1px');

    // A seam ::before exists on non-first items with the border color at z-index 1.
    expect(css).toMatch(
      /\[data-cinder-button-group-item\]:not\(:first-child\)::before\s*\{[\s\S]*?z-index:\s*1;[\s\S]*?background:\s*var\(--cinder-border\);/,
    );

    // The seam is suppressed on hovered, active, AND focused participants (own near-edge seam).
    // A single :where(:hover, :active, :focus-within) rule covers all three states so that
    // a secondary button's highlighted surface is never cut by a stray divider line.
    // The regex tolerates Prettier line-wrapping inside :not(...) and across selector lines.
    expect(css).toMatch(
      /\[data-cinder-button-group-item\]:where\(:hover,\s*:active,\s*:focus-within\):not\([\s\S]*?:first-child[\s\S]*?\)::before[\s\S]*?\{[\s\S]*?opacity:\s*0;/,
    );

    // The far-edge seam is owned by the item that FOLLOWS the highlighted one (its
    // near-edge ::before sits on the shared boundary), so it is suppressed via the
    // adjacent-sibling combinator: highlighted-item + next-item::before. Without this
    // rule a visible divider would hug the far edge of the highlight.
    // The regex tolerates Prettier line-wrapping across the selector lines.
    expect(css).toMatch(
      /\[data-cinder-button-group-item\]:where\(:hover,\s*:active,\s*:focus-within\)[\s\S]*?\+[\s\S]*?\[data-cinder-button-group-item\]::before[\s\S]*?\{[\s\S]*?opacity:\s*0;/,
    );

    // BOTH borders meeting at a junction are zeroed (start on non-first, end on
    // non-last) so bordered variants don't render a doubled 2px divider.
    expect(css).toContain('border-inline-start-color: transparent;');
    expect(css).toContain('border-inline-end-color: transparent;');
    expect(css).toContain('border-block-start-color: transparent;');
    expect(css).toContain('border-block-end-color: transparent;');

    // Forced-colors remaps the seam to CanvasText with no border restore.
    expect(css).toMatch(
      /@media \(forced-colors: active\)\s*\{[\s\S]*?::before\s*\{[\s\S]*?background:\s*CanvasText;/,
    );
  });
});
