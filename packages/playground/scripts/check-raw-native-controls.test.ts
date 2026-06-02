import { describe, expect, test } from 'bun:test';

import {
  ALLOWLIST,
  allowlistKey,
  buildAllowlistIndex,
  detectRawControl,
  RAW_CONTROL_TAG_NAMES,
  renderReport,
  scan,
  toPosixPath,
  type AllowlistEntry,
  type RawControlOccurrence,
} from './check-raw-native-controls.ts';

// ── detectRawControl ───────────────────────────────────────────────────────────

describe('detectRawControl — raw tag detection', () => {
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
  test('builds a stable file::line key', () => {
    expect(allowlistKey('navigation-bar/basic.example.svelte', 20)).toBe(
      'navigation-bar/basic.example.svelte::20',
    );
  });

  test('normalizes backslashes in the path component', () => {
    expect(allowlistKey('navigation-bar\\basic.example.svelte', 20)).toBe(
      'navigation-bar/basic.example.svelte::20',
    );
  });
});

// ── buildAllowlistIndex ────────────────────────────────────────────────────────

describe('buildAllowlistIndex — fast lookup set', () => {
  const entries: AllowlistEntry[] = [
    {
      relativePath: 'navigation-bar/basic.example.svelte',
      lineNumber: 20,
      reason: 'receives forwarded attrs from NavigationBar menuToggle snippet',
    },
    {
      relativePath: 'popover/transformed-ancestor.example.svelte',
      lineNumber: 33,
      reason: 'uses bind:this for triggerRef — requires a native HTMLButtonElement',
    },
  ];

  test('contains an entry for each allowlisted file+line', () => {
    const index = buildAllowlistIndex(entries);
    expect(index.has('navigation-bar/basic.example.svelte::20')).toBe(true);
    expect(index.has('popover/transformed-ancestor.example.svelte::33')).toBe(true);
  });

  test('does not contain a key for a different line on an allowlisted file', () => {
    const index = buildAllowlistIndex(entries);
    expect(index.has('navigation-bar/basic.example.svelte::99')).toBe(false);
  });

  test('does not contain a key for an entirely different file', () => {
    const index = buildAllowlistIndex(entries);
    expect(index.has('button/basic.example.svelte::20')).toBe(false);
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

  test('every entry has a positive line number', () => {
    for (const entry of ALLOWLIST) {
      expect(entry.lineNumber).toBeGreaterThan(0);
    }
  });
});

// ── renderReport ───────────────────────────────────────────────────────────────

describe('renderReport — human-readable output', () => {
  const makeOccurrence = (overrides: Partial<RawControlOccurrence> = {}): RawControlOccurrence => ({
    relativePath: 'button/basic.example.svelte',
    lineNumber: 12,
    tagName: 'button',
    lineText: '<button type="button">Click</button>',
    ...overrides,
  });

  test('includes the total count in the header', () => {
    const result = {
      allowlisted: [makeOccurrence()],
      flagged: [makeOccurrence({ relativePath: 'inline/basic.example.svelte', lineNumber: 11 })],
    };
    const report = renderReport(result);
    expect(report).toContain('Total raw controls found: 2');
    expect(report).toContain('1 flagged');
    expect(report).toContain('1 allowlisted');
  });

  test('reports zero flagged when all controls are allowlisted', () => {
    const result = { allowlisted: [makeOccurrence()], flagged: [] };
    const report = renderReport(result);
    expect(report).toContain('Flagged: none');
  });

  test('includes relative path and line number for flagged items', () => {
    const result = {
      allowlisted: [],
      flagged: [makeOccurrence({ relativePath: 'inline/basic.example.svelte', lineNumber: 11 })],
    };
    const report = renderReport(result);
    expect(report).toContain('inline/basic.example.svelte:11');
  });

  test('includes <tagName> in the rendered line', () => {
    const result = { allowlisted: [], flagged: [makeOccurrence({ tagName: 'input' })] };
    const report = renderReport(result);
    expect(report).toContain('<input>');
  });
});

// ── scan — integration against real example files ──────────────────────────────

describe('scan — live inventory against the real examples directory', () => {
  // scan() walks the real examples tree; give it generous headroom on slow CI.
  test('returns a ScanResult with allowlisted and flagged arrays', async () => {
    const examplesDirectory = new URL('../src/examples', import.meta.url).pathname;
    const result = await scan(examplesDirectory);

    // Both arrays must be present (possibly empty).
    expect(Array.isArray(result.allowlisted)).toBe(true);
    expect(Array.isArray(result.flagged)).toBe(true);
  }, 15_000);

  test('detects at least one raw control across all example files', async () => {
    const examplesDirectory = new URL('../src/examples', import.meta.url).pathname;
    const result = await scan(examplesDirectory);
    const total = result.allowlisted.length + result.flagged.length;
    // We know from the current state there are 18 raw control lines.
    expect(total).toBeGreaterThan(0);
  }, 15_000);

  test('does NOT flag the navigation-bar menuToggle button (it is allowlisted)', async () => {
    const examplesDirectory = new URL('../src/examples', import.meta.url).pathname;
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
    const examplesDirectory = new URL('../src/examples', import.meta.url).pathname;
    const result = await scan(examplesDirectory);

    const popoverFlagged = result.flagged.filter(
      (occurrence) => occurrence.relativePath === 'popover/transformed-ancestor.example.svelte',
    );
    expect(popoverFlagged).toHaveLength(0);
  }, 15_000);

  test('every returned occurrence has a positive lineNumber and a non-empty relativePath', async () => {
    const examplesDirectory = new URL('../src/examples', import.meta.url).pathname;
    const result = await scan(examplesDirectory);

    for (const occurrence of [...result.allowlisted, ...result.flagged]) {
      expect(occurrence.lineNumber).toBeGreaterThan(0);
      expect(occurrence.relativePath.length).toBeGreaterThan(0);
      expect(RAW_CONTROL_TAG_NAMES).toContain(occurrence.tagName);
    }
  }, 15_000);

  test('respects a custom empty allowlist (nothing is allowlisted)', async () => {
    const examplesDirectory = new URL('../src/examples', import.meta.url).pathname;
    const result = await scan(examplesDirectory, []);
    // With an empty allowlist all occurrences land in flagged.
    expect(result.allowlisted).toHaveLength(0);
    expect(result.flagged.length).toBeGreaterThan(0);
  }, 15_000);

  test('results are sorted by relativePath then lineNumber', async () => {
    const examplesDirectory = new URL('../src/examples', import.meta.url).pathname;
    const result = await scan(examplesDirectory);
    const all = [...result.allowlisted, ...result.flagged];
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
    // Suppress unused variable warning from the spread above.
    void all;
  }, 15_000);
});
