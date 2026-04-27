/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet, mount, unmount } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Accordion } = await import('./accordion.svelte');
const { default: AccordionItem } = await import('./accordion-item.svelte');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

/**
 * Render a single AccordionItem inside an Accordion so the Svelte context is
 * established before AccordionItem calls `getContext`.
 *
 * `createRawSnippet` render must return a single-root element; we use a
 * wrapper div and mount AccordionItem into it via Svelte's `mount`.
 *
 * Returns the @testing-library/svelte container (the Accordion root div),
 * which includes the rendered AccordionItem in its subtree.
 */
function renderItem(options: {
  id: string;
  title: string;
  content?: string;
  disabled?: boolean;
  expandedIds?: string[];
  multiple?: boolean;
  onExpandedChange?: (ids: string[]) => void;
}) {
  const {
    id,
    title,
    content = 'Panel content',
    disabled = false,
    expandedIds: initialIds = [],
    multiple = false,
    onExpandedChange,
  } = options;

  let expandedIds = [...initialIds];

  return render(Accordion, {
    props: {
      multiple,
      get expandedIds() {
        return expandedIds;
      },
      set expandedIds(value: string[]) {
        expandedIds = value;
        onExpandedChange?.(value);
      },
      children: createRawSnippet(() => ({
        render: () => `<div class="item-wrapper"></div>`,
        setup: (node: Element) => {
          const instance = mount(AccordionItem, {
            target: node,
            props: {
              id,
              title,
              disabled,
              children: textSnippet(content),
            },
          });
          return () => {
            unmount(instance);
          };
        },
      })),
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccordionItem', () => {
  test('header button has aria-expanded="false" when id is not in expandedIds', () => {
    const { container } = renderItem({
      id: 'item-a',
      title: 'Item A',
      expandedIds: [],
    });

    const button = container.querySelector('.cinder-accordion-item__trigger');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  test('header button has aria-expanded="true" when id is in expandedIds', () => {
    const { container } = renderItem({
      id: 'item-b',
      title: 'Item B',
      expandedIds: ['item-b'],
    });

    const button = container.querySelector('.cinder-accordion-item__trigger');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
  });

  test('panel content renders when item is expanded', () => {
    const { container } = renderItem({
      id: 'item-c',
      title: 'Item C',
      content: 'Hello from panel',
      expandedIds: ['item-c'],
    });

    const panel = container.querySelector('.cinder-accordion-item__panel');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('Hello from panel');
  });

  test('panel is absent when item is not expanded', () => {
    const { container } = renderItem({
      id: 'item-d',
      title: 'Item D',
      content: 'Should not appear',
      expandedIds: [],
    });

    expect(container.querySelector('.cinder-accordion-item__panel')).toBeNull();
    expect(container.textContent).not.toContain('Should not appear');
  });

  test('clicking the header button toggles expanded state', async () => {
    const changes: string[][] = [];

    const { container } = renderItem({
      id: 'item-e',
      title: 'Item E',
      expandedIds: [],
      onExpandedChange: (ids) => changes.push([...ids]),
    });

    const button = container.querySelector('.cinder-accordion-item__trigger') as HTMLButtonElement;
    expect(button).not.toBeNull();

    // Initially collapsed — click to open
    await fireEvent.click(button);
    expect(changes.at(-1)).toContain('item-e');
  });

  test('disabled item button has the disabled attribute', () => {
    const { container } = renderItem({
      id: 'item-f',
      title: 'Item F',
      disabled: true,
    });

    const button = container.querySelector('.cinder-accordion-item__trigger') as HTMLButtonElement;
    expect(button?.disabled).toBe(true);
  });

  test('disabled item button has aria-disabled="true"', () => {
    const { container } = renderItem({
      id: 'item-g',
      title: 'Item G',
      disabled: true,
    });

    const button = container.querySelector('.cinder-accordion-item__trigger');
    expect(button?.getAttribute('aria-disabled')).toBe('true');
  });

  test('header button aria-controls points to the panel id', () => {
    const { container } = renderItem({
      id: 'my-item',
      title: 'My Item',
      expandedIds: ['my-item'],
    });

    const button = container.querySelector('.cinder-accordion-item__trigger');
    const panel = container.querySelector('.cinder-accordion-item__panel');

    expect(button?.getAttribute('aria-controls')).toBe('my-item-panel');
    expect(panel?.id).toBe('my-item-panel');
  });

  test('panel has aria-labelledby pointing to the header button id', () => {
    const { container } = renderItem({
      id: 'linked-item',
      title: 'Linked Item',
      expandedIds: ['linked-item'],
    });

    const button = container.querySelector('.cinder-accordion-item__trigger');
    const panel = container.querySelector('.cinder-accordion-item__panel');

    expect(button?.id).toBe('linked-item-header');
    expect(panel?.getAttribute('aria-labelledby')).toBe('linked-item-header');
  });

  test('title text is rendered inside the trigger button', () => {
    const { container } = renderItem({
      id: 'titled-item',
      title: 'Visible Title Text',
    });

    const button = container.querySelector('.cinder-accordion-item__trigger');
    expect(button?.textContent).toContain('Visible Title Text');
  });
});
