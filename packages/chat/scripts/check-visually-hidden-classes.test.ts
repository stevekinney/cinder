import { describe, expect, test } from 'bun:test';

import {
  extractClassNamesCallArguments,
  isCssSelectorContext,
  isTestPath,
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

// Every case below was raised on the pull request that introduced this guard.
// A guard is only worth its cost if its own edge cases are pinned, so each of
// these was confirmed to fail against the pre-fix implementation.
describe('scanSource — guard hardening', () => {
  test('flags suffixes containing digits or underscores', () => {
    expect(scanSource('<span class="sr-only-v2">x</span>')).toHaveLength(1);
    expect(scanSource('<span class="sr-only-legacy_2">x</span>')).toHaveLength(1);
    expect(scanSource('.sr-only-v2 {\n  position: absolute;\n}')).toHaveLength(1);
  });

  test('still ignores the prefixed utility with those same suffixes', () => {
    expect(scanSource('<span class="cinder-sr-only-v2">x</span>')).toHaveLength(0);
    expect(scanSource('<span class="cinder-sr-only-focusable">x</span>')).toHaveLength(0);
    expect(scanSource('.cinder-sr-only-v2 { position: absolute; }')).toHaveLength(0);
  });

  test('flags the unprefixed focusable modifier on its own', () => {
    expect(scanSource('<span class="sr-only-focusable">x</span>')).toHaveLength(1);
  });

  test('does not flag an attribute whose name merely ends in class', () => {
    expect(scanSource('<span data-class="sr-only">x</span>')).toHaveLength(0);
    expect(scanSource('<Component wrapperclass="sr-only" />')).toHaveLength(0);
    expect(scanSource('<span data-class={`sr-only`}>x</span>')).toHaveLength(0);
  });

  test('still flags the real class attribute next to a decoy one', () => {
    expect(scanSource('<span data-class="x" class="sr-only">y</span>')).toHaveLength(1);
  });

  test('does not flag comments that document the prohibited form', () => {
    expect(scanSource('<!-- never write class="sr-only" here -->')).toHaveLength(0);
    expect(scanSource('/* .sr-only is not defined in this package */')).toHaveLength(0);
    expect(scanSource('  // use cinder-sr-only, never class="sr-only"')).toHaveLength(0);
  });

  test('reports the original line text, not the blanked one', () => {
    const source = '<!-- doc -->\n<span class="sr-only">real</span>';
    const hits = scanSource(source);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.lineNumber).toBe(2);
    expect(hits[0]?.line).toBe('<span class="sr-only">real</span>');
  });
});

describe('isTestPath', () => {
  test('covers every extension the scanner visits', () => {
    for (const path of [
      'a.test.ts',
      'a.spec.ts',
      'a.test.tsx',
      'a.test.mts',
      'a.test.svelte',
      'a.spec.svelte',
      'a.test.css',
      'a.spec.css',
    ])
      expect(isTestPath(path)).toBe(true);
  });

  test('covers the repository test-fixture convention', () => {
    expect(isTestPath('chat-composer-popover.test-fixture.svelte')).toBe(true);
  });

  test('does not treat ordinary sources as tests', () => {
    for (const path of ['a.ts', 'a.svelte', 'a.css', 'attested.ts', 'a.test.md'])
      expect(isTestPath(path)).toBe(false);
  });

  // These ship in dist/ and reach consumers, so exempting them would create
  // the blind spot this guard exists to close.
  test('does not exempt shipped -fixture.svelte components', () => {
    for (const path of ['chat-history-pagination-fixture.svelte', 'a-fixture.svelte'])
      expect(isTestPath(path)).toBe(false);
  });
});

describe('scanSource — context and syntax coverage', () => {
  test('flags an unquoted class attribute value', () => {
    expect(scanSource('<span class=sr-only>x</span>')).toHaveLength(1);
    expect(scanSource('<span class=sr-only-focusable>x</span>')).toHaveLength(1);
  });

  test('does not mistake an unquoted decoy attribute for class', () => {
    expect(scanSource('<span data-class=sr-only>x</span>')).toHaveLength(0);
  });

  test('still ignores the prefixed utility unquoted', () => {
    expect(scanSource('<span class=cinder-sr-only>x</span>')).toHaveLength(0);
  });

  // The CSS pattern runs over whole Svelte files, so it sees declaration
  // values, url() paths, and script strings. None of those define or apply a
  // class, and flagging them would fail the audit over harmless text.
  test('does not flag .sr-only outside a selector position', () => {
    expect(scanSource('.foo::after {\n  content: ".sr-only";\n}')).toHaveLength(0);
    expect(scanSource('.foo {\n  background: url("./sr-only.svg");\n}')).toHaveLength(0);
    expect(scanSource('.foo {\n  background: url(./sr-only.svg);\n}')).toHaveLength(0);
  });

  test('still flags a real selector in the same file as a decoy value', () => {
    expect(
      scanSource('.foo::after {\n  content: ".sr-only";\n}\n.sr-only {\n  position: absolute;\n}'),
    ).toHaveLength(1);
  });

  test('isCssSelectorContext separates selectors from declaration values', () => {
    const selector = '.sr-only { position: absolute; }';
    expect(isCssSelectorContext(selector, selector.indexOf(' {'))).toBe(true);
    const value = '.foo { content: ".sr-only"; }';
    expect(isCssSelectorContext(value, value.indexOf('";'))).toBe(false);
  });
});

describe('scan — live packages/chat source tree', () => {
  test('finds zero bare sr-only usage sites in src/lib (CIN-505 regression guard)', async () => {
    const flags = await scan();
    expect(flags).toEqual([]);
  });
});
