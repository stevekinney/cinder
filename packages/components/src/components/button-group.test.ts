/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: ButtonGroup } = await import('./button-group.svelte');

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Snippet helpers
// ---------------------------------------------------------------------------

function buttonSnippet(labels: string[]) {
  return createRawSnippet(() => ({
    render: () =>
      `<div class="buttons-wrapper">${labels.map((l) => `<button type="button">${l}</button>`).join('')}</div>`,
    setup: () => {},
  }));
}

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

  test('aria-orientation defaults to horizontal', () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', children: singleButtonSnippet('Save') },
    });
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-orientation')).toBe('horizontal');
    expect(group?.getAttribute('data-cinder-orientation')).toBe('horizontal');
  });

  test('aria-orientation vertical when orientation="vertical"', () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', orientation: 'vertical', children: singleButtonSnippet('Save') },
    });
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-orientation')).toBe('vertical');
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
    expect(group?.getAttribute('role')).not.toBe('radiogroup');
  });

  test('direct children carry the styling-contract attribute after mount', () => {
    const { container } = render(ButtonGroup, {
      props: { label: 'Actions', children: buttonSnippet(['Save', 'Cancel', 'Reset']) },
    });

    const group = container.querySelector('.cinder-button-group');
    const directChildren = Array.from(group?.children ?? []);
    expect(directChildren.length).toBeGreaterThan(0);
    for (const child of directChildren) {
      expect(child.hasAttribute('data-cinder-button-group-item')).toBe(true);
    }
  });
});
