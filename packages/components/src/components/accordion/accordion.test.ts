/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet, mount, unmount } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Accordion } = await import('./accordion.svelte');
const { default: AccordionItem } = await import('../accordion-item/accordion-item.svelte');

// ---------------------------------------------------------------------------
// Snippet helpers
// ---------------------------------------------------------------------------

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

/**
 * Build a children snippet that mounts two AccordionItems inside the Accordion.
 * `createRawSnippet` render must return a single-root HTML string; we use a
 * wrapper div and mount items into it via Svelte's `mount`.
 */
function twoItemsSnippet() {
  return createRawSnippet(() => ({
    render: () => `<div class="items-wrapper"></div>`,
    setup: (node: Element) => {
      const instance1 = mount(AccordionItem, {
        target: node,
        props: { id: 'item-1', title: 'Item 1', children: textSnippet('Content 1') },
      });
      const instance2 = mount(AccordionItem, {
        target: node,
        props: { id: 'item-2', title: 'Item 2', children: textSnippet('Content 2') },
      });
      return () => {
        unmount(instance1);
        unmount(instance2);
      };
    },
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Accordion', () => {
  test('renders children content', () => {
    const { container } = render(Accordion, {
      props: {
        expandedIds: [],
        children: textSnippet('accordion content'),
      },
    });
    expect(container.querySelector('.cinder-accordion')).not.toBeNull();
    expect(container.textContent).toContain('accordion content');
  });

  test('applies cinder-accordion class to the root element', () => {
    const { container } = render(Accordion, {
      props: {
        expandedIds: [],
        children: textSnippet('x'),
      },
    });
    expect(container.querySelector('.cinder-accordion')).not.toBeNull();
  });

  test('applies a custom class alongside cinder-accordion', () => {
    const { container } = render(Accordion, {
      props: {
        expandedIds: [],
        class: 'my-custom',
        children: textSnippet('x'),
      },
    });
    const root = container.querySelector('.cinder-accordion');
    expect(root?.classList.contains('my-custom')).toBe(true);
  });

  test('multiple=false — opening one item closes others (expandedIds has only the new id)', async () => {
    let expandedIds: string[] = ['item-1'];

    const { container } = render(Accordion, {
      props: {
        multiple: false,
        get expandedIds() {
          return expandedIds;
        },
        set expandedIds(value: string[]) {
          expandedIds = value;
        },
        children: twoItemsSnippet(),
      },
    });

    const buttons = container.querySelectorAll('.cinder-accordion-item__trigger');
    expect(buttons.length).toBe(2);

    // item-1 is currently open; clicking item-2 should close item-1
    await fireEvent.click(buttons[1] as Element);

    expect(expandedIds).toEqual(['item-2']);
    expect(expandedIds).not.toContain('item-1');
  });

  test('multiple=true — opening a second item keeps the first item open', async () => {
    let expandedIds: string[] = ['item-1'];

    const { container } = render(Accordion, {
      props: {
        multiple: true,
        get expandedIds() {
          return expandedIds;
        },
        set expandedIds(value: string[]) {
          expandedIds = value;
        },
        children: twoItemsSnippet(),
      },
    });

    const buttons = container.querySelectorAll('.cinder-accordion-item__trigger');
    expect(buttons.length).toBe(2);

    // item-1 is open; clicking item-2 should add it without removing item-1
    await fireEvent.click(buttons[1] as Element);

    expect(expandedIds).toContain('item-1');
    expect(expandedIds).toContain('item-2');
  });
});
