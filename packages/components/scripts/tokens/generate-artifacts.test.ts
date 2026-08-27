/**
 * Regression tests for the CIN-30 review round targeting `generate-artifacts.ts`.
 *
 *   - B1: `validatePlaygroundColorTokenGroups` must reject a `playgroundGroups`
 *     member whose `cssProperty` resolves to a real corpus token that is NOT
 *     `category: "color"` -- an existence-only check waves through something
 *     valid-but-wrong like `--cinder-space-4`, and the generated color panel
 *     then offers a color picker for a spacing property.
 *   - B2: `renderDocTable` must normalize a `$description` containing a
 *     newline before interpolating it into a Markdown table cell -- raw
 *     sanitization only escapes `|`, so an embedded newline breaks the row.
 *
 * None of these fixtures touch the real corpus under `src/tokens/`, so a fix
 * here can never change what `tokens:generate` emits for the committed
 * files (docs/tokens.md's real $description text has no newline in it --
 * see `completeness.test.ts`'s sibling `registry.test.ts`/`generate.test.ts`
 * files for the equivalent "this fixture is synthetic" note).
 */

import { describe, expect, test } from 'bun:test';

import {
  type DocSection,
  type PlaygroundColorTokenGroup,
  renderDocTable,
  validatePlaygroundColorTokenGroups,
} from './generate-artifacts.ts';
import type { CorpusEntry } from './generate.ts';
import { buildTokenRegistryFromIndexes } from './registry.ts';

describe('B1: validatePlaygroundColorTokenGroups requires category: "color"', () => {
  test('rejects a valid-but-non-color cssProperty instead of waving it through', () => {
    const baseIndex = new Map<string, CorpusEntry>([
      [
        'space.4',
        {
          path: 'space.4',
          value: { value: 1, unit: 'rem' },
          type: 'dimension',
          description: undefined,
          cssProperty: '--test-space-4',
          cssRecipe: undefined,
          public: true,
          category: 'space',
          component: undefined,
          deprecated: undefined,
        },
      ],
    ]);
    const registry = buildTokenRegistryFromIndexes(baseIndex, new Set());

    const groups: readonly PlaygroundColorTokenGroup[] = [
      {
        id: 'test-group',
        label: 'Test group',
        tokens: [{ name: '--test-space-4', label: 'Space 4' }],
      },
    ];

    // Pre-fix, the only check was "does cssPropertyToPath know this
    // property" -- true here, since --test-space-4 is a real corpus token --
    // so this call returned normally instead of throwing.
    expect(() => validatePlaygroundColorTokenGroups(groups, registry)).toThrow(
      /not category: "color" tokens: --test-space-4/,
    );
  });

  test('still accepts a real category: "color" token', () => {
    const baseIndex = new Map<string, CorpusEntry>([
      [
        'accent',
        {
          path: 'accent',
          value: { colorSpace: 'oklch', components: [0.6, 0.12, 20] },
          type: 'color',
          description: undefined,
          cssProperty: '--test-accent',
          cssRecipe: undefined,
          public: true,
          category: 'color',
          component: undefined,
          deprecated: undefined,
        },
      ],
    ]);
    const registry = buildTokenRegistryFromIndexes(baseIndex, new Set());

    const groups: readonly PlaygroundColorTokenGroup[] = [
      {
        id: 'test-group',
        label: 'Test group',
        tokens: [{ name: '--test-accent', label: 'Accent' }],
      },
    ];

    expect(() => validatePlaygroundColorTokenGroups(groups, registry)).not.toThrow();
  });
});

describe('B2: renderDocTable normalizes a newline in $description', () => {
  test('a description containing a newline stays on one table row', async () => {
    const section: DocSection = {
      slug: 'test-section',
      heading: 'Test section',
      cssProperties: ['--test-token'],
    };
    const entry: CorpusEntry = {
      path: 'test.token',
      value: { value: 1, unit: 'rem' },
      type: 'dimension',
      description: 'Line one.\nLine two.',
      cssProperty: '--test-token',
      cssRecipe: undefined,
    };
    const baseIndex = new Map<string, CorpusEntry>([[entry.path, entry]]);

    const table = await renderDocTable(section, baseIndex, (value) => value);

    // Pre-fix: sanitization only escaped `|`, so the raw newline is
    // interpolated straight into the row, and the second line ("Line two. |")
    // is no longer prefixed by `|`, so it is not part of any table row --
    // splitting one token's row into a malformed fragment.
    expect(table).not.toContain('Line one.\nLine two.');
    const rowLines = table.split('\n').filter((line) => line.includes('--test-token'));
    expect(rowLines).toHaveLength(1);
    expect(rowLines[0]).toContain('Line one. Line two.');
  });

  test('a lone \\r (not just \\n or \\r\\n) is also normalized', async () => {
    // CommonMark treats a bare "\r" as a line ending on its own, just like
    // "\n" and "\r\n" -- a fix that only matches the regex character class
    // `\n` would miss this case and still truncate the table on an
    // old-Mac-style line break.
    const section: DocSection = {
      slug: 'test-section-cr',
      heading: 'Test section',
      cssProperties: ['--test-token-cr'],
    };
    const entry: CorpusEntry = {
      path: 'test.token.cr',
      value: { value: 1, unit: 'rem' },
      type: 'dimension',
      description: 'Line one.\rLine two.',
      cssProperty: '--test-token-cr',
      cssRecipe: undefined,
    };
    const baseIndex = new Map<string, CorpusEntry>([[entry.path, entry]]);

    const table = await renderDocTable(section, baseIndex, (value) => value);
    const rowLines = table.split('\n').filter((line) => line.includes('--test-token-cr'));
    expect(rowLines).toHaveLength(1);
    expect(rowLines[0]).toContain('Line one. Line two.');
  });
});
