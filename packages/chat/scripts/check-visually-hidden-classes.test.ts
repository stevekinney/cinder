import { describe, expect, test } from 'bun:test';

import { scan, scanSource } from './check-visually-hidden-classes.ts';

describe('scanSource — bare `sr-only` detection', () => {
  test('flags a bare sr-only class applied in markup (double quotes)', () => {
    expect(scanSource('<span class="sr-only">hi</span>')).toHaveLength(1);
  });

  test('flags a bare sr-only class applied in markup (single quotes)', () => {
    expect(scanSource(`<span class='sr-only'>hi</span>`)).toHaveLength(1);
  });

  test('flags a bare sr-only class combined with other classes', () => {
    expect(scanSource('<span class="foo sr-only bar">hi</span>')).toHaveLength(1);
  });

  test('flags a bare .sr-only CSS class selector', () => {
    expect(scanSource('.sr-only {\n  position: absolute;\n}')).toHaveLength(1);
  });

  test('flags a bare .sr-only selector scoped under a parent', () => {
    expect(
      scanSource('.cinder-chat-conversation-list .sr-only {\n  clip: rect(0,0,0,0);\n}'),
    ).toHaveLength(1);
  });

  test('flags a bare .sr-only selector chained with a pseudo-class', () => {
    expect(scanSource('.sr-only:focus {\n  clip: auto;\n}')).toHaveLength(1);
  });

  test('reports the correct 1-based line number', () => {
    const source = 'line one\nline two\n<span class="sr-only">three</span>\nline four';
    const hits = scanSource(source);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.lineNumber).toBe(3);
  });

  test('does NOT flag the correct cinder-sr-only class', () => {
    expect(scanSource('<span class="cinder-sr-only">hi</span>')).toHaveLength(0);
    expect(scanSource('.cinder-sr-only {\n  position: absolute;\n}')).toHaveLength(0);
  });

  test('does NOT flag the focusable variant', () => {
    expect(scanSource('<span class="cinder-sr-only-focusable">hi</span>')).toHaveLength(0);
    expect(
      scanSource('.cinder-sr-only-focusable:focus-visible {\n  position: fixed;\n}'),
    ).toHaveLength(0);
  });

  test('does NOT flag prose that merely mentions sr-only outside class/selector syntax', () => {
    expect(scanSource('// previously used the bare sr-only class name')).toHaveLength(0);
    expect(scanSource("classList.contains('sr-only')")).toHaveLength(0);
  });

  test('does NOT flag an element with no sr-only anywhere', () => {
    expect(scanSource('<span class="cinder-icon-sm">hi</span>')).toHaveLength(0);
  });
});

describe('scan — live packages/chat source tree', () => {
  test('finds zero bare sr-only usage sites in src/lib (CIN-505 regression guard)', async () => {
    const flags = await scan();
    expect(flags).toEqual([]);
  });
});
