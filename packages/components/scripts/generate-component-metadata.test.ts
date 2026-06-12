/**
 * Unit tests for the `@cinder` metadata extractor.
 *
 * All tests use inline Svelte source fixtures — no filesystem access required.
 * The pure `extractFromSource` function is tested directly so that error cases
 * are exercised without needing real component directories.
 */

import { describe, expect, it } from 'bun:test';

import { categories, statusLevels } from '../src/manifest.meta.ts';
import { extractFromSource } from './generate-component-metadata.ts';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Wrap a JSDoc comment and optional body into a minimal Svelte module block. */
function moduleScript(jsDoc: string, body = ''): string {
  return `<script lang="ts" module>\n${jsDoc}\n${body}\n</script>`;
}

/** Wrap module script into a minimal Svelte file (no instance script). */
function svelteFile(moduleContent: string): string {
  return `${moduleContent}\n\n<div>component</div>`;
}

const COMPONENT_ID = 'test-component';
const FILE_PATH = '/fake/test-component/test-component.svelte';

function extract(source: string) {
  return extractFromSource(source, COMPONENT_ID, FILE_PATH, false);
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('happy path', () => {
  it('extracts all fields from a well-formed module block', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose Primary interactive control for triggering actions or navigating via href.
 * @tag action
 * @tag cta
 * @useWhen Triggering an action (submit, save, delete).
 * @useWhen Anchor that should look like a button (pass href).
 * @avoidWhen Toggling on/off state. | toggle
 * @avoidWhen Selecting from a fixed set of mutually exclusive options.
 * @related button-group, copy-button
 */
export type { ButtonProps } from './button.types.ts';
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');

    const { metadata } = result;
    expect(metadata.id).toBe(COMPONENT_ID);
    expect(metadata.isExperimental).toBe(false);
    expect(metadata.category).toBe('action');
    expect(metadata.status).toBe('stable');
    expect(metadata.purpose).toBe(
      'Primary interactive control for triggering actions or navigating via href.',
    );
    expect(metadata.tags).toEqual(['action', 'cta']);
    expect(metadata.useWhen).toEqual([
      'Triggering an action (submit, save, delete).',
      'Anchor that should look like a button (pass href).',
    ]);
    expect(metadata.avoidWhen).toEqual([
      { reason: 'Toggling on/off state.', alternative: 'toggle' },
      { reason: 'Selecting from a fixed set of mutually exclusive options.' },
    ]);
    expect(metadata.related).toEqual(['button-group', 'copy-button']);
    expect(metadata.a11y).toBeUndefined();
  });

  it('returns isExperimental=true when passed true', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category form
 * @status alpha
 * @purpose Experimental color picker widget.
 */
`),
    );

    const result = extractFromSource(source, 'color-picker', FILE_PATH, true);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.isExperimental).toBe(true);
  });

  it('returns empty arrays for optional fields when omitted', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category layout
 * @status stable
 * @purpose Structural container for page-level content.
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.tags).toEqual([]);
    expect(result.metadata.useWhen).toEqual([]);
    expect(result.metadata.avoidWhen).toEqual([]);
    expect(result.metadata.related).toEqual([]);
  });

  it('handles Svelte 4 context="module" attribute syntax', () => {
    const source = `<script context="module" lang="ts">
/**
 * @cinder
 * @category feedback
 * @status beta
 * @purpose Non-interactive status indicator.
 */
</script>
<div></div>`;

    const result = extract(source);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.category).toBe('feedback');
  });

  it('ignores prose before @cinder in the JSDoc block', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * This component does things.
 * It has some prose here.
 *
 * @cinder
 * @category navigation
 * @status stable
 * @purpose Navigation control.
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.category).toBe('navigation');
  });

  it('ignores unknown tags inside the @cinder block (forward-compat)', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category data-display
 * @status stable
 * @purpose Displays tabular data.
 * @futureTag somevalue
 * @anotherUnknown foo bar
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Multi-line tag continuation
// ---------------------------------------------------------------------------

describe('multi-line tag continuation', () => {
  it('joins @purpose lines across multiple JSDoc continuation lines', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose A very detailed purpose description that wraps
 *   across multiple lines in the JSDoc comment block.
 * @tag action
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.purpose).toBe(
      'A very detailed purpose description that wraps across multiple lines in the JSDoc comment block.',
    );
  });

  it('joins @useWhen lines when they wrap', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category form
 * @status stable
 * @purpose Collects free-form text input.
 * @useWhen You need a short single-line text field
 *   for names, email addresses, or similar fields.
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.useWhen[0]).toBe(
      'You need a short single-line text field for names, email addresses, or similar fields.',
    );
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('error: missing module script block', () => {
  it('returns error when no module script block is present', () => {
    const source = `<script lang="ts">
let x = 1;
</script>
<div></div>`;

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('no module script block found');
  });

  it('returns error when no script blocks at all', () => {
    const source = `<div>Hello</div>`;
    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('no module script block found');
  });
});

describe('error: duplicate module script block', () => {
  it('returns error when two module blocks are present', () => {
    const source = `<script lang="ts" module>
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose First block.
 */
</script>
<script lang="ts" module>
/**
 * @cinder
 * @category layout
 * @status stable
 * @purpose Second block.
 */
</script>
<div></div>`;

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('duplicate module script blocks');
  });
});

describe('error: missing @cinder tag', () => {
  it('returns error when JSDoc exists but has no @cinder tag', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * This component exports some types.
 * @internal
 */
export type { ButtonProps } from './button.types.ts';
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('no @cinder metadata header found');
  });

  it('returns error when there is no JSDoc at all in the module block', () => {
    const source = svelteFile(
      moduleScript(`
export type { ButtonProps } from './button.types.ts';
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('no @cinder metadata header found');
  });

  it('appends an inline fix hint pointing at AGENTS.md for the missing @cinder block', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * This component exports some types.
 * @internal
 */
export type { ButtonProps } from './button.types.ts';
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain(
      'Add @cinder as the first tag in the <script lang="ts" module> JSDoc block',
    );
    expect(result.error.reason).toContain('AGENTS.md §The five analyzer conventions');
  });
});

describe('error: missing required tags', () => {
  it('returns error listing all missing required tags', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @tag action
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('missing required tags');
    expect(result.error.reason).toContain('@category');
    expect(result.error.reason).toContain('@status');
    expect(result.error.reason).toContain('@purpose');
  });

  it('returns error for only the missing required tags (partial)', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    // The appended minimal-block fix snippet always lists all three tags, so
    // the missing-list correctness guard must scope to the "missing required
    // tags:" prefix (everything before the "\n  Fix:" marker) rather than the
    // whole message. Split on the marker and assert the prefix enumerates ONLY
    // the genuinely-missing tag and does not spuriously list present ones.
    const prefix = result.error.reason.split('\n  Fix:')[0];
    expect(prefix).toContain('@purpose');
    expect(prefix).not.toContain('@category');
    expect(prefix).not.toContain('@status');
    expect(result.error.reason).toContain('the minimal block is');
  });

  it('appends the minimal @cinder block snippet as an inline fix', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @tag action
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('the minimal block is');
    expect(result.error.reason).toContain('@cinder');
    expect(result.error.reason).toContain('@category');
    expect(result.error.reason).toContain('@status');
    expect(result.error.reason).toContain('@purpose');
  });
});

describe('error: unknown category id', () => {
  it('returns error with the offending category id', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category navigaton
 * @status stable
 * @purpose Navigation item.
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain("unknown category 'navigaton'");
    // Should include did-you-mean hint for 'navigation'.
    expect(result.error.reason).toContain('navigation');
  });

  it('returns error for a completely wrong category', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category widgets
 * @status stable
 * @purpose Some component.
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain("unknown category 'widgets'");
  });

  it('lists every valid category inline', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category widgets
 * @status stable
 * @purpose Some component.
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('Valid values:');
    for (const category of Object.keys(categories)) {
      expect(result.error.reason).toContain(category);
    }
  });
});

describe('error: unknown status id', () => {
  it('returns error with the offending status id', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status released
 * @purpose Some action component.
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain("unknown status 'released'");
  });

  it('lists every valid status inline', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status released
 * @purpose Some action component.
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('Valid values:');
    for (const status of Object.keys(statusLevels)) {
      expect(result.error.reason).toContain(status);
    }
  });
});

describe('error: PascalCase in @related', () => {
  it('returns error when a @related id contains uppercase letters', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose Primary button.
 * @related ButtonGroup, copy-button
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('ButtonGroup');
    expect(result.error.reason).toContain('kebab-case');
  });

  it('returns error for a single PascalCase related id', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose Primary button.
 * @related CopyButton
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('CopyButton');
  });
});

describe('error: duplicate required tag', () => {
  it('returns error on duplicate @category tag', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @category form
 * @status stable
 * @purpose Some component.
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('duplicate @category tag');
  });

  it('returns error on duplicate @status tag', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @status beta
 * @purpose Some component.
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('duplicate @status tag');
  });

  it('returns error on duplicate @purpose tag', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose First purpose.
 * @purpose Second purpose.
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('duplicate @purpose tag');
  });
});

describe('error: @purpose over 200 characters', () => {
  it('returns error when @purpose exceeds 200 characters', () => {
    const longPurpose = 'A'.repeat(201);
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose ${longPurpose}
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('@purpose exceeds 200 characters');
    expect(result.error.reason).toContain('201');
  });

  it('accepts a @purpose of exactly 200 characters', () => {
    const exactPurpose = 'A'.repeat(200);
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose ${exactPurpose}
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(true);
  });
});

describe('error: @useWhen over 140 characters', () => {
  it('returns error when a @useWhen entry exceeds 140 characters', () => {
    const longEntry = 'B'.repeat(141);
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose Short purpose.
 * @useWhen ${longEntry}
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('@useWhen entry exceeds 140 characters');
    expect(result.error.reason).toContain('141');
  });

  it('accepts a @useWhen entry of exactly 140 characters', () => {
    const exactEntry = 'B'.repeat(140);
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose Short purpose.
 * @useWhen ${exactEntry}
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(true);
  });

  it('returns error when a @avoidWhen reason exceeds 140 characters', () => {
    const longEntry = 'C'.repeat(141);
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose Short purpose.
 * @avoidWhen ${longEntry}
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('@avoidWhen reason exceeds 140 characters');
  });
});

describe('@avoidWhen structured parsing', () => {
  function extractAvoidWhen(avoidWhenLines: string[]) {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose Short purpose.
${avoidWhenLines.map((line) => ` * @avoidWhen ${line}`).join('\n')}
 */
`),
    );
    return extract(source);
  }

  it('parses a reason-only entry (no pipe) into { reason }', () => {
    const result = extractAvoidWhen(['Some plain reason with no alternative.']);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.avoidWhen).toEqual([
      { reason: 'Some plain reason with no alternative.' },
    ]);
  });

  it('splits on the first " | " and keeps a kebab alternative', () => {
    const result = extractAvoidWhen(['Switching between views. | tabs']);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.avoidWhen).toEqual([
      { reason: 'Switching between views.', alternative: 'tabs' },
    ]);
  });

  it('rejects an empty reason', () => {
    const result = extractAvoidWhen([' | tabs']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('@avoidWhen reason must be non-empty');
  });

  it('rejects an empty alternative after a pipe', () => {
    const result = extractAvoidWhen(['A reason here. | ']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('@avoidWhen alternative is empty');
  });

  it('rejects a non-kebab alternative', () => {
    const result = extractAvoidWhen(['A reason here. | SegmentedControl']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('must be a kebab-case component id');
  });
});

describe('a11y metadata', () => {
  function extractA11y(lines: string[]) {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category data-display
 * @status stable
 * @purpose Short purpose.
${lines.map((line) => ` * ${line}`).join('\n')}
 */
`),
    );
    return extract(source);
  }

  it('parses @a11yPattern, @keyboardShortcut and @a11yNote', () => {
    const result = extractA11y([
      '@a11yPattern WAI-ARIA Accordion',
      '@keyboardShortcut Enter / Space | Toggles the focused panel.',
      '@keyboardShortcut Tab | Moves focus to the next element.',
      '@a11yNote Triggers expose aria-expanded.',
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.a11y).toEqual({
      pattern: 'WAI-ARIA Accordion',
      keyboard: [
        { keys: 'Enter / Space', action: 'Toggles the focused panel.' },
        { keys: 'Tab', action: 'Moves focus to the next element.' },
      ],
      notes: ['Triggers expose aria-expanded.'],
    });
  });

  it('leaves a11y undefined when no a11y tags are present', () => {
    const result = extractA11y([]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.a11y).toBeUndefined();
  });

  it('rejects a duplicate @a11yPattern', () => {
    const result = extractA11y(['@a11yPattern One', '@a11yPattern Two']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('duplicate @a11yPattern');
  });

  it('rejects a @keyboardShortcut missing the " | " separator', () => {
    const result = extractA11y(['@keyboardShortcut Enter toggles the panel']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain("missing the '|' separator");
  });

  it('rejects a @keyboardShortcut with an empty half', () => {
    const result = extractA11y(['@keyboardShortcut Enter | ']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('must both be non-empty');
  });

  it('rejects an empty @a11yNote', () => {
    const result = extractA11y(['@a11yNote']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.reason).toContain('@a11yNote must be non-empty');
  });
});

// ---------------------------------------------------------------------------
// @related parsing
// ---------------------------------------------------------------------------

describe('@related parsing', () => {
  it('parses comma-separated ids from a single @related line', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose Primary button.
 * @related button-group, copy-button, icon-button
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.related).toEqual(['button-group', 'copy-button', 'icon-button']);
  });

  it('trims whitespace from each @related id', () => {
    const source = svelteFile(
      moduleScript(`
/**
 * @cinder
 * @category action
 * @status stable
 * @purpose Button component.
 * @related  button-group ,  copy-button
 */
`),
    );

    const result = extract(source);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.metadata.related).toEqual(['button-group', 'copy-button']);
  });
});

// ---------------------------------------------------------------------------
// Error metadata fields
// ---------------------------------------------------------------------------

describe('error result fields', () => {
  it('carries the componentId and file path in the error', () => {
    const source = `<div>no script</div>`;
    const result = extractFromSource(source, 'my-widget', '/abs/path/my-widget.svelte', false);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.error.componentId).toBe('my-widget');
    expect(result.error.file).toBe('/abs/path/my-widget.svelte');
  });
});
