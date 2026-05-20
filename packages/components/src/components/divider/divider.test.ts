/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Divider } = await import('./divider.svelte');

afterEach(() => {
  cleanup();
});

describe('Divider — decorative × orientation semantics', () => {
  test('decorative horizontal renders a <div>', () => {
    const { container } = render(Divider);
    expect(container.querySelector('div.cinder-divider')).not.toBeNull();
  });

  test('decorative horizontal carries aria-hidden="true"', () => {
    const { container } = render(Divider);
    const el = container.querySelector('.cinder-divider');
    expect(el?.getAttribute('aria-hidden')).toBe('true');
  });

  test('decorative vertical renders a <span>', () => {
    const { container } = render(Divider, { orientation: 'vertical' });
    expect(container.querySelector('span.cinder-divider')).not.toBeNull();
  });

  test('decorative vertical carries aria-hidden="true"', () => {
    const { container } = render(Divider, { orientation: 'vertical' });
    const el = container.querySelector('.cinder-divider');
    expect(el?.getAttribute('aria-hidden')).toBe('true');
  });

  test('non-decorative horizontal renders an <hr>', () => {
    const { container } = render(Divider, { decorative: false });
    expect(container.querySelector('hr.cinder-divider')).not.toBeNull();
  });

  test('non-decorative horizontal does not carry aria-hidden', () => {
    const { container } = render(Divider, { decorative: false });
    const el = container.querySelector('.cinder-divider');
    expect(el?.hasAttribute('aria-hidden')).toBe(false);
  });

  test('non-decorative vertical renders a <span> with role="separator"', () => {
    const { container } = render(Divider, { decorative: false, orientation: 'vertical' });
    const el = container.querySelector('span.cinder-divider');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('role')).toBe('separator');
  });

  test('non-decorative vertical carries aria-orientation="vertical"', () => {
    const { container } = render(Divider, { decorative: false, orientation: 'vertical' });
    const el = container.querySelector('.cinder-divider');
    expect(el?.getAttribute('aria-orientation')).toBe('vertical');
  });

  test('non-decorative vertical does not carry aria-hidden', () => {
    const { container } = render(Divider, { decorative: false, orientation: 'vertical' });
    const el = container.querySelector('.cinder-divider');
    expect(el?.hasAttribute('aria-hidden')).toBe(false);
  });
});

describe('Divider — data attributes for variant styling', () => {
  test('orientation is reflected as data-cinder-orientation', () => {
    const { container } = render(Divider, { orientation: 'vertical' });
    const el = container.querySelector('.cinder-divider');
    expect(el?.getAttribute('data-cinder-orientation')).toBe('vertical');
  });

  test('default orientation is "horizontal"', () => {
    const { container } = render(Divider);
    const el = container.querySelector('.cinder-divider');
    expect(el?.getAttribute('data-cinder-orientation')).toBe('horizontal');
  });

  test('tone="strong" applies data-cinder-tone="strong"', () => {
    const { container } = render(Divider, { tone: 'strong' });
    const el = container.querySelector('.cinder-divider');
    expect(el?.getAttribute('data-cinder-tone')).toBe('strong');
  });

  test('default tone is "subtle"', () => {
    const { container } = render(Divider);
    const el = container.querySelector('.cinder-divider');
    expect(el?.getAttribute('data-cinder-tone')).toBe('subtle');
  });

  test('inset=true applies data-cinder-inset attribute', () => {
    const { container } = render(Divider, { inset: true });
    const el = container.querySelector('.cinder-divider');
    expect(el?.hasAttribute('data-cinder-inset')).toBe(true);
  });

  test('inset=false omits data-cinder-inset attribute', () => {
    const { container } = render(Divider, { inset: false });
    const el = container.querySelector('.cinder-divider');
    expect(el?.hasAttribute('data-cinder-inset')).toBe(false);
  });
});

describe('Divider — class forwarding and rest props', () => {
  test('class prop is merged with cinder-divider', () => {
    const { container } = render(Divider, { class: 'my-separator' });
    const el = container.querySelector('.cinder-divider');
    expect(el?.classList.contains('my-separator')).toBe(true);
    expect(el?.classList.contains('cinder-divider')).toBe(true);
  });

  test('rest props are spread onto the element (data-testid)', () => {
    const { container } = render(Divider, { 'data-testid': 'sep' });
    expect(container.querySelector('[data-testid="sep"]')).not.toBeNull();
  });
});
