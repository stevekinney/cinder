/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: JsonViewer } = await import('./json-viewer.svelte');

describe('JsonViewer', () => {
  test('renders a primitive value', () => {
    const { container } = render(JsonViewer, { value: 'hello' });
    expect(container.querySelector('.cinder-json-viewer__value')?.textContent?.trim()).toContain(
      'hello',
    );
  });

  test('renders an object with key labels', () => {
    const { container } = render(JsonViewer, { value: { name: 'Alice', age: 30 } });
    const keys = Array.from(container.querySelectorAll('.cinder-json-viewer__key'));
    const labels = keys.map((k) => k.textContent?.trim());
    expect(labels).toContain('name:');
    expect(labels).toContain('age:');
  });

  test('renders an array with index labels', () => {
    const { container } = render(JsonViewer, { value: [10, 20, 30] });
    const keys = Array.from(container.querySelectorAll('.cinder-json-viewer__key'));
    const labels = keys.map((k) => k.textContent?.trim());
    expect(labels).toEqual(['0:', '1:', '2:']);
  });

  test('shows the too-large fallback above maxBytes', () => {
    const big = 'x'.repeat(2000);
    const { container } = render(JsonViewer, { value: big, maxBytes: 100 });
    expect(container.querySelector('.cinder-json-viewer__fallback')).not.toBeNull();
  });

  test('renders the too-deep marker beyond maxDepth', () => {
    const deep: Record<string, unknown> = {};
    let cursor: Record<string, unknown> = deep;
    for (let i = 0; i < 6; i++) {
      const next: Record<string, unknown> = {};
      cursor['nested'] = next;
      cursor = next;
    }
    const { container } = render(JsonViewer, { value: deep, maxDepth: 3, initialDepth: 999 });
    expect(container.querySelector('.cinder-json-viewer__too-deep')).not.toBeNull();
  });
});
