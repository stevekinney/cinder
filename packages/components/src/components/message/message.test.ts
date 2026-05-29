/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: Message } = await import('./message.svelte');

function snippet(html: string) {
  return createRawSnippet(() => ({ render: () => `<span>${html}</span>` }));
}

describe('Message', () => {
  test('renders an article with the role data attribute', () => {
    const { container } = render(Message, {
      role: 'assistant',
      children: snippet('Hello'),
    });
    const article = container.querySelector('article.cinder-message');
    expect(article).not.toBeNull();
    expect(article?.getAttribute('data-cinder-role')).toBe('assistant');
  });

  test('default name comes from the role', () => {
    const { container } = render(Message, { role: 'user', children: snippet('hi') });
    expect(container.querySelector('.cinder-message__name')?.textContent?.trim()).toBe('You');
  });

  test('custom name overrides the default', () => {
    const { container } = render(Message, {
      role: 'assistant',
      name: 'Aria',
      children: snippet('hi'),
    });
    expect(container.querySelector('.cinder-message__name')?.textContent?.trim()).toBe('Aria');
  });

  test('time renders inside a <time> with datetime', () => {
    const { container } = render(Message, {
      role: 'system',
      time: '2026-04-29T10:00',
      children: snippet('event'),
    });
    const time = container.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-04-29T10:00');
    expect(time?.textContent?.trim()).toBe('2026-04-29T10:00');
  });
});
