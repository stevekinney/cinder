/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Spacer } = await import('./spacer.svelte');

describe('Spacer', () => {
  test('renders a span by default with the cinder-spacer class', () => {
    const { container } = render(Spacer);
    const root = container.querySelector('.cinder-spacer');
    expect(root).not.toBeNull();
    expect(root?.tagName).toBe('SPAN');
  });

  test('honors the `as` prop for the rendered element', () => {
    const { container } = render(Spacer, { as: 'div' });
    expect(container.querySelector('div.cinder-spacer')).not.toBeNull();
  });

  test('merges the class prop alongside cinder-spacer', () => {
    const { container } = render(Spacer, { class: 'my-spacer' });
    const root = container.querySelector('.cinder-spacer');
    expect(root?.getAttribute('class')).toContain('cinder-spacer');
    expect(root?.getAttribute('class')).toContain('my-spacer');
  });

  test('forwards rest attributes (data-testid) to the root element', () => {
    const { container } = render(Spacer, { 'data-testid': 'my-spacer' });
    const root = container.querySelector('.cinder-spacer') as HTMLElement;
    expect(root.getAttribute('data-testid')).toBe('my-spacer');
  });

  test('carries aria-hidden="true"', () => {
    const { container } = render(Spacer);
    const root = container.querySelector('.cinder-spacer') as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
  });

  test('renders no children', () => {
    const { container } = render(Spacer);
    const root = container.querySelector('.cinder-spacer') as HTMLElement;
    expect(root.children.length).toBe(0);
    expect(root.textContent).toBe('');
  });

  test('aria-hidden cannot be overridden by a consumer prop', () => {
    const { container } = render(Spacer, { 'aria-hidden': 'false' });
    const root = container.querySelector('.cinder-spacer') as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
  });
});
