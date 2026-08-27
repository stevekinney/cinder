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
  buildTokensDocMarkdown,
  readPlaygroundColorTokenGroups,
  renderDocTable,
  validatePlaygroundColorTokenGroups,
} from './generate-artifacts.ts';
import type { CorpusEntry } from './generate.ts';
import { buildTokenRegistryFromIndexes } from './registry.ts';
import type { ResolverDocument } from './types.ts';

function resolverWithExtensions(extensions: Record<string, unknown>): ResolverDocument {
  return {
    version: '2025.10',
    sets: {
      foundation: {
        sources: [{ $ref: 'sets/foundation.tokens.json' }],
        $extensions: { 'com.lostgradient.cinder': extensions },
      },
    },
    modifiers: {},
    resolutionOrder: [{ $ref: '#/sets/foundation' }],
  } as ResolverDocument;
}

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

describe('CIN-30 review round 2', () => {
  function colorEntry(path: string, cssProperty: string): [string, CorpusEntry] {
    return [
      path,
      {
        path,
        value: { colorSpace: 'oklch', components: [0.5, 0.1, 250] },
        type: 'color',
        description: undefined,
        cssProperty,
        cssRecipe: undefined,
        public: true,
        category: 'color',
        component: undefined,
        deprecated: undefined,
      },
    ];
  }

  test('a document-level $root token is found by membership, not truthiness', () => {
    // `collectEntries` gives a document-level `$root` token the path "" -- a shape
    // resolve.test.ts supports. An empty string is falsy, so the pre-fix
    // `if (!path)` reported this legitimately-present token as unknown and threw
    // "references cssProperties that are not in the corpus".
    const baseIndex = new Map<string, CorpusEntry>([colorEntry('', '--test-root')]);
    const registry = buildTokenRegistryFromIndexes(baseIndex, new Set<string>());

    expect(registry.cssPropertyToPath['--test-root']).toBe('');

    const groups: readonly PlaygroundColorTokenGroup[] = [
      { id: 'roots', label: 'Roots', tokens: [{ name: '--test-root', label: 'Root' }] },
    ];
    expect(() => validatePlaygroundColorTokenGroups(groups, registry)).not.toThrow();
  });

  test('a blank or whitespace-only label is rejected rather than reaching the UI', () => {
    // Pre-fix these passed a bare `typeof === "string"` check and were emitted into
    // the generated registry, leaving a nameless section or colour control.
    const withBlankGroupLabel = {
      playgroundGroups: [
        { id: 'g', label: '   ', members: [{ cssProperty: '--test-accent', label: 'Accent' }] },
      ],
    };
    expect(() =>
      readPlaygroundColorTokenGroups(resolverWithExtensions(withBlankGroupLabel)),
    ).toThrow();

    const withBlankMemberLabel = {
      playgroundGroups: [
        { id: 'g', label: 'Group', members: [{ cssProperty: '--test-accent', label: '' }] },
      ],
    };
    expect(() =>
      readPlaygroundColorTokenGroups(resolverWithExtensions(withBlankMemberLabel)),
    ).toThrow();
  });
});

describe('CIN-30 review round 3', () => {
  test('a group id containing whitespace is rejected before it reaches aria-labelledby', () => {
    // color-token-panel.svelte interpolates the id into both `id=` and
    // `aria-labelledby`, and aria-labelledby parses whitespace as an
    // ID-reference SEPARATOR -- so "status solid" would leave the section
    // unnamed to assistive technology rather than failing visibly.
    const withSpacedId = {
      playgroundGroups: [
        {
          id: 'status solid',
          label: 'Status',
          members: [{ cssProperty: '--test-accent', label: 'Accent' }],
        },
      ],
    };
    expect(() => readPlaygroundColorTokenGroups(resolverWithExtensions(withSpacedId))).toThrow();

    const withBlankId = {
      playgroundGroups: [
        { id: '   ', label: 'Status', members: [{ cssProperty: '--test-accent', label: 'A' }] },
      ],
    };
    expect(() => readPlaygroundColorTokenGroups(resolverWithExtensions(withBlankId))).toThrow();
  });

  test('a pipe in a serialized value is escaped so the table row stays well-formed', async () => {
    // GFM treats `|` as a column delimiter even inside a backtick code span, so
    // a fontFamily whose family name contains one would commit a malformed row
    // that the drift parser still reads back successfully.
    const baseIndex = new Map<string, CorpusEntry>([
      [
        'font.piped',
        {
          path: 'font.piped',
          value: ['A|B'],
          type: 'fontFamily',
          description: 'A piped family.',
          cssProperty: '--test-font-piped',
          cssRecipe: undefined,
          public: true,
          category: 'typography',
          component: undefined,
          deprecated: undefined,
        },
      ],
    ]);
    const section: DocSection = {
      slug: 'piped',
      heading: 'Piped',
      cssProperties: ['--test-font-piped'],
    };
    const table = await renderDocTable(section, baseIndex, (value) => value);

    // Exactly three unescaped cell delimiters on the row: leading, between the
    // two cells, and between value and description, plus the trailing one.
    const row = table.split('\n').find((line) => line.includes('--test-font-piped')) ?? '';
    expect(row).toContain('A\\|B');
    expect(row.replace(/\\\|/g, '').split('|').length - 1).toBe(4);
  });
});

describe('CIN-30 review round 5', () => {
  test('a multi-line value is normalized onto one row, like a multi-line description', async () => {
    // A cssRecipe formatted across lines returns those breaks verbatim from
    // serializeEntryValue; interpolated raw they terminate the table row.
    // Descriptions were normalized three rounds before values were -- both now
    // route through the same toTableCell, so a hazard cannot be fixed on one
    // cell and missed on the other.
    const baseIndex = new Map<string, CorpusEntry>([
      [
        'shadow.multi',
        {
          path: 'shadow.multi',
          value: { value: 1, unit: 'rem' },
          type: 'dimension',
          description: 'Line one.\nLine two.',
          cssProperty: '--test-multiline',
          cssRecipe: '0 1px 2px rgb(0 0 0 / 0.1),\n  0 2px 4px rgb(0 0 0 / 0.1)',
          public: true,
          category: 'shadow',
          component: undefined,
          deprecated: undefined,
        },
      ],
    ]);
    const section: DocSection = {
      slug: 'multi',
      heading: 'Multi',
      cssProperties: ['--test-multiline'],
    };
    const table = await renderDocTable(section, baseIndex, (value) => value);
    const rows = table.split('\n').filter((line) => line.includes('--test-multiline'));

    // Exactly one row carries the token, and neither cell leaked a line break.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('0 1px 2px rgb(0 0 0 / 0.1), 0 2px 4px rgb(0 0 0 / 0.1)');
    expect(rows[0]).toContain('Line one. Line two.');
  });

  test('a section marker repeated in the document is rejected', async () => {
    // Regenerating both blocks would list every token in the section twice, and
    // `tokens:generate -- --check` would then stabilise on the doubled output.
    // Uses control-heights (three tokens) so the FIRST block renders cleanly and
    // the duplicate is what fails -- a larger section would fail on the fixture
    // being incomplete instead, which would not test this at all.
    const heights = ['xs', 'sm', 'lg'];
    const baseIndex = new Map<string, CorpusEntry>(
      heights.map((size) => [
        `control.height.${size}`,
        {
          path: `control.height.${size}`,
          value: { value: 1, unit: 'rem' },
          type: 'dimension' as const,
          description: `Control height ${size}.`,
          cssProperty: `--cinder-control-height-${size}`,
          cssRecipe: undefined,
          public: true,
          category: 'size',
          component: undefined,
          deprecated: undefined,
        },
      ]),
    );
    const marker = '<!-- BEGIN GENERATED TOKEN TABLE: control-heights -->';
    const doubled = [
      marker,
      '<!-- END GENERATED TOKEN TABLE -->',
      '',
      marker,
      '<!-- END GENERATED TOKEN TABLE -->',
      '',
    ].join('\n');

    await expect(buildTokensDocMarkdown(doubled, baseIndex, (value) => value)).rejects.toThrow(
      /more than one generated-table marker for section "control-heights"/,
    );
  });
});
