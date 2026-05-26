/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { getCaretRect } from './caret-rect.svelte.ts';

setupHappyDom();

afterEach(() => {
  document.body.innerHTML = '';
});

function createTextarea(value = 'hello') {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  Object.defineProperty(textarea, 'getBoundingClientRect', {
    value: () => new DOMRect(20, 30, 200, 100),
    configurable: true,
  });
  document.body.append(textarea);
  return textarea;
}

describe('getCaretRect', () => {
  test('returns null for a detached field', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'hello';
    expect(getCaretRect(textarea, 3)).toBeNull();
  });

  test('builds and removes a mirror element', () => {
    const textarea = createTextarea('/alpha');
    const rect = getCaretRect(textarea, 3);
    expect(rect).not.toBeNull();
    expect(rect?.width).toBeGreaterThan(0);
    expect(document.querySelector('[data-cinder-command-menu-caret-mirror]')).toBeNull();
  });

  test('clamps the caret index to the field value', () => {
    const textarea = createTextarea('/alpha');
    expect(getCaretRect(textarea, 100)).not.toBeNull();
    expect(getCaretRect(textarea, -1)).not.toBeNull();
  });

  test('mirrors textarea scroll offsets instead of subtracting them twice', () => {
    const textarea = createTextarea('line 1\nline 2\nline 3');
    textarea.scrollTop = 40;
    textarea.scrollLeft = 8;
    let mirror: HTMLDivElement | undefined;
    const originalAppend = document.body.append.bind(document.body);
    const appendSpy = mock((node: Node) => {
      if (node instanceof HTMLDivElement) mirror = node;
      originalAppend(node);
    });
    const originalMarkerRect = HTMLSpanElement.prototype.getBoundingClientRect;
    HTMLSpanElement.prototype.getBoundingClientRect = () => new DOMRect(120, 160, 0, 18);
    document.body.append = appendSpy;

    try {
      const rect = getCaretRect(textarea, textarea.value.length);
      if (!mirror) throw new Error('Expected caret mirror to be captured.');
      expect(mirror.scrollTop).toBe(40);
      expect(mirror.scrollLeft).toBe(8);
      expect(rect?.left).toBe(120);
      expect(rect?.top).toBe(160);
    } finally {
      document.body.append = originalAppend;
      HTMLSpanElement.prototype.getBoundingClientRect = originalMarkerRect;
    }
  });

  test('mirrors border styles so copied border widths affect wrapping', () => {
    const textarea = createTextarea('/alpha beta gamma');
    textarea.style.boxSizing = 'border-box';
    textarea.style.borderStyle = 'solid';
    textarea.style.borderWidth = '12px';
    let mirror: HTMLDivElement | undefined;
    const originalAppend = document.body.append.bind(document.body);
    const appendSpy = mock((node: Node) => {
      if (node instanceof HTMLDivElement) mirror = node;
      originalAppend(node);
    });
    document.body.append = appendSpy;

    try {
      getCaretRect(textarea, textarea.value.length);
      if (!mirror) throw new Error('Expected caret mirror to be captured.');
      expect(mirror.style.getPropertyValue('border-top-style')).toBe('solid');
      expect(mirror.style.getPropertyValue('border-left-style')).toBe('solid');
      expect(mirror.style.getPropertyValue('border-top-width')).toBe('12px');
      expect(mirror.style.getPropertyValue('border-left-width')).toBe('12px');
    } finally {
      document.body.append = originalAppend;
    }
  });
});
