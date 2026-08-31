import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
  clampNavigationIndex,
  navigationIndexFromPointer,
  navigationScrollFromPointer,
} from './chat-navigation-rail.ts';

describe('chat navigation rail mechanics', () => {
  test('clamps button navigation at both ends', () => {
    expect(clampNavigationIndex(-3, 4)).toBe(0);
    expect(clampNavigationIndex(99, 4)).toBe(3);
    expect(clampNavigationIndex(1.9, 4)).toBe(1);
    expect(clampNavigationIndex(0, 0)).toBe(-1);
  });

  test('maps pointer scrubbing to rows and clamps outside the rail', () => {
    const bounds = [
      { top: 10, bottom: 20 },
      { top: 20, bottom: 30 },
      { top: 30, bottom: 40 },
    ];
    expect(navigationIndexFromPointer(0, bounds)).toBe(0);
    expect(navigationIndexFromPointer(25, bounds)).toBe(1);
    expect(navigationIndexFromPointer(100, bounds)).toBe(2);
    expect(
      navigationIndexFromPointer(21, [
        { top: 0, bottom: 10 },
        { top: 30, bottom: 40 },
      ]),
    ).toBe(-1);
  });

  test('maps touch scrubbing across the full overflow range', () => {
    expect(navigationScrollFromPointer(0, 100, 200, 600)).toBe(0);
    expect(navigationScrollFromPointer(200, 100, 200, 600)).toBe(300);
    expect(navigationScrollFromPointer(400, 100, 200, 600)).toBe(600);
    expect(navigationScrollFromPointer(200, 100, 0, 600)).toBe(0);
  });

  test('keeps the visual contracts in CSS and markup', async () => {
    const source = await readFile(
      new URL('./chat-navigation-rail.svelte', import.meta.url),
      'utf8',
    );
    const stylesheet = await readFile(
      new URL('./chat-navigation-rail.css', import.meta.url),
      'utf8',
    );
    const example = await readFile(
      new URL(
        import.meta.dir.includes('/dist/')
          ? '../../../playground/src/examples/chat-navigation-rail/basic.example.svelte'
          : '../../../../../playground/src/examples/chat-navigation-rail/basic.example.svelte',
        import.meta.url,
      ),
      'utf8',
    );
    expect(source).toContain('data-scrub-target');
    expect(source).toContain('aria-describedby');
    expect(source).toContain('aria-describedby={`${instanceId}-${message.id}-navigation-preview`}');
    expect(source).toContain('updateFromPointer(event);');
    expect(source).toContain('navigationScrollFromPointer(');
    expect(source).toContain('rail.scrollHeight - rail.clientHeight');
    expect(source).toContain("aria-current={activeMessageId === message.id ? 'true' : undefined}");
    expect(source).toContain('instanceId}-${message.id}-navigation-preview');
    expect(source).toContain('suppressNextClick');
    expect(source).toContain('data-scrub-target={targetIndex === index ?');
    expect(stylesheet).toContain(':has(+ .chat-navigation-rail-row[data-scrub-target])');
    expect(stylesheet).toContain(':has(~ .chat-navigation-rail-row[data-scrub-target])');
    expect(stylesheet).toContain('prefers-reduced-motion');
    expect(source).toContain('setPointerCapture');
    expect(source).toContain('if (index >= 0 && index !== lastScrubIndex)');
    expect(source).toContain('new MutationObserver(reconcile)');
    expect(source).toContain('observer.unobserve(row)');
    expect(source).toContain('railMessageIds');
    expect(source).toContain("querySelectorAll<HTMLElement>('[data-message-id]')");
    expect(source).toContain("!row.closest('.chat-sub-session')");
    expect(source).toContain('visibleMessageIds.delete(removedId)');
    expect(source).toContain('!visibleMessageIds.has(activeMessageId)');
    expect(source).toContain('const visibleMessageIds = new Set<string>()');
    expect(source).not.toContain('new Set(activeIds)');
    expect(source).toContain('cinder-_floating-surface');
    expect(source).toContain('previewSide');
    expect(stylesheet).toContain('max-block-size: calc(100dvh - 1rem)');
    expect(source).toContain("querySelectorAll<HTMLElement>('[data-message-id]')");
    expect(source).toContain('const observedViewport = viewport');
    expect(stylesheet).toContain('position: fixed');
    expect(stylesheet).toContain('left: var(--chat-navigation-preview-left)');
    expect(stylesheet).not.toContain('inset-inline-start: var(--chat-navigation-preview-left)');
    expect(stylesheet).toContain('touch-action: none');
    expect(stylesheet).toContain('@layer cinder.components');
    expect(source).toContain('previewPosition');
    expect(source).toContain('lastScrubIndex');
    expect(source).toContain('index !== lastScrubIndex');
    expect(source).toContain('visualViewport?.width');
    expect(source).toContain('previewElement?.offsetWidth');
    expect(source).toContain('element.offsetHeight / 2');
    expect(source).toContain('visualViewport?.height');
    expect(source).toContain('setTimeout(() =>');
    expect(source).not.toContain('queueMicrotask(() =>');
    expect(source).toContain('bind:this={previewElement}');
    expect(source).toContain('onpointercancel={cancelScrub}');
    expect(source).toContain('suppressNextClick = false');
    expect(stylesheet.indexOf('.chat-navigation-rail-preview-left')).toBeGreaterThan(
      stylesheet.indexOf('@layer cinder.components'),
    );
    expect(stylesheet.lastIndexOf('}')).toBeGreaterThan(
      stylesheet.indexOf('.chat-navigation-rail-preview-left'),
    );
    expect(source).toContain('if (shouldNavigateTouch) updateFromPointer(event)');
    expect(source.indexOf('</nav>')).toBeLessThan(source.indexOf('chat-navigation-rail-preview'));
    expect(example).toContain('<ChatNavigationRail {messages} {scrollToMessage} {viewport} />');
    expect(example).toContain('scrollIntoView');
    expect(example).toContain('aria-label="Conversation transcript"');
    expect(example).toContain('tabindex="0"');
  });
});
