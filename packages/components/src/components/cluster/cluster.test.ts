/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Cluster } = await import('./cluster.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Cluster', () => {
  test('renders a div by default with the cinder-cluster class', () => {
    const { container } = render(Cluster, { children: textSnippet('item') });
    const root = container.querySelector('.cinder-cluster');
    expect(root).not.toBeNull();
    expect(root?.tagName).toBe('DIV');
  });

  test('honors the `as` prop for the rendered element', () => {
    const { container } = render(Cluster, {
      children: textSnippet('item'),
      as: 'ul',
    });
    expect(container.querySelector('ul.cinder-cluster')).not.toBeNull();
  });

  test('merges the class prop alongside cinder-cluster', () => {
    const { container } = render(Cluster, {
      children: textSnippet('item'),
      class: 'my-cluster',
    });
    const root = container.querySelector('.cinder-cluster');
    expect(root?.getAttribute('class')).toContain('cinder-cluster');
    expect(root?.getAttribute('class')).toContain('my-cluster');
  });

  test('forwards rest attributes (data-testid) to the root element', () => {
    const { container } = render(Cluster, {
      children: textSnippet('item'),
      'data-testid': 'my-cluster',
    });
    const root = container.querySelector('.cinder-cluster') as HTMLElement;
    expect(root.getAttribute('data-testid')).toBe('my-cluster');
  });

  test('does not emit custom properties when props are undefined', () => {
    const { container } = render(Cluster, { children: textSnippet('item') });
    const root = container.querySelector('.cinder-cluster') as HTMLElement;
    expect(root.style.getPropertyValue('--cluster-gap')).toBe('');
    expect(root.style.getPropertyValue('--cluster-align')).toBe('');
    expect(root.style.getPropertyValue('--cluster-justify')).toBe('');
  });

  test('threads gap into --cluster-gap when provided', () => {
    const { container } = render(Cluster, {
      children: textSnippet('item'),
      gap: '0.75rem',
    });
    const root = container.querySelector('.cinder-cluster') as HTMLElement;
    expect(root.style.getPropertyValue('--cluster-gap')).toBe('0.75rem');
  });

  test('threads align into --cluster-align when provided', () => {
    const { container } = render(Cluster, {
      children: textSnippet('item'),
      align: 'baseline',
    });
    const root = container.querySelector('.cinder-cluster') as HTMLElement;
    expect(root.style.getPropertyValue('--cluster-align')).toBe('baseline');
  });

  test('threads justify into --cluster-justify when provided', () => {
    const { container } = render(Cluster, {
      children: textSnippet('item'),
      justify: 'space-between',
    });
    const root = container.querySelector('.cinder-cluster') as HTMLElement;
    expect(root.style.getPropertyValue('--cluster-justify')).toBe('space-between');
  });

  test('renders children content', () => {
    const { container } = render(Cluster, { children: textSnippet('hello cluster') });
    expect(container.querySelector('.cinder-cluster')?.textContent).toContain('hello cluster');
  });
});
