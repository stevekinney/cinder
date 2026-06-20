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
 *
 * Also asserts that examples register `selectionchange` via document-level
 * addEventListener (not via onselectionchange on an element), which is the only
 * way the event actually fires in browsers.
 */

import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

const EXAMPLES_DIR = join(import.meta.dir);

/** Read an example file relative to this test's directory. */
async function readExample(filename: string): Promise<string> {
  return Bun.file(join(EXAMPLES_DIR, filename)).text();
}

/**
 * Return all `<SelectionPopover` call sites from a source string, including
 * both self-closing (`<SelectionPopover ... />`) and paired-tag forms
 * (`<SelectionPopover ...>...</SelectionPopover>`).
 *
 * For self-closing tags the captured block runs through `/>`.
 * For paired tags the captured block runs through `</SelectionPopover>`.
 *
 * The tag name must be followed by a non-word character (whitespace or `/`)
 * so that `<SelectionPopoverPosition` (a TypeScript type import) is not matched.
 *
 * Limitation: the regex approach does not parse nested SelectionPopover trees
 * (unusual in practice). Document that limitation here rather than silently
 * missing it.
 */
function extractSelectionPopoverSites(source: string): string[] {
  const sites: string[] = [];
  const tagPattern = /<SelectionPopover(?=[\s/])/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(source)) !== null) {
    const start = match.index;

    // Try self-closing first: look for `/>` before the next `<SelectionPopover`
    // or `</SelectionPopover>`.
    const selfClosingEnd = source.indexOf('/>', start);
    const pairedTagEnd = source.indexOf('</SelectionPopover>', start);

    if (selfClosingEnd !== -1 && (pairedTagEnd === -1 || selfClosingEnd < pairedTagEnd)) {
      // Self-closing: capture through `/>`.
      sites.push(source.slice(start, selfClosingEnd + 2));
      tagPattern.lastIndex = selfClosingEnd + 2;
    } else if (pairedTagEnd !== -1) {
      // Paired tag: capture through `</SelectionPopover>`.
      sites.push(source.slice(start, pairedTagEnd + '</SelectionPopover>'.length));
      tagPattern.lastIndex = pairedTagEnd + '</SelectionPopover>'.length;
    } else {
      // Malformed — stop scanning.
      break;
    }
  }

  return sites;
}

/**
 * Return true when the call-site text carries a hardcoded-open attribute —
 * either the bare boolean `open` or the explicit `open={true}`.
 *
 * A binding like `open={isOpen}` or `open={someVariable}` is NOT matched,
 * because those are driven by state that starts as `false`.
 *
 * Works for both self-closing and paired-tag forms because we capture the
 * entire site (opening tag attributes through closing).
 */
function hasHardcodedOpen(site: string): boolean {
  // Bare `open` attribute: preceded by whitespace, followed by whitespace,
  // `/`, `>`, or end-of-string — NOT followed by `=`.
  if (/(?:^|\s)open(?!\s*=)/.test(site)) return true;
  // Explicit true literal: open={true}
  if (/open=\{true\}/.test(site)) return true;
  return false;
}

/**
 * Return true when the source registers selectionchange at the document level
 * via addEventListener rather than wiring it directly on an element.
 *
 * `selectionchange` is a Document event — attaching it via `onselectionchange`
 * on an HTMLElement never fires in any browser.
 */
function usesDocumentSelectionChange(source: string): boolean {
  return /document\.addEventListener\s*\(\s*['"]selectionchange['"]/.test(source);
}

/**
 * Return true when the source contains `onselectionchange` wired to an element
 * attribute, which is the broken pattern this test guards against.
 */
function hasElementSelectionChange(source: string): boolean {
  return /onselectionchange=/.test(source);
}

const EXAMPLE_FILES = [
  'basic.example.svelte',
  'existing-comments.example.svelte',
  'keyboard.example.svelte',
  'null-position.example.svelte',
  'toggled.example.svelte',
  'viewport-clamping.example.svelte',
];

/**
 * Examples that drive open/close from a text selection must listen at the
 * document level. Examples that use only button-driven triggers do not need
 * a selectionchange listener at all.
 */
const SELECTION_DRIVEN_EXAMPLES = [
  'basic.example.svelte',
  'existing-comments.example.svelte',
  'keyboard.example.svelte',
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

describe('selection-popover examples — selectionchange wired at document level', () => {
  for (const filename of SELECTION_DRIVEN_EXAMPLES) {
    it(`${filename} registers selectionchange on document, not on an element`, async () => {
      const source = await readExample(filename);

      // Must use document.addEventListener('selectionchange', ...) —
      // the only form that actually fires in browsers.
      expect(usesDocumentSelectionChange(source)).toBe(true);

      // Must NOT use the onselectionchange element attribute —
      // that pattern silently never fires.
      expect(hasElementSelectionChange(source)).toBe(false);
    });
  }

  it('non-selection-driven examples do not accidentally use the broken pattern', async () => {
    const nonSelectionExamples = EXAMPLE_FILES.filter(
      (f) => !SELECTION_DRIVEN_EXAMPLES.includes(f),
    );
    for (const filename of nonSelectionExamples) {
      const source = await readExample(filename);
      expect(hasElementSelectionChange(source)).toBe(false);
    }
  });
});

describe('selection-popover examples — button-triggered anchors', () => {
  it('null-position example derives its anchor from the rendered trigger', async () => {
    const source = await readExample('null-position.example.svelte');

    expect(source).toContain('bind:this={anchorElement}');
    expect(source).toContain('anchorElement.getBoundingClientRect()');
    expect(source).not.toContain('demonstrationPosition');
    expect(source).not.toContain('{ x: 220, y: 220 }');
  });
});

describe('selection-popover examples — source analysis helpers (unit)', () => {
  it('extractSelectionPopoverSites finds self-closing call sites', () => {
    const source = [
      '<SelectionPopover id="a" open={isOpen} />',
      '<SelectionPopover id="b" position={pos} />',
    ].join('\n');
    expect(extractSelectionPopoverSites(source)).toHaveLength(2);
  });

  it('extractSelectionPopoverSites finds paired-tag call sites', () => {
    const source = '<SelectionPopover id="a" open={isOpen}>Some child content</SelectionPopover>';
    const sites = extractSelectionPopoverSites(source);
    expect(sites).toHaveLength(1);
    expect(sites[0]).toContain('Some child content');
  });

  it('extractSelectionPopoverSites handles a mix of self-closing and paired-tag sites', () => {
    const source = [
      '<SelectionPopover id="a" open={isOpen} />',
      '<SelectionPopover id="b" open={isOpen}>Child</SelectionPopover>',
    ].join('\n');
    expect(extractSelectionPopoverSites(source)).toHaveLength(2);
  });

  it('extractSelectionPopoverSites does not match type imports like SelectionPopoverPosition', () => {
    const source = `
      import type { SelectionPopoverPosition } from '@lostgradient/cinder/selection-popover';
      <SelectionPopover id="a" open={isOpen} />
    `;
    expect(extractSelectionPopoverSites(source)).toHaveLength(1);
  });

  it('hasHardcodedOpen detects bare open attribute (self-closing)', () => {
    expect(hasHardcodedOpen('<SelectionPopover id="x" open position={{x:0,y:0}} />')).toBe(true);
  });

  it('hasHardcodedOpen detects explicit open={true} (self-closing)', () => {
    expect(hasHardcodedOpen('<SelectionPopover id="x" open={true} />')).toBe(true);
  });

  it('hasHardcodedOpen detects bare open attribute on paired-tag form', () => {
    expect(hasHardcodedOpen('<SelectionPopover id="x" open>Child</SelectionPopover>')).toBe(true);
  });

  it('hasHardcodedOpen detects explicit open={true} on paired-tag form', () => {
    expect(hasHardcodedOpen('<SelectionPopover id="x" open={true}>Child</SelectionPopover>')).toBe(
      true,
    );
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

  it('usesDocumentSelectionChange detects document.addEventListener pattern', () => {
    expect(
      usesDocumentSelectionChange(
        "document.addEventListener('selectionchange', handleSelectionChange);",
      ),
    ).toBe(true);
  });

  it('usesDocumentSelectionChange returns false for element attribute wiring', () => {
    expect(usesDocumentSelectionChange('<article onselectionchange={handleSelectionChange}>')).toBe(
      false,
    );
  });

  it('hasElementSelectionChange detects the broken element attribute pattern', () => {
    expect(hasElementSelectionChange('<article onselectionchange={handleSelectionChange}>')).toBe(
      true,
    );
  });

  it('hasElementSelectionChange returns false for document.addEventListener', () => {
    expect(
      hasElementSelectionChange(
        "document.addEventListener('selectionchange', handleSelectionChange);",
      ),
    ).toBe(false);
  });
});
