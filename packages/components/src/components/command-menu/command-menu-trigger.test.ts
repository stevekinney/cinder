import { describe, expect, test } from 'bun:test';

import { detectTrigger } from './command-menu-trigger.ts';

describe('detectTrigger', () => {
  test('detects a slash query after whitespace', () => {
    expect(detectTrigger({ text: 'Try /search', selectionStart: 11, selectionEnd: 11 })).toEqual({
      active: true,
      query: 'search',
      start: 4,
      end: 11,
    });
  });

  test('allows an empty query at the start of text', () => {
    expect(detectTrigger({ text: '/', selectionStart: 1, selectionEnd: 1 })).toEqual({
      active: true,
      query: '',
      start: 0,
      end: 1,
    });
  });

  test('does not detect the trigger when the caret is before it', () => {
    expect(detectTrigger({ text: '/', selectionStart: 0, selectionEnd: 0 })).toBeNull();
  });

  test('ignores paths and urls', () => {
    expect(detectTrigger({ text: 'foo/bar', selectionStart: 7, selectionEnd: 7 })).toBeNull();
    expect(detectTrigger({ text: 'http://x', selectionStart: 8, selectionEnd: 8 })).toBeNull();
  });

  test('closes when the query contains whitespace', () => {
    expect(detectTrigger({ text: '/search now', selectionStart: 11, selectionEnd: 11 })).toBeNull();
  });

  test('supports caret in the middle of a query', () => {
    expect(detectTrigger({ text: '/search', selectionStart: 4, selectionEnd: 4 })?.query).toBe(
      'sea',
    );
  });

  test('supports custom literal trigger characters', () => {
    expect(
      detectTrigger({ text: 'Use .help', selectionStart: 9, selectionEnd: 9, triggerChar: '.' }),
    ).toMatchObject({ query: 'help' });
  });

  test('rejects invalid trigger characters and non-collapsed selections', () => {
    expect(
      detectTrigger({ text: '/a', selectionStart: 2, selectionEnd: 2, triggerChar: '' }),
    ).toBeNull();
    expect(
      detectTrigger({ text: '/a', selectionStart: 2, selectionEnd: 2, triggerChar: '//' }),
    ).toBeNull();
    expect(
      detectTrigger({ text: '/a', selectionStart: 2, selectionEnd: 2, triggerChar: ' ' }),
    ).toBeNull();
    expect(detectTrigger({ text: '/a', selectionStart: 0, selectionEnd: 2 })).toBeNull();
  });
});
