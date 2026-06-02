import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALLOWLIST,
  allowlistKey,
  buildAllowlistIndex,
  detectAllRawControls,
  detectRawControl,
  extractInlineAllowReason,
  RAW_CONTROL_TAG_NAMES,
  renderReport,
  scan,
  stripCommentsAndStrings,
  toPosixPath,
  type AllowlistEntry,
  type RawControlOccurrence,
  type ScanResult,
} from './check-raw-native-controls.ts';

// Resolve via fileURLToPath (not `new URL(...).pathname`) so the path is a valid
// filesystem path on every platform — `.pathname` yields a broken `/C:/...` on
// Windows. Mirrors the script's own `fileURLToPath(import.meta.url)` usage.
const examplesDirectory = fileURLToPath(new URL('../src/examples', import.meta.url));

// ── stripCommentsAndStrings ───────────────────────────────────────────────────

describe('stripCommentsAndStrings — comment and string removal', () => {
  test('strips a single-line HTML comment containing a raw control tag', () => {
    const source = '<!-- <button> -->';
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).not.toContain('<button>');
    // Line count must be preserved (no newlines here).
    expect(stripped.split('\n').length).toBe(1);
  });

  test('strips a multi-line HTML comment containing a raw control tag', () => {
    const source = '<!--\n  <button>\n-->';
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).not.toContain('<button>');
    // Three lines in, three lines out.
    expect(stripped.split('\n').length).toBe(3);
  });

  test('preserves line count after stripping multi-line HTML comment', () => {
    const source = 'line1\n<!-- \n<button>\n -->\nline5';
    const stripped = stripCommentsAndStrings(source);
    expect(stripped.split('\n').length).toBe(source.split('\n').length);
    expect(stripped).not.toContain('<button>');
  });

  test('strips a JS block comment containing a raw control tag (inside script)', () => {
    const source = '<script lang="ts">\n/* <button> */\nconst x = 1;\n</script>';
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).not.toContain('<button>');
    expect(stripped.split('\n').length).toBe(source.split('\n').length);
  });

  test('strips a multi-line JS block comment containing a raw control tag', () => {
    const source = '<script lang="ts">\n/*\n  <textarea>\n*/\nconst x = 1;\n</script>';
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).not.toContain('<textarea>');
    expect(stripped.split('\n').length).toBe(source.split('\n').length);
  });

  test('strips a JS line comment containing a raw control tag', () => {
    const source = '<script lang="ts">\n// <input type="text">\nconst x = 1;\n</script>';
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).not.toContain('<input');
    expect(stripped.split('\n').length).toBe(source.split('\n').length);
  });

  test('strips a single-quoted string literal containing a raw control tag', () => {
    const source = '<script lang="ts">\nconst tag = \'<button>\';\n</script>';
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).not.toContain('<button>');
    expect(stripped.split('\n').length).toBe(source.split('\n').length);
  });

  test('strips a double-quoted string literal containing a raw control tag', () => {
    const source = '<script lang="ts">\nconst tag = "<input>";\n</script>';
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).not.toContain('<input>');
  });

  test('strips a template literal containing a raw control tag', () => {
    const source = '<script lang="ts">\nconst tag = `<select>`;\n</script>';
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).not.toContain('<select>');
  });

  test('does NOT strip a real raw control in template content', () => {
    const source = '<div>\n  <button type="button">Click</button>\n</div>';
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).toContain('<button');
  });

  test('does NOT strip a raw control in a Svelte template outside any comment', () => {
    const source = '<script lang="ts">\nlet x = 1;\n</script>\n<button>OK</button>';
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).toContain('<button>');
  });

  test('an element whose name starts with "script" does NOT enter script state', () => {
    // `<scripting>` shares the first 7 characters with `<script` but is not the
    // script element. Without a tag-name boundary check it would wrongly switch
    // to script state and start stripping its following template content (e.g. a
    // string literal). Here the real <button> after it must survive.
    const source = '<scripting>\n  const s = "<select>";\n</scripting>\n<button>OK</button>';
    const stripped = stripCommentsAndStrings(source);
    // Still in template state, so the JS-string `<select>` is NOT stripped...
    expect(stripped).toContain('<select>');
    // ...and the real <button> is preserved.
    expect(stripped).toContain('<button>');
  });

  test('html-comment inside <script> returns to script state — block comment after it is still stripped', () => {
    // If the html-comment exit incorrectly resets to 'template', the /* block comment */
    // that follows would NOT be stripped (template state does not handle /* */), and
    // <button> inside the block comment would survive into the stripped output.
    const source = [
      '<script lang="ts">',
      '<!-- html-like sequence inside script -->',
      '/* <button> inside block comment after html-comment */',
      'const x = 1;',
      '</script>',
    ].join('\n');
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).not.toContain('<button>');
    expect(stripped.split('\n').length).toBe(source.split('\n').length);
  });

  test('html-comment inside <script> returns to script state — line comment after it is still stripped', () => {
    // Same test but with a // line comment after the html-comment sequence.
    const source = [
      '<script lang="ts">',
      '<!-- sequence inside script -->',
      '// <input type="text"> inside line comment',
      'const x = 1;',
      '</script>',
    ].join('\n');
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).not.toContain('<input');
    expect(stripped.split('\n').length).toBe(source.split('\n').length);
  });

  test('html-comment inside <script> returns to script state — raw control after it is NOT misclassified', () => {
    // A real <button> in the template AFTER the script block must still be detected.
    // This ensures the state machine correctly handles both a script-internal html-comment
    // and subsequent template content.
    const source = [
      '<script lang="ts">',
      '<!-- comment-like sequence inside script -->',
      'const x = 1;',
      '</script>',
      '<button type="button">Click</button>',
    ].join('\n');
    const stripped = stripCommentsAndStrings(source);
    // The real template <button> must survive stripping.
    expect(stripped).toContain('<button');
  });

  test('block comment inside <script> returns to script state — subsequent code is not suppressed', () => {
    // Ensures block-comment exit (which already hardcoded 'script') leaves subsequent
    // script content visible so a raw tag in a string literal after the comment is stripped.
    const source = [
      '<script lang="ts">',
      "/* comment */ const tag = '<select>';",
      '</script>',
    ].join('\n');
    const stripped = stripCommentsAndStrings(source);
    expect(stripped).not.toContain('<select>');
    expect(stripped.split('\n').length).toBe(source.split('\n').length);
  });

  test('preserves exact line count for a realistic Svelte file with mixed content', () => {
    const source = [
      '<script lang="ts">',
      '  // This is a comment with <button> inside',
      '  /* block comment <input> */',
      "  const label = '<select>';",
      '</script>',
      '<!-- <textarea> in HTML comment -->',
      '<button>Real button</button>',
    ].join('\n');
    const stripped = stripCommentsAndStrings(source);
    expect(stripped.split('\n').length).toBe(source.split('\n').length);
    // Real button must survive; commented/string ones must not.
    const lines = stripped.split('\n');
    expect(lines[6]).toContain('<button>');
    // Commented/string occurrences must be gone from their respective lines.
    expect(lines[1]).not.toContain('<button>');
    expect(lines[2]).not.toContain('<input>');
    expect(lines[3]).not.toContain('<select>');
    expect(lines[5]).not.toContain('<textarea>');
  });
});

// ── detectRawControl ───────────────────────────────────────────────────────────

describe('detectRawControl — raw tag detection (first match)', () => {
  test('detects <button> tag', () => {
    expect(detectRawControl('<button type="button">Click</button>')).toBe('button');
  });

  test('detects <input> tag', () => {
    expect(detectRawControl('<input type="checkbox" />')).toBe('input');
  });

  test('detects <select> tag', () => {
    expect(detectRawControl('<select value={x}>')).toBe('select');
  });

  test('detects <textarea> tag', () => {
    expect(detectRawControl('<textarea rows={4}>')).toBe('textarea');
  });

  test('detects tag when preceded by whitespace (indented templates)', () => {
    expect(detectRawControl('        <button type="button">Submit</button>')).toBe('button');
  });

  test('detects self-closing <input />', () => {
    expect(detectRawControl('  <input />')).toBe('input');
  });

  test('detects multi-line opening tag (just the first line)', () => {
    // In practice the scanner sees one line at a time; the opening line has the tag.
    expect(detectRawControl('        <button')).toBe('button');
  });

  test('does NOT detect Cinder <Button> (uppercase — a Svelte component)', () => {
    expect(detectRawControl('<Button label="Submit" />')).toBeNull();
  });

  test('does NOT detect <ButtonGroup>', () => {
    expect(detectRawControl('<ButtonGroup>')).toBeNull();
  });

  test('does NOT detect <selectField> (camel-variant name)', () => {
    expect(detectRawControl('<selectField>')).toBeNull();
  });

  test('does NOT detect <inputGroup>', () => {
    expect(detectRawControl('<inputGroup>')).toBeNull();
  });

  test('does NOT detect a non-control element (<div>)', () => {
    expect(detectRawControl('<div class="container">')).toBeNull();
  });

  test('does NOT detect a <span>', () => {
    expect(detectRawControl('<span>text</span>')).toBeNull();
  });

  test('returns null for empty lines', () => {
    expect(detectRawControl('')).toBeNull();
  });

  test('returns null for text content (not markup)', () => {
    expect(detectRawControl('The button should be pressed.')).toBeNull();
  });

  test('all four RAW_CONTROL_TAG_NAMES are detectable', () => {
    for (const tagName of RAW_CONTROL_TAG_NAMES) {
      expect(detectRawControl(`<${tagName}>`)).toBe(tagName);
    }
  });
});

// ── detectAllRawControls ───────────────────────────────────────────────────────

describe('detectAllRawControls — all matches per line', () => {
  test('returns an empty array for a line with no raw controls', () => {
    expect(detectAllRawControls('<div class="x">')).toEqual([]);
  });

  test('returns a single match for a line with one raw control', () => {
    const matches = detectAllRawControls('<button type="button">Click</button>');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.tagName).toBe('button');
    expect(matches[0]?.columnIndex).toBe(0);
  });

  test('returns ALL matches for two raw controls on the same line', () => {
    const matches = detectAllRawControls('<button /><input />');
    expect(matches).toHaveLength(2);
    expect(matches[0]?.tagName).toBe('button');
    expect(matches[1]?.tagName).toBe('input');
  });

  test('returns ALL matches for three raw controls on the same line', () => {
    const matches = detectAllRawControls('<button /><input /><select>');
    expect(matches).toHaveLength(3);
    expect(matches[0]?.tagName).toBe('button');
    expect(matches[1]?.tagName).toBe('input');
    expect(matches[2]?.tagName).toBe('select');
  });

  test('reports correct columnIndex for each match', () => {
    // '  <button />' — button starts at col 2
    const matches = detectAllRawControls('  <button />');
    expect(matches[0]?.columnIndex).toBe(2);
  });

  test('reports correct columnIndex for the second match on a line', () => {
    // '<button /><input />' — input starts at col 10
    const matches = detectAllRawControls('<button /><input />');
    expect(matches[1]?.columnIndex).toBe(10);
  });

  test('does NOT return Cinder <Button> (uppercase) as a match', () => {
    const matches = detectAllRawControls('<Button /><input />');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.tagName).toBe('input');
  });

  test('calling detectAllRawControls twice gives the same result (no global-regex state leak)', () => {
    const line = '<button /><input />';
    const first = detectAllRawControls(line);
    const second = detectAllRawControls(line);
    expect(first).toEqual(second);
  });
});

// ── extractInlineAllowReason ──────────────────────────────────────────────────

describe('extractInlineAllowReason — inline allow marker', () => {
  test('extracts reason from a well-formed marker', () => {
    expect(
      extractInlineAllowReason(
        '<button bind:this={el}>Open</button> <!-- examples-audit-allow: triggerRef needs native element -->',
      ),
    ).toBe('triggerRef needs native element');
  });

  test('extracts reason from a marker on its own line', () => {
    expect(
      extractInlineAllowReason(
        '<!-- examples-audit-allow: forwards spread attrs from parent snippet -->',
      ),
    ).toBe('forwards spread attrs from parent snippet');
  });

  test('trims whitespace from the reason', () => {
    expect(extractInlineAllowReason('<!-- examples-audit-allow:   extra spaces   -->')).toBe(
      'extra spaces',
    );
  });

  test('returns null when the marker is absent', () => {
    expect(extractInlineAllowReason('<button type="button">Click</button>')).toBeNull();
  });

  test('returns null for an ordinary HTML comment', () => {
    expect(extractInlineAllowReason('<!-- this is just a comment -->')).toBeNull();
  });

  test('returns null for an empty line', () => {
    expect(extractInlineAllowReason('')).toBeNull();
  });

  test('returns null for a whitespace-only reason (spaces between colon and -->)', () => {
    // A whitespace-only reason must NOT count as a valid exemption — a reason is required.
    expect(extractInlineAllowReason('<!-- examples-audit-allow:    -->')).toBeNull();
  });

  test('returns null for a marker with nothing after the colon', () => {
    expect(extractInlineAllowReason('<!-- examples-audit-allow: -->')).toBeNull();
  });

  test('returns the reason when at least one non-space character is present', () => {
    expect(extractInlineAllowReason('<!-- examples-audit-allow: x -->')).toBe('x');
  });
});

// ── toPosixPath ────────────────────────────────────────────────────────────────

describe('toPosixPath — OS-independent path keys', () => {
  test('converts backslashes to forward slashes (Windows scan paths)', () => {
    expect(toPosixPath('button\\basic.example.svelte')).toBe('button/basic.example.svelte');
  });

  test('leaves POSIX paths unchanged', () => {
    expect(toPosixPath('button/basic.example.svelte')).toBe('button/basic.example.svelte');
  });
});

// ── allowlistKey ───────────────────────────────────────────────────────────────

describe('allowlistKey — key format', () => {
  test('builds a stable file::tagName::occurrenceIndex key', () => {
    expect(allowlistKey('navigation-bar/basic.example.svelte', 'button', 0)).toBe(
      'navigation-bar/basic.example.svelte::button::0',
    );
  });

  test('differentiates the first and second occurrence of the same tag', () => {
    const key0 = allowlistKey('foo/bar.example.svelte', 'input', 0);
    const key1 = allowlistKey('foo/bar.example.svelte', 'input', 1);
    expect(key0).not.toBe(key1);
  });

  test('differentiates two different tag names at occurrence 0', () => {
    const keyButton = allowlistKey('foo/bar.example.svelte', 'button', 0);
    const keyInput = allowlistKey('foo/bar.example.svelte', 'input', 0);
    expect(keyButton).not.toBe(keyInput);
  });

  test('normalizes backslashes in the path component', () => {
    expect(allowlistKey('navigation-bar\\basic.example.svelte', 'button', 0)).toBe(
      'navigation-bar/basic.example.svelte::button::0',
    );
  });
});

// ── buildAllowlistIndex ────────────────────────────────────────────────────────

describe('buildAllowlistIndex — fast lookup set', () => {
  const entries: AllowlistEntry[] = [
    {
      relativePath: 'navigation-bar/basic.example.svelte',
      tagName: 'button',
      occurrenceIndex: 0,
      reason: 'receives forwarded attrs from NavigationBar menuToggle snippet',
    },
    {
      relativePath: 'popover/transformed-ancestor.example.svelte',
      tagName: 'button',
      occurrenceIndex: 0,
      reason: 'uses bind:this for triggerRef — requires a native HTMLButtonElement',
    },
  ];

  test('contains an entry for each allowlisted file+tag+index', () => {
    const index = buildAllowlistIndex(entries);
    expect(index.has('navigation-bar/basic.example.svelte::button::0')).toBe(true);
    expect(index.has('popover/transformed-ancestor.example.svelte::button::0')).toBe(true);
  });

  test('does not contain a key for a different occurrenceIndex', () => {
    const index = buildAllowlistIndex(entries);
    expect(index.has('navigation-bar/basic.example.svelte::button::1')).toBe(false);
  });

  test('does not contain a key for a different tagName', () => {
    const index = buildAllowlistIndex(entries);
    expect(index.has('navigation-bar/basic.example.svelte::input::0')).toBe(false);
  });

  test('does not contain a key for an entirely different file', () => {
    const index = buildAllowlistIndex(entries);
    expect(index.has('button/basic.example.svelte::button::0')).toBe(false);
  });

  test('empty allowlist produces an empty set', () => {
    expect(buildAllowlistIndex([])).toEqual(new Set());
  });
});

// ── ALLOWLIST canonical entries ────────────────────────────────────────────────

describe('ALLOWLIST — canonical checked-in entries', () => {
  test('every entry has a non-empty reason', () => {
    for (const entry of ALLOWLIST) {
      expect(entry.reason.trim().length).toBeGreaterThan(0);
    }
  });

  test('every entry has a relativePath that looks like an example file', () => {
    for (const entry of ALLOWLIST) {
      expect(entry.relativePath).toMatch(/\.example\.svelte$/);
    }
  });

  test('every entry has a valid tagName', () => {
    for (const entry of ALLOWLIST) {
      expect(RAW_CONTROL_TAG_NAMES).toContain(entry.tagName);
    }
  });

  test('every entry has a non-negative occurrenceIndex', () => {
    for (const entry of ALLOWLIST) {
      expect(entry.occurrenceIndex).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── renderReport ───────────────────────────────────────────────────────────────

describe('renderReport — human-readable output', () => {
  const makeOccurrence = (overrides: Partial<RawControlOccurrence> = {}): RawControlOccurrence => ({
    relativePath: 'button/basic.example.svelte',
    lineNumber: 12,
    columnIndex: 0,
    tagName: 'button',
    lineText: '<button type="button">Click</button>',
    ...overrides,
  });

  const makeResult = (overrides: Partial<ScanResult> = {}): ScanResult => ({
    allowlisted: [],
    flagged: [],
    staleAllowlistEntries: [],
    ...overrides,
  });

  test('includes the total count in the header', () => {
    const result = makeResult({
      allowlisted: [makeOccurrence()],
      flagged: [makeOccurrence({ relativePath: 'inline/basic.example.svelte', lineNumber: 11 })],
    });
    const report = renderReport(result);
    expect(report).toContain('Total raw controls found: 2');
    expect(report).toContain('1 flagged');
    expect(report).toContain('1 allowlisted');
  });

  test('reports zero flagged when all controls are allowlisted', () => {
    const result = makeResult({ allowlisted: [makeOccurrence()] });
    const report = renderReport(result);
    expect(report).toContain('Flagged: none');
  });

  test('includes relative path and line number for flagged items', () => {
    const result = makeResult({
      flagged: [makeOccurrence({ relativePath: 'inline/basic.example.svelte', lineNumber: 11 })],
    });
    const report = renderReport(result);
    expect(report).toContain('inline/basic.example.svelte:11');
  });

  test('includes <tagName> in the rendered line', () => {
    const result = makeResult({ flagged: [makeOccurrence({ tagName: 'input' })] });
    const report = renderReport(result);
    expect(report).toContain('<input>');
  });

  test('reports stale allowlist entries when present', () => {
    const staleEntry: AllowlistEntry = {
      relativePath: 'button/basic.example.svelte',
      tagName: 'button',
      occurrenceIndex: 5,
      reason: 'old entry that no longer matches',
    };
    const result = makeResult({ staleAllowlistEntries: [staleEntry] });
    const report = renderReport(result);
    expect(report).toContain('Stale allowlist entries');
    expect(report).toContain('button/basic.example.svelte');
    expect(report).toContain('old entry that no longer matches');
  });

  test('does NOT include stale section when there are no stale entries', () => {
    const result = makeResult();
    const report = renderReport(result);
    expect(report).not.toContain('Stale allowlist entries');
  });
});

// ── scan — integration against real example files ──────────────────────────────

describe('scan — live inventory against the real examples directory', () => {
  // scan() walks the real examples tree; give it generous headroom on slow CI.
  test('returns a ScanResult with allowlisted, flagged, and staleAllowlistEntries arrays', async () => {
    const result = await scan(examplesDirectory);

    expect(Array.isArray(result.allowlisted)).toBe(true);
    expect(Array.isArray(result.flagged)).toBe(true);
    expect(Array.isArray(result.staleAllowlistEntries)).toBe(true);
  }, 15_000);

  test('detects at least one raw control across all example files', async () => {
    const result = await scan(examplesDirectory);
    const total = result.allowlisted.length + result.flagged.length;
    expect(total).toBeGreaterThan(0);
  }, 15_000);

  test('does NOT flag the navigation-bar menuToggle button (it is allowlisted)', async () => {
    const result = await scan(examplesDirectory);

    const navigationBarFlagged = result.flagged.filter(
      (occurrence) => occurrence.relativePath === 'navigation-bar/basic.example.svelte',
    );
    expect(navigationBarFlagged).toHaveLength(0);

    const navigationBarAllowlisted = result.allowlisted.filter(
      (occurrence) => occurrence.relativePath === 'navigation-bar/basic.example.svelte',
    );
    expect(navigationBarAllowlisted.length).toBeGreaterThan(0);
  }, 15_000);

  test('does NOT flag the popover transformed-ancestor trigger button (it is allowlisted)', async () => {
    const result = await scan(examplesDirectory);

    const popoverFlagged = result.flagged.filter(
      (occurrence) => occurrence.relativePath === 'popover/transformed-ancestor.example.svelte',
    );
    expect(popoverFlagged).toHaveLength(0);
  }, 15_000);

  test('every returned occurrence has a positive lineNumber and a non-empty relativePath', async () => {
    const result = await scan(examplesDirectory);

    for (const occurrence of [...result.allowlisted, ...result.flagged]) {
      expect(occurrence.lineNumber).toBeGreaterThan(0);
      expect(occurrence.relativePath.length).toBeGreaterThan(0);
      expect(RAW_CONTROL_TAG_NAMES).toContain(occurrence.tagName);
    }
  }, 15_000);

  test('respects a custom empty allowlist (nothing is allowlisted)', async () => {
    const result = await scan(examplesDirectory, []);
    // With an empty allowlist all occurrences land in flagged.
    expect(result.allowlisted).toHaveLength(0);
    expect(result.flagged.length).toBeGreaterThan(0);
  }, 15_000);

  test('results are sorted by relativePath then lineNumber', async () => {
    const result = await scan(examplesDirectory);
    // Check each array is sorted independently.
    for (const list of [result.allowlisted, result.flagged]) {
      for (let index = 1; index < list.length; index++) {
        const previous = list[index - 1]!;
        const current = list[index]!;
        const pathCompare = previous.relativePath.localeCompare(current.relativePath);
        if (pathCompare === 0) {
          expect(previous.lineNumber).toBeLessThanOrEqual(current.lineNumber);
        } else {
          expect(pathCompare).toBeLessThan(0);
        }
      }
    }
  }, 15_000);

  test('does NOT flag raw controls inside HTML/Svelte comments in real files', async () => {
    const result = await scan(examplesDirectory);
    // command-palette/search-recent-actions.example.svelte has several <!-- ... -->
    // comment blocks in the template; those must not be counted as raw controls.
    // We verify this indirectly: the file has exactly 1 <button> (the trigger),
    // which is allowlisted — so the flagged list should contain 0 from that file.
    const commandPaletteFlagged = result.flagged.filter((occurrence) =>
      occurrence.relativePath.includes('command-palette/search-recent-actions'),
    );
    expect(commandPaletteFlagged).toHaveLength(0);
  }, 15_000);

  test('the canonical ALLOWLIST has no stale entries against the real files', async () => {
    const result = await scan(examplesDirectory);
    // If this fails, the file was refactored and the ALLOWLIST entry needs updating.
    expect(result.staleAllowlistEntries).toHaveLength(0);
  }, 15_000);

  test('a deliberately stale allowlist entry is reported as stale', async () => {
    const staleEntry: AllowlistEntry = {
      relativePath: 'navigation-bar/basic.example.svelte',
      tagName: 'button',
      // occurrenceIndex 99 — no file has 100 buttons.
      occurrenceIndex: 99,
      reason: 'deliberate stale entry for test',
    };
    const result = await scan(examplesDirectory, [staleEntry]);
    expect(result.staleAllowlistEntries).toHaveLength(1);
    expect(result.staleAllowlistEntries[0]?.occurrenceIndex).toBe(99);
  }, 15_000);

  test('right tag on a line is exempted; wrong tag on the same line is still flagged', async () => {
    // This exercises that the allowlist is tag-specific: if a file had <button> and
    // <input> on the same line and only <button> is allowlisted, <input> is still flagged.
    // We construct a minimal fixture via a custom allowlist with the wrong tag.
    // Use an allowlist that covers 'input' at index 0 for the nav-bar file (which
    // actually has a <button> there, not an <input>). The <button> should be flagged.
    const wrongTagEntry: AllowlistEntry = {
      relativePath: 'navigation-bar/basic.example.svelte',
      tagName: 'input', // wrong tag
      occurrenceIndex: 0,
      reason: 'wrong tag entry for test',
    };
    const result = await scan(examplesDirectory, [wrongTagEntry]);
    // The <button> in nav-bar is NOT allowlisted (we gave the wrong tag), so it is flagged.
    const navigationBarFlagged = result.flagged.filter(
      (occurrence) =>
        occurrence.relativePath === 'navigation-bar/basic.example.svelte' &&
        occurrence.tagName === 'button',
    );
    expect(navigationBarFlagged.length).toBeGreaterThan(0);
    // The wrongTagEntry itself is stale (no <input> at index 0 in that file).
    expect(result.staleAllowlistEntries.some((entry) => entry.tagName === 'input')).toBe(true);
  }, 15_000);
});

describe('scan — inline marker line boundaries (temp fixtures)', () => {
  async function scanFixture(contents: string): Promise<ScanResult> {
    const directory = await mkdtemp(join(tmpdir(), 'raw-native-guard-'));
    try {
      // Write at the temp-dir root (the scan glob is `**/*.example.svelte`, so a
      // root-level file matches) to avoid depending on any subdirectory creation.
      await Bun.write(join(directory, 'basic.example.svelte'), contents);
      return await scan(directory, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  test('a same-line marker does NOT bleed its exemption onto the next line', async () => {
    // Line 1 carries a raw control AND a same-line marker (covers line 1 only).
    // Line 2 carries a raw control with NO marker of its own — it must be flagged.
    // Regression: previously the line-2 control picked up line 1's marker as a
    // "previous-line marker" and was silently exempted.
    const result = await scanFixture(
      [
        `<input type="text" /> <!-- examples-audit-allow: line one is intentional -->`,
        `<input type="text" />`,
      ].join('\n'),
    );

    const allowlistedLines = result.allowlisted.map((occurrence) => occurrence.lineNumber);
    const flaggedLines = result.flagged.map((occurrence) => occurrence.lineNumber);

    expect(allowlistedLines).toEqual([1]);
    expect(flaggedLines).toEqual([2]);
  });

  test('a standalone marker on its own line still exempts the control below it', async () => {
    const result = await scanFixture(
      [`<!-- examples-audit-allow: native control needed here -->`, `<input type="text" />`].join(
        '\n',
      ),
    );

    expect(result.flagged).toHaveLength(0);
    expect(result.allowlisted.map((occurrence) => occurrence.lineNumber)).toEqual([2]);
  });
});
