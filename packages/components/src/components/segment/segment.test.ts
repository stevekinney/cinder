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
});
