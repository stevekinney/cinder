import { describe, expect, test } from 'bun:test';

import {
  extractClassNamesCallArguments,
  scan,
  scanSource,
} from './check-visually-hidden-classes.ts';

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

  // The chained form is the shape that slipped past the first version of this
  // guard: its lookbehind required a non-word character before the dot, which
  // `.foo` does not provide. Pinned because a guard with a silent bypass is
  // worse than no guard — it reports clean while the defect it exists to catch
  // walks straight through.
  test('flags a bare .sr-only selector chained onto another class', () => {
    expect(scanSource('.foo.sr-only {\n  position: absolute;\n}')).toHaveLength(1);
  });

  test('does not flag the design system utility, chained or otherwise', () => {
    expect(scanSource('.cinder-sr-only {\n  position: absolute;\n}')).toHaveLength(0);
    expect(scanSource('.foo.cinder-sr-only {\n  position: absolute;\n}')).toHaveLength(0);
    expect(scanSource('.cinder-sr-only-focusable:focus-visible {\n  width: auto;\n}')).toHaveLength(
      0,
    );
  });

  test('reports the correct 1-based line number', () => {
    const source = 'line one\nline two\n<span class="sr-only">three</span>\nline four';
    const hits = scanSource(source);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.lineNumber).toBe(3);
  });

  test('flags a Svelte class directive (shorthand)', () => {
    expect(scanSource('<span class:sr-only>hi</span>')).toHaveLength(1);
  });

  test('flags a Svelte class directive with a condition expression', () => {
    expect(scanSource('<span class:sr-only={collapsed}>hi</span>')).toHaveLength(1);
  });

  test('flags a bare token quoted inside a classNames() call', () => {
    expect(scanSource("<div class={classNames('sr-only', className)}>hi</div>")).toHaveLength(1);
  });

  test('flags a bare token quoted inside a classNames() call with a nested ternary', () => {
    expect(
      scanSource("<div class={classNames(active ? 'sr-only' : 'visible', className)}>hi</div>"),
    ).toHaveLength(1);
  });

  test('flags a bare token inside a template-literal class attribute', () => {
    expect(scanSource('<div class={`foo sr-only bar`}>hi</div>')).toHaveLength(1);
  });

  test('flags a bare sr-only-prefixed variant with no cinder- prefix', () => {
    expect(scanSource('<span class="sr-only-focusable">hi</span>')).toHaveLength(1);
    expect(scanSource('.sr-only-focusable:focus-visible {\n  position: fixed;\n}')).toHaveLength(1);
  });

  test('does NOT flag the correct cinder-sr-only class', () => {
    expect(scanSource('<span class="cinder-sr-only">hi</span>')).toHaveLength(0);
    expect(scanSource('.cinder-sr-only {\n  position: absolute;\n}')).toHaveLength(0);
  });

  test('does NOT flag the correct class used via classNames() or a class directive', () => {
    expect(
      scanSource("<div class={classNames('cinder-sr-only', className)}>hi</div>"),
    ).toHaveLength(0);
    expect(scanSource('<span class:cinder-sr-only>hi</span>')).toHaveLength(0);
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

describe('extractClassNamesCallArguments', () => {
  test('extracts a single call correctly', () => {
    const calls = extractClassNamesCallArguments("classNames('foo', className)");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.argumentsText).toBe("'foo', className");
  });

  test('handles nested parens inside the arguments', () => {
    const calls = extractClassNamesCallArguments(
      "classNames(isOpen ? getLabel('open') : 'closed', className)",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.argumentsText).toBe("isOpen ? getLabel('open') : 'closed', className");
  });

  test('extracts multiple calls in the same source', () => {
    const calls = extractClassNamesCallArguments(
      "classNames('a')\nsomeOtherCall()\nclassNames('b')",
    );
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.argumentsText)).toEqual(["'a'", "'b'"]);
  });
});

describe('scan — live packages/chat source tree', () => {
  test('finds zero bare sr-only usage sites in src/lib (CIN-505 regression guard)', async () => {
    const flags = await scan();
    expect(flags).toEqual([]);
  });
});
