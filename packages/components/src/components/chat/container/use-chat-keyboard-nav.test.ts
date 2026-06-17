import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../../../test/happy-dom.ts';
import { useChatKeyboardNav } from './use-chat-keyboard-nav.svelte.ts';

setupHappyDom();

afterEach(() => {
  document.body.replaceChildren();
});

function keyEvent(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
}

function createViewport(): {
  messages: HTMLElement[];
  scrollByCalls: ScrollToOptions[];
  scrollIntoViewCalls: string[];
  scrollToCalls: ScrollToOptions[];
  viewport: HTMLElement;
} {
  const viewport = document.createElement('div');
  const scrollByCalls: ScrollToOptions[] = [];
  const scrollToCalls: ScrollToOptions[] = [];
  const scrollIntoViewCalls: string[] = [];

  Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 200 });
  viewport.scrollBy = ((options?: ScrollToOptions) => {
    scrollByCalls.push(options ?? {});
  }) as HTMLElement['scrollBy'];
  viewport.scrollTo = ((options?: ScrollToOptions) => {
    scrollToCalls.push(options ?? {});
  }) as HTMLElement['scrollTo'];

  const messages = ['first', 'second', 'third'].map((id) => {
    const element = document.createElement('article');
    element.id = id;
    element.className = 'chat-message';
    element.tabIndex = -1;
    element.scrollIntoView = (() => {
      scrollIntoViewCalls.push(id);
    }) as HTMLElement['scrollIntoView'];
    viewport.append(element);
    return element;
  });

  document.body.append(viewport);

  return { messages, scrollByCalls, scrollIntoViewCalls, scrollToCalls, viewport };
}

describe('useChatKeyboardNav', () => {
  test('End and Page keys route to latest and viewport scrolling', () => {
    const { scrollByCalls, viewport } = createViewport();
    let jumpCount = 0;
    const nav = useChatKeyboardNav({
      onJumpToLatest: () => {
        jumpCount += 1;
      },
      getScrollBehavior: () => 'smooth',
    });

    const end = keyEvent('End');
    nav.handleKeyDown(end, viewport);
    expect(end.defaultPrevented).toBe(true);
    expect(jumpCount).toBe(1);

    const pageDown = keyEvent('PageDown');
    nav.handleKeyDown(pageDown, viewport);
    const pageUp = keyEvent('PageUp');
    nav.handleKeyDown(pageUp, viewport);

    expect(scrollByCalls).toEqual([
      { top: 180, behavior: 'smooth' },
      { top: -180, behavior: 'smooth' },
    ]);
  });

  test('Home uses virtualized top callback and focuses the history trigger first', async () => {
    const { scrollToCalls, viewport } = createViewport();
    let jumpToStartCount = 0;
    let triggerFocusCount = 0;
    const nav = useChatKeyboardNav({
      onJumpToLatest: () => {},
      onJumpToStart: () => {
        jumpToStartCount += 1;
      },
      getScrollBehavior: () => 'auto',
      getHistoryTrigger: () => ({
        focus: () => {
          triggerFocusCount += 1;
        },
      }),
    });

    const home = keyEvent('Home');
    nav.handleKeyDown(home, viewport);
    await tick();

    expect(home.defaultPrevented).toBe(true);
    expect(jumpToStartCount).toBe(1);
    expect(triggerFocusCount).toBe(1);
    expect(scrollToCalls).toEqual([]);
  });

  test('Home falls back to scrolling and focusing the first rendered message', async () => {
    const { messages, scrollIntoViewCalls, scrollToCalls, viewport } = createViewport();
    const nav = useChatKeyboardNav({
      onJumpToLatest: () => {},
      getScrollBehavior: () => 'auto',
    });

    nav.handleKeyDown(keyEvent('Home'), viewport);
    await tick();

    expect(scrollToCalls).toEqual([{ top: 0, behavior: 'auto' }]);
    expect(document.activeElement).toBe(messages[0]!);
    expect(scrollIntoViewCalls).toEqual([]);
  });

  test('Arrow keys move focus between rendered messages', () => {
    const { messages, scrollIntoViewCalls, viewport } = createViewport();
    const nav = useChatKeyboardNav({
      onJumpToLatest: () => {},
      getScrollBehavior: () => 'auto',
    });

    messages[1]!.focus();
    const down = keyEvent('ArrowDown');
    nav.handleKeyDown(down, viewport);
    expect(down.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(messages[2]!);

    const up = keyEvent('ArrowUp');
    nav.handleKeyDown(up, viewport);
    expect(up.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(messages[1]!);
    expect(scrollIntoViewCalls).toEqual(['third', 'second']);
  });

  test('text editing targets keep native keyboard behavior', () => {
    const { viewport } = createViewport();
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    let jumpCount = 0;
    const nav = useChatKeyboardNav({
      onJumpToLatest: () => {
        jumpCount += 1;
      },
      getScrollBehavior: () => 'auto',
    });

    const event = keyEvent('End');
    nav.handleKeyDown(event, viewport);

    expect(event.defaultPrevented).toBe(false);
    expect(jumpCount).toBe(0);
  });
});
