import { describe, expect, test } from 'bun:test';

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  blankTemplatePlaceholders,
  decodeStringEscapes,
  extractClassNamesCallArguments,
  extractOpeningTagSpans,
  extractStringBindings,
  isCssSelectorContext,
  isTestPath,
  languageForPath,
  maskRegexLiterals,
  maskScriptComments,
  maskStringLiterals,
  scan,
  scanSource,
  splitSourceRegions,
  templatePlaceholders,
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

  // Mirrors package.json's own `files` exclusions, which are the authority on
  // what is production surface: `npm pack --dry-run` ships zero fixture files.
  test('exempts every fixture pattern the package refuses to publish', () => {
    for (const path of [
      'chat-composer-popover.test-fixture.svelte',
      'chat-history-pagination-fixture.svelte',
      'chat-private-harness.fixture.svelte',
      'chat-thing-fixtures.svelte',
    ])
      expect(isTestPath(path)).toBe(true);
  });

  test('does not exempt ordinary components with fixture-ish names', () => {
    for (const path of ['fixture-gallery.svelte', 'chat-fixtureless.svelte'])
      expect(isTestPath(path)).toBe(false);
  });

  // `files` also excludes every `test/` directory under `dist`, and
  // `src/lib/test/` is where the package keeps its test helpers.
  test('exempts the test helper directory the package refuses to publish', () => {
    for (const path of ['test/css.ts', 'components/chat/test/helper.svelte', 'test\\css.ts'])
      expect(isTestPath(path)).toBe(true);
    for (const path of ['testing/css.ts', 'contest/a.ts', 'latest/a.svelte', 'test.ts'])
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

// A third round of review findings, all of the same family: the scanner could
// not tell code from text, in three different places.
describe('scanSource — underscore suffixes and string-literal awareness', () => {
  test('flags an underscore-separated suffix', () => {
    expect(scanSource('<span class="sr-only_focusable">x</span>')).toHaveLength(1);
    expect(scanSource('.sr-only_focusable {\n  position: absolute;\n}')).toHaveLength(1);
  });

  test('still ignores the prefixed utility with an underscore suffix', () => {
    expect(scanSource('<span class="cinder-sr-only_focusable">x</span>')).toHaveLength(0);
  });

  test('does not flag a CSS-looking selector stored in a script string', () => {
    expect(scanSource("<script>\n  const example = '.sr-only {';\n</script>")).toHaveLength(0);
    expect(scanSource('const template = `.sr-only { position: absolute; }`;')).toHaveLength(0);
  });

  test('still flags a real selector in a file that also contains such a string', () => {
    expect(
      scanSource(
        "<script>\n  const example = '.sr-only {';\n</script>\n<style>\n.sr-only { position: absolute; }\n</style>",
      ),
    ).toHaveLength(1);
  });

  test('balances classNames parentheses across a quoted closing paren', () => {
    // The `)` inside the quoted argument used to close the call early, so the
    // extractor never reached the bare token that followed it.
    const source = "const hidden = classNames(format(')'), 'sr-only');";
    expect(extractClassNamesCallArguments(source)[0]?.argumentsText).toContain('sr-only');
    expect(scanSource(source)).toHaveLength(1);
  });

  test('maskStringLiterals preserves offsets and newlines', () => {
    const source = "a = 'xy';\nb = 2;";
    const masked = maskStringLiterals(source);
    expect(masked).toHaveLength(source.length);
    expect(masked.split('\n')).toHaveLength(2);
    expect(masked).not.toContain('xy');
  });
});

describe('splitSourceRegions', () => {
  test('separates markup, script, and style regions with correct offsets', () => {
    const source =
      '<script lang="ts">\n  const a = 1;\n</script>\n<p>x</p>\n<style>\n.a {}\n</style>\n';
    const regions = splitSourceRegions(source);
    expect(regions.map((region) => region.kind)).toEqual(['script', 'markup', 'style', 'markup']);
    for (const region of regions) {
      expect(source.slice(region.start, region.start + region.text.length)).toBe(region.text);
    }
    expect(regions[0]?.text).toBe('\n  const a = 1;\n');
    expect(regions[2]?.text).toBe('\n.a {}\n');
  });

  test('treats a file without blocks as markup or code by content', () => {
    expect(splitSourceRegions('<span class="a">x</span>')).toEqual([
      { kind: 'markup', start: 0, text: '<span class="a">x</span>' },
    ]);
    expect(splitSourceRegions('.a { color: red; }')).toEqual([
      { kind: 'code', start: 0, text: '.a { color: red; }' },
    ]);
  });
});

describe('scanSource — region-aware scanning', () => {
  test('an apostrophe in markup prose does not hide a later selector', () => {
    // Masking string literals across the whole file treated `don't` as an
    // unterminated string and blanked the `<style>` block after it.
    expect(scanSource("<p>don't render this</p>\n<style>\n.sr-only {}\n</style>")).toHaveLength(1);
  });

  test('a markup example stored in a script string is not a class usage', () => {
    expect(
      scanSource('<script>\n  const example = "<span class=\'sr-only\'>";\n</script>'),
    ).toHaveLength(0);
  });

  test('a quoted closing brace does not end a class expression early', () => {
    expect(scanSource("<span class={hidden ? '}' : 'sr-only'}>x</span>")).toHaveLength(1);
  });

  test('a classNames() call in markup is scanned as script', () => {
    expect(scanSource("<div class={classNames('sr-only')}>x</div>")).toHaveLength(1);
  });

  test('reports line numbers relative to the whole file, not the region', () => {
    const hits = scanSource(
      '<script>\n  const a = 1;\n</script>\n<style>\n\n.sr-only {}\n</style>',
    );
    expect(hits).toEqual([{ lineNumber: 6, line: '.sr-only {}' }]);
  });
});

describe('scanSource — indirect class values in script', () => {
  test('flags a class computed into a variable and bound later', () => {
    expect(
      scanSource(
        "<script>\n  const hiddenClass = $derived(condition ? 'sr-only' : '');\n</script>\n<span class={hiddenClass}>x</span>",
      ),
    ).toHaveLength(1);
  });

  test('flags a class-list literal with a template placeholder', () => {
    expect(scanSource('<script>\n  const cls = `${base} sr-only`;\n</script>')).toHaveLength(1);
  });

  test('still ignores literals that are not class lists', () => {
    expect(
      scanSource(
        '<script>\n  const prose = "use cinder-sr-only, not sr-only";\n  const selector = ".sr-only";\n  const example = "<span class=\'sr-only\'>";\n</script>',
      ),
    ).toHaveLength(0);
  });

  test('ignores a DOM read that merely asks whether the class is present', () => {
    expect(
      scanSource("<script>\n  const hidden = node.classList.contains('sr-only');\n</script>"),
    ).toHaveLength(0);
  });

  test('still ignores the prefixed utility routed through a variable', () => {
    expect(scanSource("<script>\n  const hiddenClass = 'cinder-sr-only';\n</script>")).toHaveLength(
      0,
    );
  });
});

describe('scanSource — attribute matchers only run inside opening tags', () => {
  test('does not flag rendered documentation of the prohibited syntax', () => {
    expect(
      scanSource('<p>Use <code>class="sr-only"</code> or <code>class:sr-only</code> here.</p>'),
    ).toHaveLength(0);
  });

  test('still flags the same syntax inside a real opening tag', () => {
    expect(
      scanSource('<p><span class="sr-only">x</span>\nand <b class:sr-only>y</b></p>'),
    ).toHaveLength(2);
  });

  test('a tag-like string inside a markup expression is text, not a tag', () => {
    expect(scanSource('<code>{`<span class="sr-only">`}</code>')).toHaveLength(0);
    expect(scanSource('<code>{\'<span class="sr-only">\'}</code>')).toHaveLength(0);
    expect(scanSource('<p>{#if shown}{example}{/if} <b class="sr-only">y</b></p>')).toHaveLength(1);
  });

  test('a tag inside an {@html} expression is rendered and still flagged', () => {
    expect(scanSource('<div>{@html `<span class="sr-only">x</span>`}</div>')).toHaveLength(1);
  });

  test('extractOpeningTagSpans keeps > inside quoted values and expressions', () => {
    const spans = extractOpeningTagSpans(
      "<a title=\"a > b\" class={count > 1 ? 'many' : 'one'}>text</a>",
    );
    expect(spans).toHaveLength(1);
    expect(spans[0]?.text).toBe("<a title=\"a > b\" class={count > 1 ? 'many' : 'one'}>");
  });

  test('extractOpeningTagSpans skips closing tags', () => {
    expect(extractOpeningTagSpans('<div>x</div><br/>').map((span) => span.text)).toEqual([
      '<div>',
      '<br/>',
    ]);
  });
});

describe('scanSource — opening tags are read attribute by attribute', () => {
  test('ignores class-shaped text inside an unrelated attribute value', () => {
    expect(scanSource('<div data-example="class=sr-only">x</div>')).toHaveLength(0);
    expect(scanSource('<div data-example=\'class="sr-only"\'>x</div>')).toHaveLength(0);
    expect(scanSource('<div title="class:sr-only">x</div>')).toHaveLength(0);
  });

  test('ignores an sr-only token inside a non-class attribute', () => {
    expect(scanSource('<div aria-label="sr-only" id="sr-only">x</div>')).toHaveLength(0);
  });

  test('still flags the class attribute when it sits after an unrelated attribute', () => {
    expect(scanSource('<div data-example="class=sr-only" class="sr-only">x</div>')).toHaveLength(1);
  });

  test('flags a class applied through a Svelte spread', () => {
    expect(scanSource("<span {...{ class: 'sr-only' }}>x</span>")).toHaveLength(1);
    expect(scanSource('<span {...{ class: "label sr-only", id }}>x</span>')).toHaveLength(1);
    expect(scanSource("<span {...{ class: hidden ? 'sr-only' : '' }}>x</span>")).toHaveLength(1);
  });

  test('a spread whose class has no sr-only token is not a hit', () => {
    expect(
      scanSource("<span {...{ class: 'cinder-sr-only', title: 'sr-only' }}>x</span>"),
    ).toHaveLength(0);
    expect(scanSource('<span {...rest}>x</span>')).toHaveLength(0);
  });

  test('a class key nested inside another spread property is not a hit', () => {
    expect(scanSource("<Widget {...{ config: { class: 'sr-only' } }} />")).toHaveLength(0);
    expect(scanSource("<Widget {...{ items: [{ class: 'sr-only' }] }} />")).toHaveLength(0);
  });

  test('a class key inside a quoted spread value is not a hit', () => {
    expect(scanSource("<Widget {...{ title: 'class: sr-only' }} />")).toHaveLength(0);
    expect(scanSource('<Widget {...{ example: "{ class: \'sr-only\' }" }} />')).toHaveLength(0);
  });

  test('flags a quoted class key in a spread object', () => {
    expect(scanSource("<span {...{ 'class': 'sr-only' }}>x</span>")).toHaveLength(1);
    expect(scanSource('<span {...{ "class": "sr-only", id }}>x</span>')).toHaveLength(1);
    expect(scanSource("<span {...{ id, 'class': hidden ? 'sr-only' : '' }}>x</span>")).toHaveLength(
      1,
    );
  });

  test('a quoted class key inside a longer spread string is not a hit', () => {
    expect(scanSource("<Widget {...{ example: \"'class': 'sr-only'\" }} />")).toHaveLength(0);
    expect(scanSource('<Widget {...{ example: \'"class": "sr-only"\' }} />')).toHaveLength(0);
  });

  test('a top-level class key behind a conditional spread is still a hit', () => {
    expect(scanSource("<span {...(hidden ? { class: 'sr-only' } : {})}>x</span>")).toHaveLength(1);
  });

  test('a spread carrying the class through a variable is caught by the script scan', () => {
    const source =
      '<script lang="ts">\n  const attributes = { class: \'sr-only\' };\n</script>\n<span {...attributes}>x</span>';
    expect(scanSource(source, 'svelte')).toHaveLength(1);
  });
});

describe('language is taken from the file extension, not guessed from contents', () => {
  const cssWithDataUrl =
    '.icon {\n  background: url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'></svg>");\n}\n.sr-only {\n  position: absolute;\n}';

  test('languageForPath maps the scanned extensions', () => {
    expect(languageForPath('a/b.svelte')).toBe('svelte');
    expect(languageForPath('a/b.css')).toBe('css');
    expect(languageForPath('a/b.ts')).toBe('script');
    expect(languageForPath('a/b.txt')).toBeUndefined();
  });

  test('a .css file containing HTML-looking text is still scanned as CSS', () => {
    expect(scanSource(cssWithDataUrl, 'css')).toHaveLength(1);
    expect(splitSourceRegions(cssWithDataUrl, 'css').map((region) => region.kind)).toEqual([
      'style',
    ]);
  });

  test('a .svelte file with no blocks is markup even when it has no tags', () => {
    expect(splitSourceRegions('just text', 'svelte').map((region) => region.kind)).toEqual([
      'markup',
    ]);
    expect(splitSourceRegions('const a = 1;', 'script').map((region) => region.kind)).toEqual([
      'script',
    ]);
  });

  test('scan() passes the extension through for on-disk files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'visually-hidden-'));
    try {
      await mkdir(join(root, 'nested'), { recursive: true });
      await writeFile(join(root, 'nested', 'icon.css'), cssWithDataUrl);
      const flags = await scan(root);
      expect(flags).toEqual([
        { filePath: 'src/lib/nested/icon.css', lineNumber: 4, line: '.sr-only {' },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('scanSource — script-side review findings', () => {
  test('scan() visits production script files, not only .css and .svelte', async () => {
    const root = await mkdtemp(join(tmpdir(), 'visually-hidden-'));
    try {
      await writeFile(join(root, 'classes.ts'), "export const hidden = 'sr-only';\n");
      await writeFile(join(root, 'state.svelte.ts'), "export const live = 'sr-only live';\n");
      await writeFile(join(root, 'classes.test.ts'), "export const hidden = 'sr-only';\n");
      const flags = await scan(root);
      expect(flags.map((flag) => flag.filePath)).toEqual([
        'src/lib/classes.ts',
        'src/lib/state.svelte.ts',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('balances nested braces inside a template placeholder before the shape test', () => {
    const source =
      "<script>\nconst hidden = `${condition ? classes({ active: true }) : ''} sr-only`;\n</script>\n" +
      '<div class={hidden}></div>';
    expect(scanSource(source, 'svelte').map((hit) => hit.lineNumber)).toEqual([2]);
  });

  test('a classNames() call quoted inside a script string is documentation, not a call', () => {
    expect(scanSource(`<script>const example = "classNames('sr-only')";</script>`)).toHaveLength(0);
    expect(
      scanSource("<script>const pattern = /classNames\\('sr-only'\\)/;</script>"),
    ).toHaveLength(0);
  });

  test('still flags a real classNames() call next to a quoted decoy', () => {
    expect(
      scanSource(
        `<script>const example = "classNames('sr-only')";\nconst c = classNames('sr-only');</script>`,
      ).map((hit) => hit.lineNumber),
    ).toEqual([2]);
  });

  test('maskRegexLiterals blanks regexes, keeps strings, and leaves division alone', () => {
    expect(maskRegexLiterals("const a = /x'y/; const b = 'p/q'; const c = n / 2 / m;")).toBe(
      "const a = /   /; const b = 'p/q'; const c = n / 2 / m;",
    );
    expect(maskRegexLiterals('x.replace(/[/]a/, "b")')).toBe('x.replace(/    /, "b")');
  });

  test('a DOM read inside a class expression is not an applied class', () => {
    expect(
      scanSource(`<div class={node.classList.contains('sr-only') ? 'selected' : ''}></div>`),
    ).toHaveLength(0);
    expect(
      scanSource(`<div class={node.classList.contains('sr-only') ? 'sr-only' : ''}></div>`),
    ).toHaveLength(1);
  });
});

describe('scanSource — third-round review findings', () => {
  test('scan() visits .tsx and .jsx production modules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'visually-hidden-'));
    try {
      await writeFile(join(root, 'classes.tsx'), "export const hidden = 'sr-only';\n");
      await writeFile(join(root, 'legacy.jsx'), "export const hidden = 'sr-only';\n");
      await writeFile(join(root, 'classes.test.tsx'), "export const hidden = 'sr-only';\n");
      const flags = await scan(root);
      expect(flags.map((flag) => flag.filePath)).toEqual([
        'src/lib/classes.tsx',
        'src/lib/legacy.jsx',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('a regex literal returned straight from an arrow function is not a string', () => {
    expect(scanSource("const pattern = () => /'sr-only'/;", 'script')).toHaveLength(0);
    expect(maskRegexLiterals("() => /a'b/")).toBe('() => /   /');
  });

  test('flags a computed class key in a spread object', () => {
    expect(scanSource(`<span {...{ ['class']: 'sr-only' }}>hi</span>`)).toHaveLength(1);
    expect(scanSource(`<span {...{ ["class"]: 'sr-only' }}>hi</span>`)).toHaveLength(1);
    expect(scanSource('<span {...{ [`class`]: "sr-only" }}>hi</span>')).toHaveLength(1);
    expect(scanSource(`<span {...{ [ 'class' ] : 'sr-only' }}>hi</span>`)).toHaveLength(1);
  });

  test('a computed key that is not exactly class is not a hit', () => {
    expect(scanSource(`<span {...{ ['subclass']: 'sr-only' }}>hi</span>`)).toHaveLength(0);
    expect(scanSource(`<span {...{ [className]: 'sr-only' }}>hi</span>`)).toHaveLength(0);
  });

  test('comment delimiters inside CSS strings do not hide a selector between them', () => {
    const css =
      'a::before { content: "/*"; }\n.sr-only { position: absolute; }\na::after { content: "*/"; }\n';
    expect(scanSource(css, 'css').map((hit) => hit.lineNumber)).toEqual([2]);
  });

  test('a real CSS comment still hides a documented selector', () => {
    expect(scanSource('/* never write .sr-only { } */\n.ok { }\n', 'css')).toHaveLength(0);
    expect(scanSource('a { content: "it\'s"; }\n/* .sr-only { } */\n', 'css')).toHaveLength(0);
  });
});

describe('scanSource — fourth-round review findings', () => {
  test('comment delimiters inside script strings do not hide a literal between them', () => {
    const source = "const open = '/*';\nconst hidden = 'sr-only';\nconst close = '*/';";
    const hits = scanSource(source, 'script');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.lineNumber).toBe(2);
    expect(
      scanSource(`<script>${source}</script><div class={hidden}></div>`, 'svelte'),
    ).toHaveLength(1);
    expect(
      scanSource('const url = "http://x/*";\nconst hidden = "sr-only";', 'script'),
    ).toHaveLength(1);
  });

  test('real script comments still hide a documented literal, anywhere on the line', () => {
    expect(scanSource("const a = 1; // const hidden = 'sr-only';", 'script')).toHaveLength(0);
    expect(scanSource("const a = 1; /* const hidden = 'sr-only'; */", 'script')).toHaveLength(0);
    expect(scanSource("const a = 1;\n/*\n  const hidden = 'sr-only';\n*/", 'script')).toHaveLength(
      0,
    );
  });

  test('maskScriptComments steps over strings and regex literals', () => {
    expect(maskScriptComments("const a = '/*'; const b = 1; // c\nconst d = '*/';")).toBe(
      "const a = '/*'; const b = 1;     \nconst d = '*/';",
    );
    expect(maskScriptComments("const r = /'/; const s = 'x'; /* y */")).toBe(
      "const r = /'/; const s = 'x';        ",
    );
    expect(maskScriptComments('const t = `a\n//b`; // c')).toBe('const t = `a\n//b`;     ');
  });

  test('follows an {@html} reference to a string literal bound in the script', () => {
    const source =
      '<script>\n  const html = \'<span class="sr-only">x</span>\';\n</script>\n{@html html}';
    const hits = scanSource(source, 'svelte');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.lineNumber).toBe(2);
    expect(scanSource(source.replace('{@html html}', '{html}'), 'svelte')).toHaveLength(0);
    expect(scanSource(source.replace('{@html html}', '{@html other}'), 'svelte')).toHaveLength(0);
    expect(
      scanSource(
        '<script lang="ts">\n  let markup: string = `<b class="sr-only">y</b>`;\n</script>\n<div>{@html markup}</div>',
        'svelte',
      ),
    ).toHaveLength(1);
  });

  test('HTML comment delimiters inside script strings do not hide a literal between them', () => {
    const source =
      "<script>\n  const open = '<!--';\n  const hidden = 'sr-only';\n  const close = '-->';\n</script>\n<div class={hidden}></div>";
    const hits = scanSource(source, 'svelte');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.lineNumber).toBe(3);
  });

  test('an HTML comment is masked only in markup, and a script tag inside one is not a script', () => {
    expect(scanSource('<!-- <span class="sr-only">doc</span> -->', 'svelte')).toHaveLength(0);
    expect(
      scanSource("<!-- <script>const hidden = 'sr-only';</script> -->\n<span>ok</span>", 'svelte'),
    ).toHaveLength(0);
    expect(
      scanSource(
        "<script>\n  // <!-- not a comment opener\n  const hidden = 'sr-only';\n  // -->\n</script>",
        'svelte',
      ),
    ).toHaveLength(1);
    expect(
      scanSource('<style>\n  /* .sr-only {} */\n</style>\n<!-- .sr-only -->', 'svelte'),
    ).toHaveLength(0);
  });

  test('a class built entirely inside a template placeholder is still a usage site', () => {
    const source =
      "<script>\n  const hidden = `${condition ? 'sr-only' : ''}`;\n</script>\n<span class={hidden}></span>";
    const hits = scanSource(source, 'svelte');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.lineNumber).toBe(2);
    // Nested one level further, and inside a placeholder that carries its own object.
    expect(
      scanSource("const x = `${flag ? `${inner ? 'sr-only' : ''}` : classes({ a: 1 })}`;"),
    ).toHaveLength(1);
    // A DOM read inside a placeholder is still a read.
    expect(
      scanSource("const x = `${node.classList.contains('sr-only') ? 'on' : ''}`;"),
    ).toHaveLength(0);
  });

  test('a DOM read passed to classNames is not an applied class', () => {
    expect(scanSource("classNames(node.classList.contains('sr-only') && 'selected')")).toHaveLength(
      0,
    );
    expect(scanSource("classNames(node.matches('.sr-only') && 'selected')")).toHaveLength(0);
    expect(scanSource("classNames(node.classList.contains('sr-only') && 'sr-only')")).toHaveLength(
      1,
    );
    expect(scanSource("classNames(node.classList.add('sr-only') && 'x')")).toHaveLength(1);
  });

  test('templatePlaceholders reports balanced placeholder bodies with offsets', () => {
    expect(templatePlaceholders('a ${b} c ${d({ e: 1 })} f')).toEqual([
      { start: 4, text: 'b' },
      { start: 11, text: 'd({ e: 1 })' },
    ]);
    expect(templatePlaceholders("${x('}')}")).toEqual([{ start: 2, text: "x('}')" }]);
    expect(templatePlaceholders('${open')).toEqual([{ start: 2, text: 'open' }]);
    expect(blankTemplatePlaceholders('a ${b} c ${d({ e: 1 })} f')).toBe('a   c   f');
    expect(blankTemplatePlaceholders('${open')).toBe(' ');
  });

  test('extractStringBindings reads only single-literal initializers', () => {
    expect(extractStringBindings('const a = \'x\'; let b: string = "y"; var c = `z`;')).toEqual([
      { name: 'a', content: 'x', contentStart: 11 },
      { name: 'b', content: 'y', contentStart: 32 },
      { name: 'c', content: 'z', contentStart: 45 },
    ]);
    expect(extractStringBindings("const a = 'unterminated\nconst b = 'x';")).toEqual([
      { name: 'b', content: 'x', contentStart: 35 },
    ]);
    expect(extractStringBindings("const a = /const b = '/; const c = 'x';")).toEqual([
      { name: 'c', content: 'x', contentStart: 36 },
    ]);
  });
});

describe('scanSource — fifth-round review findings', () => {
  test('a multi-extension test module is exempt', () => {
    expect(isTestPath('widget.test.svelte.ts')).toBe(true);
    expect(isTestPath('widget.spec.svelte.ts')).toBe(true);
    expect(isTestPath('components/chat/chat.test.svelte.ts')).toBe(true);
    expect(isTestPath('widget.svelte.ts')).toBe(false);
    expect(isTestPath('widget.test-helpers.ts')).toBe(false);
    expect(isTestPath('widget.test.svelte.md')).toBe(false);
  });

  test('a suffix separated by repeated hyphens or underscores is still a bare token', () => {
    expect(scanSource('<span class="sr-only--focusable">x</span>', 'svelte')).toHaveLength(1);
    expect(scanSource('.sr-only--focusable {}', 'css')).toHaveLength(1);
    expect(scanSource("const hidden = 'sr-only__focusable';", 'script')).toHaveLength(1);
    expect(scanSource("classNames('sr-only--x')", 'script')).toHaveLength(1);
    expect(scanSource('<span class="cinder-sr-only--focusable">x</span>', 'svelte')).toHaveLength(
      0,
    );
  });

  test('a nested template literal inside a placeholder is parsed, not treated as the closer', () => {
    const source = "const hidden = `${condition ? `sr-only` : ''}`;";
    expect(scanSource(source, 'script')).toHaveLength(1);
    expect(
      scanSource(`<script>\n  ${source}\n</script>\n<span class={hidden}></span>`, 'svelte'),
    ).toHaveLength(1);
    // The literal after the nested template is still seen as its own literal.
    expect(
      scanSource("const a = `${flag ? `x` : 'y'}`; const b = 'sr-only';", 'script'),
    ).toHaveLength(1);
    expect(maskStringLiterals('`a ${`b`} c` + d')).toBe('`          ` + d');
  });

  test('comments and regex literals inside a placeholder are masked before scanning', () => {
    expect(
      scanSource("const x = `${condition ? (/* 'sr-only' */ 'selected') : ''}`;", 'script'),
    ).toHaveLength(0);
    expect(
      scanSource("const x = `${condition // 'sr-only'\n  ? 'selected' : ''}`;", 'script'),
    ).toHaveLength(0);
    expect(scanSource("const x = `${/'sr-only'/.test(v) ? 'on' : ''}`;", 'script')).toHaveLength(0);
    expect(
      scanSource("const x = `${condition ? /* doc */ 'sr-only' : ''}`;", 'script'),
    ).toHaveLength(1);
  });

  test('division after an object literal is not a regex start', () => {
    const source =
      "const n = { valueOf(){ return 4 } } / 2; const hidden = 'sr-only'; const r = /foo/;";
    expect(scanSource(source, 'script')).toHaveLength(1);
    expect(maskRegexLiterals('({ a: 1 }) / 2 / 3')).toBe('({ a: 1 }) / 2 / 3');
    expect(maskRegexLiterals("x = { a: 1 } / 2; y = 'q'")).toBe("x = { a: 1 } / 2; y = 'q'");
    // A regex after a block statement is still a regex.
    expect(scanSource("if (a) { b() }\n/'sr-only'/.test(x)", 'script')).toHaveLength(0);
    expect(maskRegexLiterals('if (a) { b }\n/x/.test(y)')).toBe('if (a) { b }\n/ /.test(y)');
    expect(maskScriptComments("const n = { v: 1 } / 2; const s = 'sr-only'; // c")).toBe(
      "const n = { v: 1 } / 2; const s = 'sr-only';     ",
    );
  });

  test('a brace inside a regex literal does not close a class expression', () => {
    expect(
      scanSource("<div class={/}/.test(value) ? 'sr-only' : ''}>x</div>", 'svelte'),
    ).toHaveLength(1);
    expect(extractOpeningTagSpans("<div class={/}/.test(v) ? 'a' : ''}>x</div>")).toEqual([
      { start: 0, text: "<div class={/}/.test(v) ? 'a' : ''}>" },
    ]);
  });

  test('a block tag quoted inside a Svelte expression does not open a region', () => {
    const source =
      "<div title={'<script>'}>a</div>\n<span class=\"sr-only\">b</span>\n<div title={'</script>'}>c</div>";
    expect(splitSourceRegions(source, 'svelte').map((region) => region.kind)).toEqual(['markup']);
    const hits = scanSource(source, 'svelte');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.lineNumber).toBe(2);
    expect(
      scanSource(
        "<div data-x={'<style>'}></div>\n<span class=\"sr-only\">b</span>\n<div data-x={'</style>'}></div>",
        'svelte',
      ),
    ).toHaveLength(1);
    // A real block after such an expression is still recognised.
    expect(
      splitSourceRegions(
        "<div title={'<script>'}></div><script>const a = 1;</script>",
        'svelte',
      ).map((region) => region.kind),
    ).toEqual(['markup', 'script']);
  });

  test('comparing an element class value against the token is a read, not a usage', () => {
    expect(scanSource("const a = node.className === 'sr-only';", 'script')).toHaveLength(0);
    expect(scanSource("if (node.classList.value !== 'sr-only') go();", 'script')).toHaveLength(0);
    expect(
      scanSource("const a = node.getAttribute('class') === 'sr-only';", 'script'),
    ).toHaveLength(0);
    expect(scanSource("const a = 'sr-only' === node.className;", 'script')).toHaveLength(0);
    expect(scanSource("const a = 'sr-only' == el?.classList.value;", 'script')).toHaveLength(0);
    expect(scanSource("const a = node.className.includes('sr-only');", 'script')).toHaveLength(0);
    expect(
      scanSource("<div class={node.className === 'sr-only' ? 'a' : ''}>x</div>", 'svelte'),
    ).toHaveLength(0);
    // Writes are still usage sites.
    expect(scanSource("node.className = 'sr-only';", 'script')).toHaveLength(1);
    expect(scanSource("node.setAttribute('class', 'sr-only');", 'script')).toHaveLength(1);
  });

  test('an {@html} binding resolves to the top-level declaration, not a nested shadow', () => {
    const prohibited = 'const html = \'<span class="sr-only">x</span>\';';
    const safe = "const html = '<span>safe</span>';";
    expect(
      scanSource(
        `<script>\n  ${prohibited}\n  function helper() { ${safe} }\n</script>\n{@html html}`,
        'svelte',
      ),
    ).toHaveLength(1);
    expect(
      scanSource(
        `<script>\n  function helper() { ${prohibited} }\n  ${safe}\n</script>\n{@html html}`,
        'svelte',
      ),
    ).toHaveLength(0);
    expect(
      scanSource(
        `<script>\n  function helper() { ${prohibited} }\n</script>\n{@html html}`,
        'svelte',
      ),
    ).toHaveLength(0);
    expect(extractStringBindings("const a = 'x'; { const b = 'y'; } const c = 'z';")).toEqual([
      { name: 'a', content: 'x', contentStart: 11 },
      { name: 'c', content: 'z', contentStart: 45 },
    ]);
  });
});

describe('scanSource — sixth-round review findings', () => {
  test('a brace inside a regex literal does not end a template placeholder', () => {
    expect(scanSource("const x = `${/}/.test(value) ? 'sr-only' : ''}`;", 'script')).toHaveLength(
      1,
    );
    expect(
      scanSource("<div class={`${/}/.test(value) ? 'sr-only' : ''}`}>x</div>", 'svelte'),
    ).toHaveLength(1);
    expect(templatePlaceholders("a ${/}/.test(v) ? 'b' : ''} c")).toEqual([
      { start: 4, text: "/}/.test(v) ? 'b' : ''" },
    ]);
    // A `/` that is division inside a placeholder is still just division.
    expect(templatePlaceholders('${a / b} ${c}')).toEqual([
      { start: 2, text: 'a / b' },
      { start: 11, text: 'c' },
    ]);
  });

  test('a regex literal that opens a statement after a control-flow condition is a regex', () => {
    expect(scanSource("if (enabled) /'sr-only'/.test(value);", 'script')).toHaveLength(0);
    expect(scanSource("while (busy) /'sr-only'/.test(value);", 'script')).toHaveLength(0);
    expect(scanSource("for (const item of items) /'sr-only'/.test(item);", 'script')).toHaveLength(
      0,
    );
    expect(maskRegexLiterals('if (a) /x/.test(b)')).toBe('if (a) / /.test(b)');
    // A call result divided by something is still division.
    expect(maskRegexLiterals('total(a) / 2 / count')).toBe('total(a) / 2 / count');
    expect(scanSource("const n = f(a) / 2; const s = 'sr-only';", 'script')).toHaveLength(1);
  });

  test('escaped whitespace inside a string literal separates class tokens', () => {
    expect(scanSource("const hidden = 'foo\\nsr-only';", 'script')).toHaveLength(1);
    expect(scanSource("const hidden = 'foo\\tsr-only';", 'script')).toHaveLength(1);
    expect(scanSource("const hidden = 'foo\\x20sr-only';", 'script')).toHaveLength(1);
    expect(scanSource("const hidden = 'foo\\u0020sr-only';", 'script')).toHaveLength(1);
    expect(scanSource("const hidden = 'foo\\u{20}sr-only';", 'script')).toHaveLength(1);
    expect(scanSource("<div class={'foo\\nsr-only'}>x</div>", 'svelte')).toHaveLength(1);
    expect(scanSource('<div class={`foo\\n${x} sr-only`}>x</div>', 'svelte')).toHaveLength(1);
    // A literal backslash-n is not whitespace, and an escaped quote is still a quote.
    expect(scanSource("const hidden = 'foo\\\\nsr-only';", 'script')).toHaveLength(0);
    expect(scanSource("const hidden = 'it\\'s sr-only';", 'script')).toHaveLength(0);
    expect(decodeStringEscapes('foo\\nsr-only')).toBe('foo\nsr-only ');
    expect(decodeStringEscapes('a\\u{1F600}b')).toBe('a😀b       ');
  });

  test('a class attribute selector in CSS is a usage site', () => {
    expect(scanSource('[class~="sr-only"] { position: absolute; }', 'css')).toHaveLength(1);
    expect(scanSource("[class='sr-only'] { position: absolute; }", 'css')).toHaveLength(1);
    expect(scanSource('[class="foo sr-only"] { position: absolute; }', 'css')).toHaveLength(1);
    expect(scanSource('div[class ~= sr-only i] { position: absolute; }', 'css')).toHaveLength(1);
    expect(
      scanSource('<style>\n  [class~="sr-only"] { top: 0; }\n</style>', 'svelte'),
    ).toHaveLength(1);
    expect(scanSource('[class~="cinder-sr-only"] { position: absolute; }', 'css')).toHaveLength(0);
    expect(scanSource('div { content: \'[class~="sr-only"]\'; }', 'css')).toHaveLength(0);
    expect(scanSource('[data-class~="sr-only"] { top: 0; }', 'css')).toHaveLength(0);
  });
});
