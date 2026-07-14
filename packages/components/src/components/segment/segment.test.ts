/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render, screen } = await import('@testing-library/svelte');
const { default: Fixture } = await import('../../test/fixtures/segmented-control-fixture.svelte');

afterEach(() => cleanup());

const options = [
  { value: 'source', label: 'Source' },
  { value: 'rendered', label: 'Rendered' },
  { value: 'diff', label: 'Diff', disabled: true },
];

function renderControl(value: string) {
  return render(Fixture, {
    props: { id: 'view', value, label: 'View', options },
  });
}

describe('Segment', () => {
  test('renders each segment as a button with role="radio" in single mode', () => {
    const { container } = renderControl('source');
    const segments = container.querySelectorAll('[role="radio"]');
    expect(segments).toHaveLength(3);
    expect(segments[0]?.tagName.toLowerCase()).toBe('button');
  });

  test('aria-checked reflects the selected value', () => {
    renderControl('source');
    expect(screen.getByRole('radio', { name: 'Source' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Rendered' }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  test('a disabled option surfaces aria-disabled', () => {
    renderControl('source');
    expect(screen.getByRole('radio', { name: 'Diff' }).getAttribute('aria-disabled')).toBe('true');
  });

  test('renders as an anchor with aria-current in navigation variant', () => {
    render(Fixture, {
      props: {
        id: 'source-filter',
        label: 'Source filter',
        variant: 'navigation',
        options: [
          { value: 'all', label: 'All', href: '/costs', current: true },
          { value: 'compute', label: 'Compute', href: '/costs?source=compute' },
        ],
      },
    });

    const current = screen.getByRole('link', { name: 'All' });
    expect(current.tagName.toLowerCase()).toBe('a');
    expect(current.getAttribute('href')).toBe('/costs');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.getAttribute('data-cinder-current')).toBe('');
    expect(current.getAttribute('role')).toBeNull();
  });

  test('disabled navigation anchors strip href and block consumer clicks', async () => {
    const clicks: MouseEvent[] = [];
    render(Fixture, {
      props: {
        id: 'source-filter',
        label: 'Source filter',
        variant: 'navigation',
        options: [
          {
            value: 'all',
            label: 'All',
            href: '/costs',
            disabled: true,
            onclick: (event: MouseEvent) => clicks.push(event),
          },
        ],
      },
    });

    const disabled = screen.getByText('All').closest('a');
    expect(disabled).not.toBeNull();
    expect(disabled?.getAttribute('href')).toBeNull();
    expect(disabled?.getAttribute('aria-disabled')).toBe('true');

    disabled?.click();
    expect(clicks).toHaveLength(0);
  });
});
