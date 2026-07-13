/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet, mount, unmount } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Accordion } = await import('../accordion/accordion.svelte');
const { default: AccordionItem } = await import('./accordion-item.svelte');
const { default: accordionItemVariables } = await import('./accordion-item.variables.ts');

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
 * established before AccordionItem calls `getAccordionContext`.
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
  style?: string;
  expandedIds?: string[];
  multiple?: boolean;
  onExpandedChange?: (ids: string[]) => void;
}) {
  const {
    id,
    title,
    content = 'Panel content',
    disabled = false,
    style,
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
              ...(style ? { style } : {}),
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

test('throws if rendered outside an Accordion', () => {
  // No Accordion context set — the required context getter throws.
  expect(() => {
    render(AccordionItem, {
      props: {
        id: 'item-1',
        title: 'Test',
        children: createRawSnippet(() => ({
          render: () => '<span>content</span>',
          setup: () => {},
        })),
      },
    });
  }).toThrow(/missing_context/);
});

describe('AccordionItem', () => {
  test('header button has aria-expanded="false" and a stable panel reference when id is not in expandedIds', () => {
    const { container } = renderItem({
      id: 'item-a',
      title: 'Item A',
      expandedIds: [],
    });

    const button = container.querySelector('.cinder-accordion-item__trigger');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.getAttribute('aria-controls')).toBeTruthy();
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

  test('panel shell is hidden and content is absent when item is not expanded', () => {
    const { container } = renderItem({
      id: 'item-d',
      title: 'Item D',
      content: 'Should not appear',
      expandedIds: [],
    });

    expect(container.querySelector('.cinder-accordion-item__panel')?.hasAttribute('hidden')).toBe(
      true,
    );
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

  test('disabled item button does not have aria-disabled (native disabled is sufficient)', () => {
    const { container } = renderItem({
      id: 'item-g',
      title: 'Item G',
      disabled: true,
    });

    const button = container.querySelector('.cinder-accordion-item__trigger');
    // The native `disabled` attribute is authoritative for <button>. Adding aria-disabled
    // alongside it causes double-announcement in some screen readers.
    expect(button?.hasAttribute('aria-disabled')).toBe(false);
  });

  test('header button aria-controls points to the panel id', () => {
    const { container } = renderItem({
      id: 'my-item',
      title: 'My Item',
      expandedIds: ['my-item'],
    });

    const button = container.querySelector('.cinder-accordion-item__trigger');
    const panel = container.querySelector('.cinder-accordion-item__panel');

    expect(button?.getAttribute('aria-controls')).toBe(panel?.id);
    expect(panel?.id).toBeTruthy();
  });

  test('panel id matches the aria-controls reference on the header button', () => {
    const { container } = renderItem({
      id: 'linked-item',
      title: 'Linked Item',
      expandedIds: ['linked-item'],
    });

    const button = container.querySelector('.cinder-accordion-item__trigger');
    const panel = container.querySelector('.cinder-accordion-item__panel');

    // The panel does not carry role="region" or aria-labelledby — per WAI-ARIA APG,
    // role="region" on every accordion panel pollutes the landmark list. The panel id
    // is sufficient for the aria-controls reference on the trigger button.
    expect(button?.id).toBeTruthy();
    expect(panel?.id).toBeTruthy();
    expect(button?.getAttribute('aria-controls')).toBe(panel?.id);
    expect(panel?.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('duplicate item ids in separate accordions do not duplicate DOM ids', () => {
    const first = renderItem({
      id: 'shared-item',
      title: 'Shared item',
      expandedIds: ['shared-item'],
    });
    const second = renderItem({
      id: 'shared-item',
      title: 'Shared item',
      expandedIds: ['shared-item'],
    });

    const firstButton = first.container.querySelector('.cinder-accordion-item__trigger');
    const secondButton = second.container.querySelector('.cinder-accordion-item__trigger');
    const firstPanel = first.container.querySelector('.cinder-accordion-item__panel');
    const secondPanel = second.container.querySelector('.cinder-accordion-item__panel');

    expect(firstButton?.id).toBeTruthy();
    expect(secondButton?.id).toBeTruthy();
    expect(firstPanel?.id).toBeTruthy();
    expect(secondPanel?.id).toBeTruthy();
    expect(firstButton?.id).not.toBe(secondButton?.id);
    expect(firstPanel?.id).not.toBe(secondPanel?.id);
    expect(firstButton?.getAttribute('aria-controls')).toBe(firstPanel?.id);
    expect(secondButton?.getAttribute('aria-controls')).toBe(secondPanel?.id);
  });

  test('duplicate collapsed item ids still reference unique hidden panel shells', () => {
    const first = renderItem({
      id: 'shared-item',
      title: 'Shared item',
      expandedIds: [],
    });
    const second = renderItem({
      id: 'shared-item',
      title: 'Shared item',
      expandedIds: [],
    });

    const firstButton = first.container.querySelector('.cinder-accordion-item__trigger');
    const secondButton = second.container.querySelector('.cinder-accordion-item__trigger');
    const firstPanel = first.container.querySelector('.cinder-accordion-item__panel');
    const secondPanel = second.container.querySelector('.cinder-accordion-item__panel');

    expect(firstPanel?.hasAttribute('hidden')).toBe(true);
    expect(secondPanel?.hasAttribute('hidden')).toBe(true);
    expect(firstPanel?.id).not.toBe(secondPanel?.id);
    expect(firstButton?.getAttribute('aria-controls')).toBe(firstPanel?.id);
    expect(secondButton?.getAttribute('aria-controls')).toBe(secondPanel?.id);
  });

  test('title text is rendered inside the trigger button', () => {
    const { container } = renderItem({
      id: 'titled-item',
      title: 'Visible Title Text',
    });

    const button = container.querySelector('.cinder-accordion-item__trigger');
    expect(button?.textContent).toContain('Visible Title Text');
  });

  test('style prop is forwarded to the item root for public CSS variable hooks', () => {
    const { container } = renderItem({
      id: 'styled-item',
      title: 'Styled item',
      style: '--cinder-accordion-item-trigger-padding-block: var(--cinder-space-2);',
    });

    const item = container.querySelector('.cinder-accordion-item');
    expect(item?.getAttribute('style')).toContain('--cinder-accordion-item-trigger-padding-block');
  });

  // §Interactive a11y matrix — Enter/Space key events
  // NOTE: happy-dom does not synthesize a click event from keydown on <button>, so we
  // cannot assert that the expanded state changes here. Instead we verify that:
  //   1. The keydown event fires without throwing.
  //   2. The element has the correct role and ARIA attributes before the keydown —
  //      confirming the button is semantically correct so real browsers will handle it.

  test('Enter key on trigger button fires without error; button has correct role and aria', async () => {
    const { container } = renderItem({
      id: 'enter-item',
      title: 'Enter Item',
      expandedIds: [],
    });

    const button = container.querySelector('.cinder-accordion-item__trigger') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.getAttribute('role') ?? button.tagName.toLowerCase()).toMatch(/button/i);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    // Should not throw.
    await fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
  });

  test('Space key on trigger button fires without error; button has correct role and aria', async () => {
    const { container } = renderItem({
      id: 'space-item',
      title: 'Space Item',
      expandedIds: [],
    });

    const button = container.querySelector('.cinder-accordion-item__trigger') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.getAttribute('role') ?? button.tagName.toLowerCase()).toMatch(/button/i);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    // Should not throw.
    await fireEvent.keyDown(button, { key: ' ', code: 'Space' });
  });

  test('public CSS variables cover dense inspector trigger and panel subparts', async () => {
    expect(accordionItemVariables).toEqual([
      '--cinder-accordion-item-panel-font-size',
      '--cinder-accordion-item-panel-inner-padding-block-end',
      '--cinder-accordion-item-panel-inner-padding-block-start',
      '--cinder-accordion-item-panel-inner-padding-inline',
      '--cinder-accordion-item-panel-line-height',
      '--cinder-accordion-item-trigger-font-size',
      '--cinder-accordion-item-trigger-font-weight',
      '--cinder-accordion-item-trigger-gap',
      '--cinder-accordion-item-trigger-padding-block',
      '--cinder-accordion-item-trigger-padding-inline',
    ]);

    const css = await Bun.file(new URL('./accordion-item.css', import.meta.url)).text();
    expect(css).toContain('gap: var(--cinder-accordion-item-trigger-gap,');
    expect(css).toContain('var(--cinder-accordion-item-trigger-padding-block,');
    expect(css).toContain('font-size: var(--cinder-accordion-item-trigger-font-size,');
    expect(css).toContain('--cinder-accordion-item-panel-inner-padding-block-start,');
    expect(css).toContain('font-size: var(--cinder-accordion-item-panel-font-size,');
  });
});
