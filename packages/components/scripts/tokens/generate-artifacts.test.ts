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
  DOC_MARKER_PATTERN,
  type DocSection,
  type PlaygroundColorTokenGroup,
  buildTokensDocMarkdown,
  readPlaygroundColorTokenGroups,
  renderDocTable,
  validatePlaygroundColorTokenGroups,
} from './generate-artifacts.ts';
import { type CorpusEntry, loadCorpus } from './generate.ts';
import {
  type TokenRegistry,
  buildBaseIndex,
  buildTokenRegistryFromIndexes,
  themeAwarePaths,
} from './registry.ts';
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
          cssProperty: '--cinder-test-space-4',
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
        tokens: [{ name: '--cinder-test-space-4', label: 'Space 4' }],
      },
    ];

    // Pre-fix, the only check was "does cssPropertyToPath know this
    // property" -- true here, since --cinder-test-space-4 is a real corpus token --
    // so this call returned normally instead of throwing.
    expect(() => validatePlaygroundColorTokenGroups(groups, registry)).toThrow(
      /not category: "color" tokens: --cinder-test-space-4/,
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
          cssProperty: '--cinder-test-accent',
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
        tokens: [{ name: '--cinder-test-accent', label: 'Accent' }],
      },
    ];

    expect(() => validatePlaygroundColorTokenGroups(groups, registry)).not.toThrow();
  });
});

describe('B2: renderDocTable normalizes a newline in $description', () => {
  test('a description containing a newline stays on one table row', async () => {
    const section: DocSection = {
      slug: 'test-section',
      headings: ['Test section'],
      cssProperties: ['--cinder-test-token'],
    };
    const entry: CorpusEntry = {
      path: 'test.token',
      value: { value: 1, unit: 'rem' },
      type: 'dimension',
      description: 'Line one.\nLine two.',
      cssProperty: '--cinder-test-token',
      cssRecipe: undefined,
    };
    const baseIndex = new Map<string, CorpusEntry>([[entry.path, entry]]);

    const table = await renderDocTable(section, baseIndex, (value) => value);

    // Pre-fix: sanitization only escaped `|`, so the raw newline is
    // interpolated straight into the row, and the second line ("Line two. |")
    // is no longer prefixed by `|`, so it is not part of any table row --
    // splitting one token's row into a malformed fragment.
    expect(table).not.toContain('Line one.\nLine two.');
    const rowLines = table.split('\n').filter((line) => line.includes('--cinder-test-token'));
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
      headings: ['Test section'],
      cssProperties: ['--cinder-test-token-cr'],
    };
    const entry: CorpusEntry = {
      path: 'test.token.cr',
      value: { value: 1, unit: 'rem' },
      type: 'dimension',
      description: 'Line one.\rLine two.',
      cssProperty: '--cinder-test-token-cr',
      cssRecipe: undefined,
    };
    const baseIndex = new Map<string, CorpusEntry>([[entry.path, entry]]);

    const table = await renderDocTable(section, baseIndex, (value) => value);
    const rowLines = table.split('\n').filter((line) => line.includes('--cinder-test-token-cr'));
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
    const baseIndex = new Map<string, CorpusEntry>([colorEntry('', '--cinder-test-root')]);
    const registry = buildTokenRegistryFromIndexes(baseIndex, new Set<string>());

    expect(registry.cssPropertyToPath['--cinder-test-root']).toBe('');

    const groups: readonly PlaygroundColorTokenGroup[] = [
      { id: 'roots', label: 'Roots', tokens: [{ name: '--cinder-test-root', label: 'Root' }] },
    ];
    expect(() => validatePlaygroundColorTokenGroups(groups, registry)).not.toThrow();
  });

  test('a blank or whitespace-only label is rejected rather than reaching the UI', () => {
    // Pre-fix these passed a bare `typeof === "string"` check and were emitted into
    // the generated registry, leaving a nameless section or colour control.
    const withBlankGroupLabel = {
      playgroundGroups: [
        {
          id: 'g',
          label: '   ',
          members: [{ cssProperty: '--cinder-test-accent', label: 'Accent' }],
        },
      ],
    };
    expect(() =>
      readPlaygroundColorTokenGroups(resolverWithExtensions(withBlankGroupLabel)),
    ).toThrow();

    const withBlankMemberLabel = {
      playgroundGroups: [
        { id: 'g', label: 'Group', members: [{ cssProperty: '--cinder-test-accent', label: '' }] },
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
          members: [{ cssProperty: '--cinder-test-accent', label: 'Accent' }],
        },
      ],
    };
    expect(() => readPlaygroundColorTokenGroups(resolverWithExtensions(withSpacedId))).toThrow();

    const withBlankId = {
      playgroundGroups: [
        {
          id: '   ',
          label: 'Status',
          members: [{ cssProperty: '--cinder-test-accent', label: 'A' }],
        },
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
          cssProperty: '--cinder-test-font-piped',
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
      headings: ['Piped'],
      cssProperties: ['--cinder-test-font-piped'],
    };
    const table = await renderDocTable(section, baseIndex, (value) => value);

    // Exactly three unescaped cell delimiters on the row: leading, between the
    // two cells, and between value and description, plus the trailing one.
    const row = table.split('\n').find((line) => line.includes('--cinder-test-font-piped')) ?? '';
    expect(row).toContain('A&#124;B');
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
          cssProperty: '--cinder-test-multiline',
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
      headings: ['Multi'],
      cssProperties: ['--cinder-test-multiline'],
    };
    const table = await renderDocTable(section, baseIndex, (value) => value);
    const rows = table.split('\n').filter((line) => line.includes('--cinder-test-multiline'));

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
    // Both copies sit under the heading DOC_SECTIONS declares, so this reaches
    // the duplicate check rather than tripping the heading check first.
    const doubled = [
      '## Control heights',
      '',
      marker,
      '<!-- END GENERATED TOKEN TABLE -->',
      '',
      '## Control heights',
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

describe('CIN-30 review round 6', () => {
  test('a value containing a backtick gets a longer delimiter run, not a broken span', async () => {
    // CommonMark closes a code span at the first matching backtick run, so a
    // hard-coded single backtick would end the span inside the value -- emitting
    // malformed Markdown that the drift parser then reads back truncated.
    const baseIndex = new Map<string, CorpusEntry>([
      [
        'font.ticked',
        {
          path: 'font.ticked',
          value: ['A`B'],
          type: 'fontFamily',
          description: 'A ticked family.',
          cssProperty: '--cinder-test-font-ticked',
          cssRecipe: undefined,
          public: true,
          category: 'typography',
          component: undefined,
          deprecated: undefined,
        },
      ],
    ]);
    const section: DocSection = {
      slug: 'ticked',
      headings: ['Ticked'],
      cssProperties: ['--cinder-test-font-ticked'],
    };
    const table = await renderDocTable(section, baseIndex, (value) => value);
    const row = table.split('\n').find((line) => line.includes('--cinder-test-font-ticked')) ?? '';

    // The value's span is delimited by a run of two, so the single backtick
    // inside it cannot close it early.
    expect(row).toContain('``');
    expect(row).toContain('A`B');
  });
});

describe('CIN-30 review round 9', () => {
  function markerEntry(field: 'description' | 'cssRecipe', text: string) {
    const entry: CorpusEntry = {
      path: 'recipe.marker',
      value: { value: 1, unit: 'rem' },
      type: 'dimension',
      description: field === 'description' ? text : 'A token.',
      cssProperty: '--cinder-test-marker',
      cssRecipe: field === 'cssRecipe' ? text : undefined,
      public: true,
      category: 'spacing',
      component: undefined,
      deprecated: undefined,
    };
    return new Map<string, CorpusEntry>([['recipe.marker', entry]]);
  }

  const section: DocSection = {
    slug: 'marker',
    headings: ['Marker'],
    cssProperties: ['--cinder-test-marker'],
  };

  // Writing marker text into the block makes the NEXT scan stop at the injected
  // text: the rewrite keeps only the truncated prefix, strands the remainder,
  // and `tokens:generate -- --check` can never stabilize again.
  test('a description carrying the END marker is rejected instead of written into the block', async () => {
    const index = markerEntry('description', 'Ends <!-- END GENERATED TOKEN TABLE --> here.');
    await expect(renderDocTable(section, index, (value) => value)).rejects.toThrow(
      /description for "--cinder-test-marker" contains the generated-table marker/,
    );
  });

  test('a value carrying the BEGIN marker is rejected too, not just a description', async () => {
    const index = markerEntry('cssRecipe', '<!-- BEGIN GENERATED TOKEN TABLE: spacing -->');
    await expect(renderDocTable(section, index, (value) => value)).rejects.toThrow(
      /value for "--cinder-test-marker" contains the generated-table marker/,
    );
  });

  test('a description with no marker text still renders', async () => {
    const index = markerEntry('description', 'A spacing token.');
    const table = await renderDocTable(section, index, (value) => value);
    expect(table).toContain('--cinder-test-marker');
  });

  // The repository pins no `eol` in .gitattributes, so a checkout with
  // core.autocrlf=true hands the generator CRLF markers. Matching only `\n`
  // found zero blocks, and buildTokensDocMarkdown then reports every
  // DOC_SECTIONS entry as a missing marker while every marker is present.
  test('DOC_MARKER_PATTERN matches a CRLF block, not only an LF one', () => {
    const lf =
      '<!-- BEGIN GENERATED TOKEN TABLE: spacing -->\nstale\n<!-- END GENERATED TOKEN TABLE -->';
    const crlf = lf.replaceAll('\n', '\r\n');

    expect([...lf.matchAll(DOC_MARKER_PATTERN)].map((match) => match[1])).toEqual(['spacing']);
    expect([...crlf.matchAll(DOC_MARKER_PATTERN)].map((match) => match[1])).toEqual(['spacing']);
  });
});

describe('CIN-30 review round 11: markers must stay under their declared heading', () => {
  const REAL_SLUG = 'spacing';
  const REAL_HEADING = '## Spacing';

  async function build(headingLine: string) {
    const markdown = [
      '# Design tokens',
      '',
      headingLine,
      '',
      `<!-- BEGIN GENERATED TOKEN TABLE: ${REAL_SLUG} -->`,
      'stale',
      '<!-- END GENERATED TOKEN TABLE -->',
      '',
    ].join('\n');
    const { resolver, documentsByPath } = await loadCorpus();
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    return buildTokensDocMarkdown(markdown, baseIndex, (value) => value);
  }

  // `DocSection.heading` was set for every section and read by nothing, so it
  // documented a guarantee nothing enforced: moving a marker under another
  // heading left the generator rewriting the spacing table under "Typography",
  // `tokens:generate -- --check` stabilising on it, and the drift test -- which
  // compares tokens globally rather than per section -- still passing.
  test('a marker moved under a different heading is rejected', async () => {
    await expect(build('## Typography')).rejects.toThrow(
      /marker under headings "## Typography", but DOC_SECTIONS declares it belongs under "## Spacing"/,
    );
  });

  test('a marker before any heading is rejected, naming the absence', async () => {
    const { resolver, documentsByPath } = await loadCorpus();
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    const markdown = `<!-- BEGIN GENERATED TOKEN TABLE: ${REAL_SLUG} -->\nstale\n<!-- END GENERATED TOKEN TABLE -->\n`;
    await expect(buildTokensDocMarkdown(markdown, baseIndex, (value) => value)).rejects.toThrow(
      /marker under headings \(none\)/,
    );
  });

  test('a renamed heading is rejected rather than silently accepted', async () => {
    await expect(build('## Spacing scale')).rejects.toThrow(/DOC_SECTIONS declares/);
  });

  test('the declared heading still passes', async () => {
    // Fails on the OTHER sections being absent, not on the heading -- which is
    // what proves the heading check itself let this one through.
    await expect(build(REAL_HEADING)).rejects.toThrow(/is missing a generated-table marker/);
  });
});

describe('CIN-30 review round 12: nested markers pin their parent heading', () => {
  async function build(lines: readonly string[]) {
    const { resolver, documentsByPath } = await loadCorpus();
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    return buildTokensDocMarkdown([...lines, ''].join('\n'), baseIndex, (value) => value);
  }

  function buttonBase(parentHeading: string) {
    return [
      '# Design tokens',
      '',
      parentHeading,
      '',
      '### Base',
      '',
      '<!-- BEGIN GENERATED TOKEN TABLE: button-base -->',
      'stale',
      '<!-- END GENERATED TOKEN TABLE -->',
    ];
  }

  // Matching only the LEAF heading let `### Base` and its marker move under a
  // different `##` parent intact -- the Button table would land in another
  // section and `tokens:generate -- --check` would stabilise on it.
  test('a nested marker moved under a different parent is rejected', async () => {
    await expect(build(buttonBase('## Typography'))).rejects.toThrow(
      /"## Typography" > "### Base", but DOC_SECTIONS declares it belongs under "## Button" > "### Base"/,
    );
  });

  test('the declared parent still passes the heading check', async () => {
    // Fails on the OTHER sections being absent, not on the headings -- which is
    // what proves the trail check itself let this one through.
    await expect(build(buttonBase('## Button'))).rejects.toThrow(
      /is missing a generated-table marker/,
    );
  });

  // A sibling heading earlier in the document is not an ancestor: the trail
  // must keep only strictly-shallower levels walking backwards.
  test('a preceding sibling heading is not treated as an ancestor', async () => {
    await expect(
      build([
        '# Design tokens',
        '',
        '## Button',
        '',
        '### Size: sm',
        '',
        '### Base',
        '',
        '<!-- BEGIN GENERATED TOKEN TABLE: button-base -->',
        'stale',
        '<!-- END GENERATED TOKEN TABLE -->',
      ]),
    ).rejects.toThrow(/is missing a generated-table marker/);
  });
});

describe('CIN-30 review round 12: a blank cssRecipe is rejected', () => {
  function build(cssRecipe: string) {
    const resolver: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {},
      resolutionOrder: [{ $ref: '#/sets/foundation' }],
    };
    const documentsByPath = new Map([
      [
        'base.json',
        {
          foundation: {
            $type: 'dimension',
            swatch: {
              $value: { value: 1, unit: 'rem' },
              $extensions: {
                'com.lostgradient.cinder': {
                  cssProperty: '--cinder-test-recipe',
                  public: true,
                  cssRecipe,
                },
              },
            },
          },
        },
      ],
    ]);
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    return () =>
      buildTokenRegistryFromIndexes(baseIndex, themeAwarePaths(resolver, documentsByPath));
  }

  // `cssRecipe` is free-form, so the schema accepts `""` -- and an empty recipe
  // still WINS over the typed $value, emitting a custom property with no value
  // and a documentation row whose Default cell is an empty code span, which
  // `extractDocTokens` cannot match.
  test('an empty cssRecipe is rejected rather than emitted as an empty value', () => {
    expect(build('')).toThrow(/has a blank cssRecipe extension/);
  });

  test('a whitespace-only cssRecipe is rejected too', () => {
    expect(build('   ')).toThrow(/has a blank cssRecipe extension/);
  });

  test('a real cssRecipe still passes', () => {
    expect(build('1rem')).not.toThrow();
  });
});

describe('CIN-30 review round 13: playground groups exclude private tokens', () => {
  function registryFor(cssProperty: string, isPublic: boolean): TokenRegistry {
    const resolver: ResolverDocument = {
      version: '2025.10',
      sets: { foundation: { sources: [{ $ref: 'base.json' }] } },
      modifiers: {},
      resolutionOrder: [{ $ref: '#/sets/foundation' }],
    };
    const documentsByPath = new Map([
      [
        'base.json',
        {
          accent: {
            $type: 'color',
            $value: { colorSpace: 'oklch', components: [0.6, 0.1, 250] },
            $extensions: {
              'com.lostgradient.cinder': { cssProperty, public: isPublic, category: 'color' },
            },
          },
        },
      ],
    ]);
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    return buildTokenRegistryFromIndexes(baseIndex, themeAwarePaths(resolver, documentsByPath));
  }

  function groupsFor(cssProperty: string): readonly PlaygroundColorTokenGroup[] {
    return [{ id: 'brand', label: 'Brand', tokens: [{ name: cssProperty, label: 'Accent' }] }];
  }

  // `category: "color"` says what KIND of value a token holds; `public` is the
  // customization contract. The panel writes each control's value straight to
  // the document root, so listing a private token would expose and let a user
  // redefine an implementation detail the package reserves.
  test('a private color token in a group is rejected, not just a non-color one', () => {
    expect(() =>
      validatePlaygroundColorTokenGroups(
        groupsFor('--_cinder-accent'),
        registryFor('--_cinder-accent', false),
      ),
    ).toThrow(/references private cssProperties.*--_cinder-accent/s);
  });

  test('a public color token is still accepted', () => {
    expect(() =>
      validatePlaygroundColorTokenGroups(
        groupsFor('--cinder-accent-solid'),
        registryFor('--cinder-accent-solid', true),
      ),
    ).not.toThrow();
  });
});
describe('CIN-30 review round 14', () => {
  // `toTableCell` collapses interior line breaks, so normalization can
  // SYNTHESIZE a marker the raw source does not contain. Validating the raw
  // string accepted this and then wrote the exact closing marker into the block.
  test('a marker split across a newline is caught after normalization', async () => {
    const baseIndex = new Map<string, CorpusEntry>([
      [
        'recipe.split',
        {
          path: 'recipe.split',
          value: { value: 1, unit: 'rem' },
          type: 'dimension',
          description: 'Ends <!-- END\nGENERATED TOKEN TABLE --> here.',
          cssProperty: '--cinder-test-split',
          cssRecipe: undefined,
          public: true,
          category: 'spacing',
          component: undefined,
          deprecated: undefined,
        },
      ],
    ]);
    const section: DocSection = {
      slug: 'split',
      headings: ['## Split'],
      cssProperties: ['--cinder-test-split'],
    };

    await expect(renderDocTable(section, baseIndex, (value) => value)).rejects.toThrow(
      /description for "--cinder-test-split" contains the generated-table marker/,
    );
  });

  // A suffix match over label-only entries accepted a DEMOTED section: turning
  // `## Spacing` into `### Spacing` beneath `## Typography` still ends in
  // "Spacing", so the spacing table would nest under Typography unnoticed.
  test('a demoted section heading is rejected, not just a moved one', async () => {
    const { resolver, documentsByPath } = await loadCorpus();
    const baseIndex = buildBaseIndex(resolver, documentsByPath);
    const markdown = [
      '# Design tokens',
      '',
      '## Typography',
      '',
      '### Spacing',
      '',
      '<!-- BEGIN GENERATED TOKEN TABLE: spacing -->',
      'stale',
      '<!-- END GENERATED TOKEN TABLE -->',
      '',
    ].join('\n');

    await expect(buildTokensDocMarkdown(markdown, baseIndex, (value) => value)).rejects.toThrow(
      /"## Typography" > "### Spacing", but DOC_SECTIONS declares it belongs under "## Spacing"/,
    );
  });
});

describe('CIN-470: toTableCell escapes pipes by backslash parity, not unconditionally', () => {
  /**
   * Counts the STRUCTURAL number of GFM column delimiters in a row: a `|` is a
   * delimiter unless it is preceded by an odd run of backslashes (GFM's own
   * left-to-right backslash pairing -- the same rule `toTableCell` targets),
   * in which case it is an escaped, literal pipe inside a cell. Asserting this
   * count -- not a literal backslash count in the row's text, which is easy to
   * miscount by hand -- is what actually proves the row is well-formed.
   */
  function countRowDelimiters(row: string): number {
    let count = 0;
    let backslashRun = 0;
    for (const character of row) {
      if (character === '\\') {
        backslashRun += 1;
        continue;
      }
      if (character === '|' && backslashRun % 2 === 0) count += 1;
      backslashRun = 0;
    }
    return count;
  }

  // `cssRecipe` is emitted verbatim by `serializeEntryValue` (cssRecipe > alias >
  // typed `$value`, see generate.ts), so it is the clean way to inject an exact
  // string into a cell without a typed `$value`/serialization detour.
  function recipeEntry(
    path: string,
    cssProperty: string,
    cssRecipe: string,
  ): [string, CorpusEntry] {
    return [
      path,
      {
        path,
        value: undefined,
        type: 'color',
        description: undefined,
        cssProperty,
        cssRecipe,
      },
    ];
  }

  function tableSection(cssProperty: string): DocSection {
    return { slug: 'pipe-test', headings: ['Pipe test'], cssProperties: [cssProperty] };
  }

  function rowFor(table: string, cssProperty: string): string {
    const row = table.split('\n').find((line) => line.includes(cssProperty));
    if (!row) throw new Error(`No row found for "${cssProperty}" in:\n${table}`);
    return row;
  }

  test('a bare pipe still produces a well-formed 3-column row (4 delimiters)', async () => {
    const baseIndex = new Map<string, CorpusEntry>([
      recipeEntry('test.bare', '--test-bare', 'foo|bar'),
    ]);
    const table = await renderDocTable(tableSection('--test-bare'), baseIndex, (value) => value);
    expect(countRowDelimiters(rowFor(table, '--test-bare'))).toBe(4);
  });

  test('a value already containing an escaped pipe is not double-escaped into a malformed row', async () => {
    // Pre-fix, `.replaceAll('|', '\\|')` turned this already-escaped `foo\|bar`
    // into `foo\\|bar`: GFM reads the leading `\\` as an escaped backslash,
    // leaving the `|` a live, unescaped column delimiter -- a 5-delimiter row
    // the drift parser (`extractDocTokens`) still silently accepted.
    const baseIndex = new Map<string, CorpusEntry>([
      recipeEntry('test.escaped', '--test-escaped', 'foo\\|bar'),
    ]);
    const table = await renderDocTable(tableSection('--test-escaped'), baseIndex, (value) => value);
    expect(countRowDelimiters(rowFor(table, '--test-escaped'))).toBe(4);
  });

  test('both cases decode back to their original values through the drift parser inverse', async () => {
    // Mirrors `tokens-doc-drift.test.ts`'s `extractDocTokens` decode exactly,
    // so this test fails the same way that test would if the two sides ever
    // disagreed again.
    for (const raw of ['foo|bar', 'foo\\|bar']) {
      const baseIndex = new Map<string, CorpusEntry>([recipeEntry('test.rt', '--test-rt', raw)]);
      const table = await renderDocTable(tableSection('--test-rt'), baseIndex, (value) => value);
      const row = rowFor(table, '--test-rt');
      // Pipe-containing values use HTML entities so Markdown escapes and
      // HTML-like text remain literal in the rendered documentation.
      const cellMatch = /\|\s*`--test-rt`\s*\|\s*((?:\\.|[^|])*)\s*\|/.exec(row);
      expect(cellMatch?.[1]).toBeDefined();
      const encoded = cellMatch![1]!.trim().replace(/^`|`$/g, '');
      expect(encoded.replaceAll('&#124;', '|')).toBe(raw);
    }
  });

  test('a pipe value is rendered as literal-safe HTML code', async () => {
    const baseIndex = new Map<string, CorpusEntry>([
      recipeEntry('test.literal', '--test-literal', '<em>|&</em>'),
    ]);
    const table = await renderDocTable(tableSection('--test-literal'), baseIndex, (value) => value);
    expect(table).toContain('&lt;em&gt;&#124;&amp;&lt;/em&gt;');
    expect(table).not.toContain('<em>');
  });
});
