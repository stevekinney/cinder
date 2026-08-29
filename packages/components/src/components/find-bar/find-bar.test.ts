/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';
setupHappyDom();
const { render } = await import('@testing-library/svelte');
const { default: FindBar } = await import('./find-bar.svelte');
describe('FindBar', () => {
  test('renders accessible controls', () => {
    const { container } = render(FindBar, { id: 'find' });
    expect(container.querySelector('input')).not.toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Previous match"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Next match"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Close find bar"]')).not.toBeNull();
  });
});
