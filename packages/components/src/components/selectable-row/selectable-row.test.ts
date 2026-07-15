/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: SelectableRow } = await import('./selectable-row.svelte');
const { default: SelectableRowFixture } = await import('./selectable-row.fixture.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

describe('SelectableRow', () => {
  test('renders a native primary button and sibling trailing actions without nested controls', () => {
    const onPrimary = mock();
    const onRename = mock();
    const onOpenExternal = mock();
    const { container } = render(SelectableRowFixture, {
      props: { onPrimary, onRename, onOpenExternal },
    });

    const root = container.querySelector('.cinder-selectable-row');
    const primary = root?.querySelector('.cinder-selectable-row__primary');
    const trailing = root?.querySelector('.cinder-selectable-row__trailing-actions');

    expect(root?.tagName).toBe('DIV');
    expect(primary?.parentElement === root).toBe(true);
    expect(trailing?.parentElement === root).toBe(true);
    expect(primary?.tagName).toBe('BUTTON');
    expect(primary?.getAttribute('type')).toBe('button');
    expect(trailing?.querySelectorAll('button, a')).toHaveLength(2);
    expect(primary?.querySelector('button, a, input, select, textarea')).toBeNull();
    expect(primary?.textContent).toContain('A deliberately long session title');
    expect(primary?.textContent).toContain('Running · Updated now');
  });

  test('pointer activation remains isolated between the primary and trailing actions', async () => {
    const onPrimary = mock();
    const onRename = mock();
    const onOpenExternal = mock((event: MouseEvent) => event.preventDefault());
    const { getByRole } = render(SelectableRowFixture, {
      props: { onPrimary, onRename, onOpenExternal },
    });

    await fireEvent.click(getByRole('button', { name: /deliberately long session title/i }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onRename).not.toHaveBeenCalled();

    await fireEvent.click(getByRole('button', { name: 'Rename' }));
    await fireEvent.click(getByRole('link', { name: 'Open externally' }));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onOpenExternal).toHaveBeenCalledTimes(1);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  test('renders a native link primary action with current state and secure external-link rel', () => {
    const { container } = render(SelectableRow, {
      props: {
        href: '/sessions/42',
        target: '_blank',
        rel: 'nofollow',
        selected: true,
        currentValue: 'page',
        title: textSnippet('Session 42'),
      },
    });

    const primary = container.querySelector('.cinder-selectable-row__primary');
    expect(primary?.tagName).toBe('A');
    expect(primary?.getAttribute('href')).toBe('/sessions/42');
    expect(primary?.getAttribute('aria-current')).toBe('page');
    expect(primary?.getAttribute('aria-pressed')).toBeNull();
    const relTokens = primary?.getAttribute('rel')?.split(' ');
    relTokens?.sort();
    expect(relTokens).toEqual(['nofollow', 'noopener', 'noreferrer']);
  });

  test('de-duplicates rel tokens case-insensitively while preserving first-seen casing', () => {
    const { container } = render(SelectableRow, {
      props: {
        href: '/sessions/42',
        target: '_BLANK',
        rel: 'NoOpener noopener sponsored',
        title: textSnippet('Session 42'),
      },
    });

    expect(container.querySelector('a')?.getAttribute('rel')).toBe('NoOpener sponsored noreferrer');
  });

  test('maps button selection to aria-pressed and forwards native attributes', () => {
    const { container } = render(SelectableRow, {
      props: {
        onclick: () => {},
        selected: true,
        disabled: true,
        name: 'session',
        title: textSnippet('Selected session'),
      },
    });

    const primary = container.querySelector('.cinder-selectable-row__primary');
    expect(primary?.getAttribute('aria-pressed')).toBe('true');
    expect(primary?.getAttribute('name')).toBe('session');
    expect(primary?.hasAttribute('disabled')).toBe(true);
    expect(
      container.querySelector('.cinder-selectable-row')?.getAttribute('data-cinder-selected'),
    ).toBe('');
  });

  test('supports a native submit button without an onclick handler', () => {
    const { container } = render(SelectableRow, {
      props: {
        type: 'submit',
        title: textSnippet('Submit session'),
      },
    });

    const primary = container.querySelector('.cinder-selectable-row__primary');
    expect(primary?.tagName).toBe('BUTTON');
    expect(primary?.getAttribute('type')).toBe('submit');
  });
});
