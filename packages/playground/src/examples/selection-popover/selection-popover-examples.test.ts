/**
 * Regression tests for the selection-popover playground examples.
 *
 * These tests read the actual example source files and assert structural
 * invariants that prevent the page from scattering multiple open popovers
 * across the viewport on load — the original bug that prompted this suite.
 *
 * Why source-text analysis instead of mounting?
 *
 *   Mounting all five examples simultaneously would reproduce the exact problem
 *   we are guarding against: multiple popovers visible at once. Source analysis
 *   lets us precisely assert the invariant ("no hardcoded open=true at the
 *   SelectionPopover call site") without a browser and without the complexity
 *   of mounting five competing top-layer elements. The pattern being caught here
 *   (a bare `open` attribute directly on the component in source) is a
 *   deterministic textual artifact, not a runtime-only condition.
 */

import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

const EXAMPLES_DIR = join(import.meta.dir);

/** Read an example file relative to this test's directory. */
async function readExample(filename: string): Promise<string> {
  return Bun.file(join(EXAMPLES_DIR, filename)).text();
}

/**
 * Return all `<SelectionPopover` JSX/Svelte call sites from a source string,
 * as raw attribute blocks. Each entry is the substring from `<SelectionPopover`
 * through the matching `/>`.
 *
 * The tag name must be followed by a non-word character (whitespace or `/`)
 * so that `<SelectionPopoverPosition` (a TypeScript type) is not matched.
 */
function extractSelectionPopoverSites(source: string): string[] {
  const sites: string[] = [];
  // Match `<SelectionPopover` followed by a non-word char (space, newline, /).
  const tagPattern = /<SelectionPopover(?=[\s/])/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(source)) !== null) {
    const start = match.index;
    // Capture through the self-closing tag end `/>`.
    const end = source.indexOf('/>', start);
    if (end === -1) break;
    sites.push(source.slice(start, end + 2));
    // Advance past this tag so we don't re-scan it.
    tagPattern.lastIndex = end + 2;
  }

  return sites;
}

/**
 * Return true when the call-site text carries a hardcoded-open attribute —
 * either the bare boolean `open` or the explicit `open={true}`.
 *
 * A binding like `open={isOpen}` or `open={someVariable}` is NOT matched,
 * because those are driven by state that starts as `false`.
 */
function hasHardcodedOpen(site: string): boolean {
  // Bare `open` attribute: preceded by whitespace, followed by whitespace,
  // `/`, or `>` — NOT followed by `=`.
  if (/\bopen(?!\s*=)/.test(site)) return true;
  // Explicit true literal: open={true}
  if (/open=\{true\}/.test(site)) return true;
  return false;
}

const EXAMPLE_FILES = [
  'basic.example.svelte',
  'keyboard.example.svelte',
  'null-position.example.svelte',
  'toggled.example.svelte',
  'viewport-clamping.example.svelte',
];

describe('selection-popover examples — no default-open popovers on load', () => {
  for (const filename of EXAMPLE_FILES) {
    it(`${filename} renders 0 open SelectionPopovers before any interaction`, async () => {
      const source = await readExample(filename);
      const sites = extractSelectionPopoverSites(source);

      // Every example must contain at least one SelectionPopover call site.
      expect(sites.length).toBeGreaterThan(0);

      // None of those call sites may carry a hardcoded open attribute —
      // all open states must be driven by reactive state that starts false/null.
      const defaultOpenSites = sites.filter(hasHardcodedOpen);
      expect(defaultOpenSites).toHaveLength(0);
    });
  }
});

describe('selection-popover examples — source analysis helpers (unit)', () => {
  it('extractSelectionPopoverSites finds all call sites', () => {
    const source = [
      '<SelectionPopover id="a" open={isOpen} />',
      '<SelectionPopover id="b" position={pos} />',
    ].join('\n');
    expect(extractSelectionPopoverSites(source)).toHaveLength(2);
  });

  it('hasHardcodedOpen detects bare open attribute', () => {
    expect(hasHardcodedOpen('<SelectionPopover id="x" open position={{x:0,y:0}} />')).toBe(true);
  });

  it('hasHardcodedOpen detects explicit open={true}', () => {
    expect(hasHardcodedOpen('<SelectionPopover id="x" open={true} />')).toBe(true);
  });

  it('hasHardcodedOpen does not flag open={isOpen} (state-driven)', () => {
    expect(hasHardcodedOpen('<SelectionPopover id="x" open={isOpen} />')).toBe(false);
  });

  it('hasHardcodedOpen does not flag open={showClamping} (state-driven)', () => {
    expect(hasHardcodedOpen('<SelectionPopover id="x" open={showClamping} />')).toBe(false);
  });

  it('hasHardcodedOpen does not flag a site with no open attribute', () => {
    expect(hasHardcodedOpen('<SelectionPopover id="x" position={pos} />')).toBe(false);
  });
});
