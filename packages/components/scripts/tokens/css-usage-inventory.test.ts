import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inventoryFromSources } from './css-usage-inventory';

const publicProperties = new Set(['--public-a', '--public-b', '--public-c', '--public-d']);
const source = (path: string, content: string, globalDefinitions = false) => ({
  path,
  content,
  globalDefinitions,
});

describe('css usage inventory', () => {
  test('records every multiline declaration reference and nested fallback', () => {
    const report = inventoryFromSources(
      [
        source(
          'fixture.css',
          '.x {\n  padding: var(--public-a, var(--public-b)) var(--public-c)\n    var(--public-d);\n}',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.map((use) => use.tokenProperty)).toEqual([
      '--public-a',
      '--public-b',
      '--public-c',
      '--public-d',
    ]);
    expect(report.uses.every((use) => use.property === 'padding')).toBe(true);
  });

  test('follows sibling aliases directionally and records global defaults', () => {
    const report = inventoryFromSources(
      [
        source('tokens.css', ':root { --public-a: #fff; --public-b: #000; }', true),
        source(
          'component.css',
          ':root { --private-a: var(--public-a); --private-b: var(--public-b); } .x { color: var(--private-a); background: var(--private-b); }',
        ),
      ],
      publicProperties,
    );
    expect(
      report.uses.filter((use) => use.property === 'color').map((use) => use.tokenProperty),
    ).toEqual(['--public-a']);
    expect(
      report.uses.filter((use) => use.property === 'background').map((use) => use.tokenProperty),
    ).toEqual(['--public-b']);
  });

  test('keeps local variants separate and never crosses private names between files', () => {
    const report = inventoryFromSources(
      [
        source(
          'one.css',
          '.a { --private: var(--public-a); color: var(--private); } .b { --private: var(--public-b); color: var(--private); }',
        ),
        source('two.css', '.c { --private: var(--public-c); color: var(--private); }'),
      ],
      publicProperties,
    );
    expect(
      report.uses.filter((use) => use.file === 'one.css').map((use) => use.tokenProperty),
    ).toEqual(['--public-a', '--public-b', '--public-a', '--public-b']);
    expect(
      report.uses.filter((use) => use.file === 'two.css').map((use) => use.tokenProperty),
    ).toEqual(['--public-c']);
  });

  test('reports cycles and preserves nested fallback chains', () => {
    const report = inventoryFromSources(
      [
        source(
          'cycle.css',
          ':root { --private-a: var(--private-b); --private-b: var(--private-a, var(--public-a)); } .x { color: var(--private-a); }',
        ),
      ],
      publicProperties,
    );
    expect(report.diagnostics.some((diagnostic) => diagnostic.kind === 'cycle')).toBe(true);
    expect(report.uses.some((use) => use.tokenProperty === '--public-a')).toBe(true);
  });

  test('extracts Svelte blocks and literal attributes with source locations', () => {
    const report = inventoryFromSources(
      [
        source(
          'component.svelte',
          '<div\n  style="color: var(--public-a);\n  padding: var(--public-b)"\n></div>\n<style>\n.x { margin: var(--public-c); }\n</style>',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.map((use) => use.tokenProperty)).toEqual([
      '--public-a',
      '--public-b',
      '--public-c',
    ]);
    expect(report.uses.find((use) => use.tokenProperty === '--public-a')?.line).toBe(2);
    expect(report.uses.find((use) => use.tokenProperty === '--public-c')?.line).toBe(6);
  });

  test('reports interpolation without manufacturing a value', () => {
    const report = inventoryFromSources(
      [
        source(
          'dynamic.svelte',
          '<div style="color: var(--public-a); padding: {value}"></div><div style:color={expression}></div>',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.map((use) => use.tokenProperty)).toEqual(['--public-a']);
    expect(
      report.diagnostics.filter((diagnostic) => diagnostic.kind === 'unsupported-surface'),
    ).toHaveLength(2);
  });

  test('records literal and computed runtime style sinks as dynamic surfaces', () => {
    const report = inventoryFromSources(
      [
        source(
          'runtime.ts',
          "element.style.setProperty('--public-a', value); element.style.setProperty(property, value); element.style.cssText = text;",
        ),
      ],
      publicProperties,
    );
    expect(report.dynamic).toHaveLength(3);
    expect(report.dynamic.find((record) => record.property === '--public-a')).toBeDefined();
    expect(report.dynamic.filter((record) => record.property === null)).toHaveLength(2);
  });

  test('rejects duplicate paths and multiple global definition sets', () => {
    expect(() =>
      inventoryFromSources([source('a.css', ''), source('a.css', '')], publicProperties),
    ).toThrow('Duplicate source path');
    expect(() =>
      inventoryFromSources(
        [source('a.css', '', true), source('b.css', '', true)],
        publicProperties,
      ),
    ).toThrow('At most one source');
  });

  test('preserves selector and ordered at-rule ancestry in every use and chain definition', () => {
    const report = inventoryFromSources(
      [
        source(
          'scoped.css',
          '@media (min-width: 1px) { .card { --private: var(--public-a); color: var(--private); } }',
        ),
      ],
      publicProperties,
    );
    expect(report.uses[0]).toMatchObject({
      selector: '.card',
      atRules: [{ name: 'media', parameters: '(min-width: 1px)' }],
    });
    expect(report.uses[0]?.chain[0]?.definition).toMatchObject({
      selector: '.card',
      atRules: [{ name: 'media' }],
    });
    expect(report.uses[0]?.chain[0]?.definition).not.toHaveProperty('refs');
    expect(report.uses[0]?.chain[0]?.definition).not.toHaveProperty('sourceFile');
  });

  test('walks nested Svelte branch nodes and keeps literal directive expressions static', () => {
    const report = inventoryFromSources(
      [
        source(
          'branches.svelte',
          '{#if enabled}<div style:color={\'var(--public-a)\'}></div>{:else}<div style="background: var(--public-b)"></div>{/if}',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.map((use) => use.tokenProperty)).toEqual(['--public-a', '--public-b']);
    expect(report.dynamic).toHaveLength(0);
  });

  test('parses literal runtime writes and reports dynamic nested calls without inventing values', () => {
    const report = inventoryFromSources(
      [
        source(
          'runtime.ts',
          "element.style.setProperty('color', 'var(--public-a)'); element.style.setProperty(property, `calc(var(--public-b, var(--public-c)))`);",
        ),
      ],
      publicProperties,
    );
    expect(report.uses.map((use) => use.tokenProperty)).toEqual(['--public-a']);
    expect(report.dynamic).toMatchObject([{ property: null, kind: 'runtime-style-sink' }]);
    expect(report.dynamic[0]?.expression).toContain('calc(var(--public-b, var(--public-c)))');
  });

  test('reports a mixed inline interpolation with the dynamic declaration property', () => {
    const report = inventoryFromSources(
      [
        source(
          'mixed.svelte',
          '<div style="color: var(--public-a); padding: {size}; margin: var(--public-b)"></div>',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.map((use) => use.tokenProperty)).toEqual(['--public-a', '--public-b']);
    expect(report.dynamic[0]).toMatchObject({
      property: 'padding',
      kind: 'svelte-style-attribute',
      expression: '{size}',
    });
  });

  test('reports every mixed style hole independently at its source range', () => {
    const content =
      '<div style="color: {first}; padding: var(--public-a); margin: {second}; border: var(--public-b)"></div>';
    const report = inventoryFromSources([source('two-holes.svelte', content)], publicProperties);
    expect(report.dynamic.filter((record) => record.kind === 'svelte-style-attribute')).toEqual([
      expect.objectContaining({
        expression: '{first}',
        property: 'color',
        column: content.indexOf('{first}') + 1,
      }),
      expect.objectContaining({
        expression: '{second}',
        property: 'margin',
        column: content.indexOf('{second}') + 1,
      }),
    ]);
    expect(report.uses.map((use) => [use.tokenProperty, use.column])).toEqual([
      ['--public-a', content.indexOf('padding') + 1],
      ['--public-b', content.indexOf('border') + 1],
    ]);
  });

  test('keeps complete declarations around holes embedded in calc and shorthand values', () => {
    const content =
      '<div style="color: var(--public-a); width: calc(var(--public-b) + {gap}px); border: {style} solid var(--public-c); margin: var(--public-d)"></div>';
    const report = inventoryFromSources(
      [source('embedded-holes.svelte', content)],
      publicProperties,
    );
    expect(report.uses.map((use) => [use.tokenProperty, use.property, use.column])).toEqual([
      ['--public-a', 'color', content.indexOf('color') + 1],
      ['--public-d', 'margin', content.indexOf('margin') + 1],
    ]);
    expect(report.dynamic).toEqual([
      expect.objectContaining({
        property: 'width',
        expression: '{gap}',
        column: content.indexOf('{gap}') + 1,
      }),
      expect.objectContaining({
        property: 'border',
        expression: '{style}',
        column: content.indexOf('{style}') + 1,
      }),
    ]);
    expect(report.diagnostics.filter((diagnostic) => diagnostic.kind === 'parse-error')).toEqual(
      [],
    );
  });

  test('does not treat unrelated setProperty, cssText, or style attributes as element style sinks', () => {
    const report = inventoryFromSources(
      [
        source(
          'receivers.ts',
          "map.setProperty('color', 'var(--public-a)'); foo.cssText = 'color: var(--public-b)'; foo.setAttribute('style', 'color: var(--public-c)');",
        ),
      ],
      publicProperties,
    );
    expect(report.uses).toHaveLength(0);
    expect(report.dynamic).toHaveLength(3);
    expect(
      report.diagnostics.filter((diagnostic) => diagnostic.kind === 'unsupported-surface'),
    ).toHaveLength(3);
  });

  test('walks snippet, await then, catch, and else branches with exact locations', () => {
    const report = inventoryFromSources(
      [
        source(
          'all-branches.svelte',
          '{#snippet row()}<div style="color: var(--public-a)"></div>{/snippet}{#await promise}<div style="color: var(--public-b)"></div>{:then value}<div style="color: var(--public-c)"></div>{:catch error}<div style="color: var(--public-d)"></div>{/await}{#if enabled}<div style="color: var(--public-a)"></div>{:else}<div style="color: var(--public-b)"></div>{/if}',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.map((use) => use.tokenProperty)).toEqual([
      '--public-a',
      '--public-b',
      '--public-c',
      '--public-d',
      '--public-a',
      '--public-b',
    ]);
    expect(report.uses.map((use) => [use.tokenProperty, use.line, use.column])).toEqual([
      ['--public-a', 1, 29],
      ['--public-b', 1, 97],
      ['--public-c', 1, 152],
      ['--public-d', 1, 208],
      ['--public-a', 1, 271],
      ['--public-b', 1, 320],
    ]);
    expect(
      report.diagnostics.filter((diagnostic) => diagnostic.kind === 'parse-error'),
    ).toHaveLength(0);
  });

  test('records literal runtime CSS sinks at their source locations, including escaped JavaScript strings', () => {
    const report = inventoryFromSources(
      [
        source(
          'runtime-locations.ts',
          '  element.style.setProperty("color", "var(--public-a)");\n  element.setAttribute("style", "background: var(--public-b)");\n  element.style.cssText = "border-color: var(--public-c)";',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.map((use) => [use.tokenProperty, use.line])).toEqual([
      ['--public-a', 1],
      ['--public-b', 2],
      ['--public-c', 3],
    ]);
  });

  test('is byte-for-byte stable when source input order is permuted', () => {
    const sources = [
      source('b.css', '.b { color: var(--public-b); }'),
      source('a.css', '.a { color: var(--public-a); }'),
    ];
    expect(inventoryFromSources(sources, publicProperties)).toEqual(
      inventoryFromSources(sources.toReversed(), publicProperties),
    );
  });

  test('sorts paths by Unicode code point rather than UTF-16 code unit', () => {
    const report = inventoryFromSources(
      [source('\u{1f600}.css', ''), source('\ue000.css', '')],
      publicProperties,
    );
    expect(report.sourceFiles.map((entry) => entry.path)).toEqual(['\ue000.css', '\u{1f600}.css']);
  });

  test('extracts style sinks from Svelte instance and module scripts', () => {
    const report = inventoryFromSources(
      [
        source(
          'scripts.svelte',
          '<script>let node; node?.style.setProperty("color", "var(--public-a)");</script><script context="module">element.style.setProperty("background", "var(--public-b)");</script>',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.map((use) => use.tokenProperty)).toEqual(['--public-a', '--public-b']);
  });

  test('reports malformed CSS as a parse diagnostic', () => {
    const report = inventoryFromSources([source('broken.css', '.x { color: ;')], publicProperties);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({ file: 'broken.css', kind: 'parse-error' }),
    ]);
  });

  test('uses the nearest nested selector for declarations', () => {
    const report = inventoryFromSources(
      [source('nested.css', '.outer { .inner { color: var(--public-a); } }')],
      publicProperties,
    );
    expect(report.uses[0]?.selector).toBe('.inner');
  });

  test('accepts an aliased DOM style receiver and rejects unrelated receivers', () => {
    const report = inventoryFromSources(
      [
        source(
          'aliases.ts',
          "const style = element.style; style.setProperty('color', 'var(--public-a)'); map.setProperty('color', 'var(--public-b)');",
        ),
      ],
      publicProperties,
    );
    expect(report.uses.map((use) => use.tokenProperty)).toEqual(['--public-a']);
  });

  test('accepts setAttribute only with explicit DOM annotation', () => {
    const report = inventoryFromSources(
      [
        source(
          'typed.ts',
          'const element: HTMLElement = document.body; element.setAttribute("style", "color: var(--public-a)");',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.map((use) => use.tokenProperty)).toEqual(['--public-a']);
  });
});

test('keeps quoted and commented semicolons inside complete CSS declarations', () => {
  const content = `<div style="content: 'a;b'; color: var(--public-a); width: calc(1px /* ; */ + {gap}px); padding: var(--public-b)"></div>`;
  const report = inventoryFromSources([source('quoted.svelte', content)], publicProperties);
  expect(report.uses.map((use) => [use.tokenProperty, use.column])).toEqual([
    ['--public-a', content.indexOf('color:') + 1],
    ['--public-b', content.indexOf('padding:') + 1],
  ]);
  expect(report.diagnostics.filter((diagnostic) => diagnostic.kind === 'parse-error')).toEqual([]);
  expect(report.dynamic).toEqual([
    expect.objectContaining({
      expression: '{gap}',
      property: 'width',
      column: content.indexOf('{gap}') + 1,
    }),
  ]);
});

test('records a literal style directive at its authored declaration start', () => {
  const content = `<div style:color={'var(--public-a)'}></div>`;
  const report = inventoryFromSources([source('directive.svelte', content)], publicProperties);
  expect(report.uses).toEqual([
    expect.objectContaining({
      tokenProperty: '--public-a',
      property: 'color',
      line: 1,
      column: content.indexOf('style:color') + 1,
    }),
  ]);
});

test('tracks static SVG presentation references through their authored properties', () => {
  const report = inventoryFromSources(
    [
      source(
        'static-svg.svelte',
        '<svg><defs><linearGradient><stop stop-color="var(--public-a)" /></linearGradient></defs><path fill="var(--public-b)" /></svg>',
      ),
    ],
    publicProperties,
  );
  expect(report.uses.map((use) => [use.tokenProperty, use.property])).toEqual([
    ['--public-a', 'stop-color'],
    ['--public-b', 'fill'],
  ]);
  expect(report.dynamic).toHaveLength(0);
});

test('reports dynamic SVG presentation attributes with exact properties', () => {
  const content = '<svg><path fill={fill} stroke={stroke} /></svg>';
  const report = inventoryFromSources([source('dynamic-svg.svelte', content)], publicProperties);
  expect(report.dynamic).toEqual([
    expect.objectContaining({
      kind: 'svelte-svg-attribute',
      property: 'fill',
      column: content.indexOf('fill') + 1,
    }),
    expect.objectContaining({
      kind: 'svelte-svg-attribute',
      property: 'stroke',
      column: content.indexOf('stroke') + 1,
    }),
  ]);
  expect(
    report.diagnostics.filter((diagnostic) => diagnostic.kind === 'unsupported-surface'),
  ).toHaveLength(2);
});

test('keeps nested SVG presentation attributes in namespace and excludes foreignObject and component props', () => {
  const report = inventoryFromSources(
    [
      source(
        'svg-boundaries.svelte',
        '<svg><g><svg><path fill="var(--public-a)" /></svg></g><foreignObject><div fill="var(--public-b)"></div></foreignObject></svg><Chart fill="var(--public-c)" />',
      ),
    ],
    publicProperties,
  );
  expect(report.uses.map((use) => use.tokenProperty)).toEqual(['--public-a']);
  expect(report.dynamic).toHaveLength(0);
});

test('preserves SVG namespace through each, if, and snippet blocks', () => {
  const content =
    '<svg>{#if enabled}{#each items as item}<path fill={item.fill} />{/each}{/if}{#snippet mark()}<path stroke={color} />{/snippet}</svg>';
  const report = inventoryFromSources([source('svg-blocks.svelte', content)], publicProperties);
  expect(report.dynamic.map((record) => [record.property, record.column])).toEqual([
    ['fill', content.indexOf('fill=') + 1],
    ['stroke', content.indexOf('stroke=') + 1],
  ]);
});

test('records owned dynamic presentation sinks in shipped chart sources', () => {
  const sourcePaths = [
    'area-chart/area-chart.svelte',
    'bar-chart/bar-chart.svelte',
    'line-chart/line-chart.svelte',
    'matrix-chart/matrix-chart.svelte',
  ].map((path) => resolve(import.meta.dir, '../../src/components', path));
  const records = sourcePaths.flatMap((path) => {
    const content = readFileSync(path, 'utf8');
    return inventoryFromSources([{ path, content }], publicProperties).dynamic.filter(
      (record) => record.kind === 'svelte-svg-attribute',
    );
  });
  expect(
    records.some(
      (record) => record.file.endsWith('area-chart.svelte') && record.property === 'stroke',
    ),
  ).toBe(true);
  expect(
    records.some(
      (record) => record.file.endsWith('bar-chart.svelte') && record.property === 'fill',
    ),
  ).toBe(true);
  expect(
    records
      .filter((record) => record.file.endsWith('line-chart.svelte'))
      .map((record) => record.property),
  ).toEqual(['stroke', 'fill']);
  expect(
    records
      .filter((record) => record.file.endsWith('matrix-chart.svelte'))
      .map((record) => record.property),
  ).toEqual(['fill', 'fill']);
});
