/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Card } = await import('./card.svelte');
const { default: RuntimeCard } = await import('./card-javascript-consumer.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

const emptySnippet = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

describe('Card interaction and props', () => {
  test('renders the whole card as a link when href is provided', () => {
    const { container } = render(Card, {
      props: { href: '/details', elevation: 'md', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-card');
    expect(root?.tagName).toBe('A');
    expect(root?.getAttribute('href')).toBe('/details');
    expect(root?.getAttribute('role')).toBeNull();
    const css = readFileSync(new URL('./card.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.cinder-card\[data-cinder-interactive\]\s*\{[^}]*display:\s*block/s);
    expect(css).toMatch(/\.cinder-card\[data-cinder-interactive\]\s*\{[^}]*text-align:\s*start/s);
    expect(root?.getAttribute('data-cinder-interactive')).toBe('');
    expect(root?.getAttribute('data-cinder-elevation')).toBe('md');
  });

  test('renders the whole card as a button when onclick is provided', () => {
    const { container } = render(Card, {
      props: { onclick: () => {}, title: 'Open details', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-card');
    const action = container.querySelector('.cinder-card__action');
    const heading = container.querySelector('.cinder-card__title');
    expect(root?.tagName).toBe('DIV');
    expect(action?.tagName).toBe('BUTTON');
    expect(action?.getAttribute('type')).toBe('button');
    expect(action?.getAttribute('aria-labelledby')).toBe(heading?.getAttribute('id'));
    expect(heading?.closest('button')).toBeNull();
    expect(root?.getAttribute('data-cinder-interactive')).toBe('');
  });

  test('suppresses interactive styling when a button card is disabled', () => {
    const { container } = render(Card, {
      props: { onclick: () => {}, disabled: true, title: 'Unavailable', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-card');
    const action = container.querySelector<HTMLButtonElement>('.cinder-card__action');

    expect(action?.disabled).toBe(true);
    expect(root?.getAttribute('data-cinder-disabled')).toBe('');
    expect(root?.getAttribute('data-cinder-interactive')).toBeNull();
  });

  test('danger tone is reflected on the container and adds a non-color title cue', () => {
    const { container, getByRole, getByText } = render(RuntimeCard, {
      props: {
        tone: 'danger',
        title: 'Pause reviews',
        description: 'Stops new review dispatch globally.',
        role: 'region',
        'aria-labelledby': 'consumer-heading',
        'aria-describedby': 'external-warning',
        children: textSnippet('Existing runs continue.'),
      },
    });

    const root = container.querySelector('.cinder-card');
    const heading = getByRole('heading', { name: 'Pause reviews' });
    const description = getByText('Stops new review dispatch globally.');

    expect(root?.getAttribute('data-cinder-tone')).toBe('danger');
    expect(root?.getAttribute('role')).toBe('region');
    expect(root?.getAttribute('aria-labelledby')).toBe('consumer-heading');
    expect(root?.getAttribute('aria-describedby')).toBe(
      `${description.getAttribute('id')} external-warning`,
    );
    expect(heading).not.toBeNull();
    expect(description).not.toBeNull();
    expect(root?.querySelector('.cinder-card__risk-icon')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  test('generated descriptions normalize caller aria-describedby tokens', () => {
    const { container, getByText } = render(RuntimeCard, {
      props: {
        title: 'Risk setting',
        description: 'Review this before continuing.',
        'aria-describedby': '  external-warning   external-warning  ',
        children: emptySnippet,
      },
    });

    const root = container.querySelector('.cinder-card');
    const description = getByText('Review this before continuing.');

    expect(root?.getAttribute('role')).toBe('group');
    expect(root?.getAttribute('aria-describedby')).toBe(
      `${description.getAttribute('id')} external-warning`,
    );
  });

  test('generated title preserves caller aria-label ownership', () => {
    const { container } = render(RuntimeCard, {
      props: {
        title: 'Visible card title',
        'aria-label': 'Custom region name',
        children: emptySnippet,
      },
    });

    const root = container.querySelector('.cinder-card');

    expect(root?.getAttribute('aria-label')).toBe('Custom region name');
    expect(root?.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('danger tone preserves custom header ownership', () => {
    const { container } = render(RuntimeCard, {
      props: {
        tone: 'danger',
        title: 'Generated title should not render',
        description: 'Generated description should not render.',
        header: textSnippet('custom-danger-header'),
        role: 'region',
        children: emptySnippet,
      },
    });

    const root = container.querySelector('.cinder-card');
    expect(root?.getAttribute('data-cinder-tone')).toBe('danger');
    expect(root?.getAttribute('role')).toBe('region');
    expect(root?.hasAttribute('aria-labelledby')).toBe(false);
    expect(root?.hasAttribute('aria-describedby')).toBe(false);
    expect(container.querySelector('.cinder-card__risk-icon')).toBeNull();
    expect(container.querySelector('.cinder-card__title')).toBeNull();
    expect(container.querySelector('.cinder-card__header')?.textContent).toContain(
      'custom-danger-header',
    );
  });

  test('bodyTone and footerTone props are reflected on their regions', () => {
    const { container } = render(Card, {
      props: {
        children: emptySnippet,
        bodyTone: 'muted',
        footerTone: 'muted',
        footer: textSnippet('footer-content'),
      },
    });

    expect(container.querySelector('.cinder-card__body')?.getAttribute('data-cinder-tone')).toBe(
      'muted',
    );
    expect(container.querySelector('.cinder-card__footer')?.getAttribute('data-cinder-tone')).toBe(
      'muted',
    );
  });

  test('edgeToEdgeOnMobile prop is reflected only when enabled', () => {
    const { container } = render(Card, {
      props: {
        children: emptySnippet,
        edgeToEdgeOnMobile: true,
      },
    });
    expect(
      container.querySelector('.cinder-card')?.hasAttribute('data-cinder-edge-to-edge-mobile'),
    ).toBe(true);
  });

  test('padding state remains exposed on the root while styling is scoped to the body', () => {
    const { container } = render(Card, {
      props: {
        title: 'Flush body',
        children: emptySnippet,
        footer: textSnippet('footer-content'),
        padding: 'none',
      },
    });

    expect(container.querySelector('.cinder-card')?.getAttribute('data-cinder-padding')).toBe(
      'none',
    );
    expect(container.querySelector('.cinder-card__header')).not.toBeNull();
    expect(container.querySelector('.cinder-card__body')?.getAttribute('data-cinder-padding')).toBe(
      'none',
    );
    expect(container.querySelector('.cinder-card__footer')).not.toBeNull();
  });

  test('headingLevel=0 clamps to the minimum and renders h1', () => {
    const { container } = render(RuntimeCard, {
      props: {
        title: 'Clamped low',
        headingLevel: 0,
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-card__title')?.tagName).toBe('H1');
  });

  test('headingLevel=9 clamps to the maximum and renders h6', () => {
    const { container } = render(RuntimeCard, {
      props: {
        title: 'Clamped high',
        headingLevel: 9,
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-card__title')?.tagName).toBe('H6');
  });

  test('headingLevel=NaN falls back to the h3 default', () => {
    const { container } = render(RuntimeCard, {
      props: {
        title: 'Non-numeric fallback',
        headingLevel: NaN,
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-card__title')?.tagName).toBe('H3');
  });

  test('padding defaults to "default" when not provided', () => {
    const { container } = render(Card, {
      props: {
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-card__body')?.getAttribute('data-cinder-padding')).toBe(
      'default',
    );
    expect(container.querySelector('.cinder-card')?.getAttribute('data-cinder-padding')).toBe(
      'default',
    );
  });
});
