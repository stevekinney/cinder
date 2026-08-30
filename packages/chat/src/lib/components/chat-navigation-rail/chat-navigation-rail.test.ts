import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { clampNavigationIndex, navigationIndexFromPointer } from './chat-navigation-rail.ts';

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

  test('keeps the visual contracts in CSS and markup', async () => {
    const source = await readFile(
      new URL('./chat-navigation-rail.svelte', import.meta.url),
      'utf8',
    );
    const stylesheet = await readFile(
      new URL('./chat-navigation-rail.css', import.meta.url),
      'utf8',
    );
    expect(source).toContain('data-scrub-target');
    expect(source).toContain('aria-describedby');
    expect(source).toContain("aria-current={activeMessageId === message.id ? 'true' : undefined}");
    expect(source).toContain('instanceId}-${message.id}-navigation-preview');
    expect(source).toContain('suppressNextClick');
    expect(source).toContain('data-scrub-target={targetIndex === index ?');
    expect(stylesheet).toContain(':has(+ .chat-navigation-rail-row[data-scrub-target])');
    expect(stylesheet).toContain(':has(~ .chat-navigation-rail-row[data-scrub-target])');
    expect(stylesheet).toContain('prefers-reduced-motion');
    expect(source).toContain('setPointerCapture');
    expect(source).toContain('if (index >= 0) navigate(index)');
    expect(source).toContain('new MutationObserver(reconcile)');
    expect(source).toContain('observer.unobserve(row)');
    expect(source).toContain('[data-message-role="user"]');
    expect(source).toContain('const observedViewport = viewport');
    expect(stylesheet).toContain('position: fixed');
    expect(stylesheet).toContain('touch-action: pan-y');
    expect(source).toContain('previewPosition');
  });
});
