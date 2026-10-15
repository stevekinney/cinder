import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  computeCoverageAverages,
  coverageFailures,
  formatCoverageSummary,
  formatLineRanges,
  parseCoverageThresholds,
  parseLcovRecords,
  parseRuntimeLcovRecords,
  parseSvelteLcovRecords,
  parseSvelteMeasurementPlatform,
  runtimeImportsOfTestSupport,
  svelteCoveragePlatformNotice,
  uncoveredLineReport,
  UNREACHABLE_LINE_MARKER,
} from './coverage-ratchet.ts';

const scratchDirectories: string[] = [];

function scratchDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'coverage-ratchet-'));
  scratchDirectories.push(directory);
  return directory;
}

function writeFiles(root: string, files: Record<string, string>): void {
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
}

afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function record(file: string, found: number, hit: number, functionsHit = found): string {
  const lines = Array.from(
    { length: found },
    (_, index) => `DA:${index + 1},${index < hit ? 1 : 0}`,
  );
  return [
    'TN:',
    `SF:${file}`,
    `FNF:${found}`,
    `FNH:${functionsHit}`,
    ...lines,
    `LF:${found}`,
    `LH:${hit}`,
    'end_of_record',
    '',
  ].join('\n');
}

const root = '/workspace/package';

describe('threshold parsing', () => {
  test('reads flat thresholds and an optional Svelte ratchet', () => {
    expect(parseCoverageThresholds('{"lines":1,"functions":1}')).toEqual({
      lines: 1,
      functions: 1,
    });
    expect(
      parseCoverageThresholds('{"lines":1,"functions":0.9,"svelte":{"lines":0.3,"functions":0.8}}'),
    ).toEqual({ lines: 1, functions: 0.9, svelte: { lines: 0.3, functions: 0.8 } });
  });

  test('ignores metadata that is not a threshold', () => {
    expect(
      parseCoverageThresholds('{"lines":0.5,"functions":0.5,"svelteMeasuredOn":{"note":"x"}}'),
    ).toEqual({ lines: 0.5, functions: 0.5 });
  });

  test.each([
    ['{"lines":1}', 'must define numeric lines and functions thresholds'],
    ['{"lines":"1","functions":1}', 'must define numeric lines and functions thresholds'],
    ['null', 'must define numeric lines and functions thresholds'],
    ['{"lines":2,"functions":1}', 'between 0 and 1'],
    ['{"lines":1,"functions":-0.1}', 'between 0 and 1'],
    ['{"lines":1,"functions":1,"svelte":{"lines":1}}', 'svelte thresholds must define numeric'],
    ['{"lines":1,"functions":1,"svelte":null}', 'svelte thresholds must define numeric'],
    ['{"lines":1,"functions":1,"svelte":{"lines":1.5,"functions":1}}', 'between 0 and 1'],
  ])('rejects %s', (source, message) => {
    expect(() => parseCoverageThresholds(source)).toThrow(message);
  });
});

describe('LCOV scope', () => {
  const lcov = [
    record('src/index.ts', 4, 4),
    record('src/widget.svelte', 4, 1),
    record('src/state.svelte.ts', 2, 2),
    record('src/index.test.ts', 9, 9),
    record('src/feature.spec.ts', 9, 9),
    record('src/test/harness.ts', 9, 9),
    record('src/lib/test/harness.ts', 9, 9),
    record('src/feature-test-helpers.ts', 9, 9),
    record('scripts/check.ts', 9, 0),
    record('../sibling/src/index.ts', 9, 0),
    record('src/.cinder-ssr-123-456-abc.mjs', 9, 0),
    record('tmp/hydration-safety/client-1-2-abc.mjs', 9, 0),
  ].join('');

  test('runtime scope keeps package TypeScript source only', () => {
    expect(parseRuntimeLcovRecords(lcov, root).map((entry) => entry.file)).toEqual([
      'src/index.ts',
    ]);
  });

  test('Svelte scope keeps component and rune modules only', () => {
    expect(parseSvelteLcovRecords(lcov, root).map((entry) => entry.file)).toEqual([
      'src/widget.svelte',
      'src/state.svelte.ts',
    ]);
  });

  test('the subject prefix keeps an ordinary `test-result.ts` module in scope', () => {
    expect(
      parseLcovRecords(record('src/test-result.ts', 1, 1), 'runtime', root).map((e) => e.file),
    ).toEqual(['src/test-result.ts']);
  });

  test('a record without a source file is rejected', () => {
    expect(() =>
      parseLcovRecords('TN:\nFNF:1\nFNH:1\nLF:1\nLH:1\nend_of_record\n', 'runtime', root),
    ).toThrow('LCOV record is missing SF');
  });

  test('a non-numeric count is rejected', () => {
    expect(() =>
      parseLcovRecords('TN:\nSF:a.ts\nFNF:x\nFNH:1\nLF:1\nLH:1\nend_of_record\n', 'runtime', root),
    ).toThrow('LCOV field FNF must be numeric');
  });

  test('a marked unreachable line leaves the denominator without counting as covered', () => {
    const directory = scratchDirectory();
    writeFiles(directory, {
      'marked.ts': `a();\nb();\nc(); // ${UNREACHABLE_LINE_MARKER} guarded upstream\n`,
    });
    const source =
      'TN:\nSF:marked.ts\nFNF:1\nFNH:1\nDA:1,1\nDA:2,1\nDA:3,0\nLF:3\nLH:2\nend_of_record\n';
    const [entry] = parseLcovRecords(source, 'runtime', directory);
    expect(entry).toMatchObject({ linesFound: 2, linesHit: 2 });
    expect(uncoveredLineReport(source, 'runtime', directory)).toEqual([]);
  });
});

describe('averages and failures', () => {
  test('weights by found counts and refuses an empty report', () => {
    const records = parseLcovRecords(
      record('a.ts', 2, 2) + record('b.ts', 2, 1, 1),
      'runtime',
      root,
    );
    expect(computeCoverageAverages(records)).toEqual({
      files: 2,
      functions: 75,
      functionsFound: 4,
      functionsHit: 3,
      lines: 75,
      linesFound: 4,
      linesHit: 3,
    });
    expect(() => computeCoverageAverages([])).toThrow('did not contain any records');
  });

  test('a file with no executable lines counts as fully covered', () => {
    const records = parseLcovRecords(record('empty.ts', 0, 0), 'runtime', root);
    expect(computeCoverageAverages(records)).toMatchObject({ lines: 100, functions: 100 });
  });

  test('names each threshold that is missed', () => {
    const averages = computeCoverageAverages(
      parseLcovRecords(record('a.ts', 4, 3, 3), 'runtime', root),
    );
    expect(coverageFailures(averages, { lines: 0.7, functions: 0.7 })).toEqual([]);
    expect(coverageFailures(averages, { lines: 1, functions: 1 })).toEqual([
      'functions 75.00% < 100.00%',
      'lines 75.00% < 100.00%',
    ]);
    expect(formatCoverageSummary(averages, { lines: 0.5, functions: 0.5 }, 'Label')).toBe(
      'Label (1 files): functions 75.00% >= 50.00% lines 75.00% >= 50.00%',
    );
  });

  test('formats unhit lines as ranges', () => {
    expect(formatLineRanges([7, 1, 2, 3, 3])).toBe('1-3, 7');
    expect(formatLineRanges([])).toBe('');
  });
});

describe('Svelte measurement platform provenance', () => {
  const recorded = { platform: 'linux', architecture: 'x64' };

  test('reads the recorded platform, and treats anything malformed as absent', () => {
    expect(
      parseSvelteMeasurementPlatform(
        '{"svelteMeasuredOn":{"platform":"linux","architecture":"x64"}}',
      ),
    ).toEqual(recorded);
    expect(parseSvelteMeasurementPlatform('{}')).toBeUndefined();
    expect(parseSvelteMeasurementPlatform('[]')).toBeUndefined();
    expect(
      parseSvelteMeasurementPlatform('{"svelteMeasuredOn":{"platform":"linux"}}'),
    ).toBeUndefined();
    expect(
      parseSvelteMeasurementPlatform('{"svelteMeasuredOn":{"platform":1,"architecture":"x64"}}'),
    ).toBeUndefined();
  });

  test('notices only a recorded platform that differs from the running one', () => {
    expect(svelteCoveragePlatformNotice(undefined, recorded)).toBeUndefined();
    expect(svelteCoveragePlatformNotice(recorded, recorded)).toBeUndefined();
    const notice = svelteCoveragePlatformNotice(recorded, {
      platform: 'darwin',
      architecture: 'arm64',
    });
    expect(notice).toContain('linux/x64');
    expect(notice).toContain('darwin/arm64');
    expect(notice).toContain('NOT authoritative');
  });
});

describe('test support reachability', () => {
  test('finds a test support module imported on a path from the entry', () => {
    const directory = scratchDirectory();
    writeFiles(directory, {
      'src/index.ts': "export { run } from './feature.ts';\n",
      'src/feature.ts':
        "import { open } from './feature-test-helpers.js';\nexport const run = open;\n",
      'src/feature-test-helpers.ts': 'export const open = 1;\n',
      'src/feature.test.ts': "import { open } from './feature-test-helpers.ts';\n",
    });
    expect(runtimeImportsOfTestSupport(directory)).toEqual([
      { file: 'src/feature.ts', specifier: './feature-test-helpers.js' },
    ]);
  });

  test('ignores test support that only tests import', () => {
    const directory = scratchDirectory();
    writeFiles(directory, {
      'src/index.ts': "export * from './feature/index.ts';\n",
      'src/feature/index.ts': 'export const run = 1;\n',
      'src/feature/feature-test-helpers.ts': 'export const open = 1;\n',
      'src/feature/feature.test.ts': "import { open } from './feature-test-helpers.ts';\n",
    });
    expect(runtimeImportsOfTestSupport(directory)).toEqual([]);
  });

  test('requires the entry to exist', () => {
    expect(() => runtimeImportsOfTestSupport(scratchDirectory())).toThrow(
      'Package entry src/index.ts does not exist',
    );
  });

  describe('every runtime target in the exports map', () => {
    const subpathSources = {
      'src/index.ts': 'export const run = 1;\n',
      'src/bun/index.ts':
        "import { open } from './process-test-helpers.ts';\nexport const spawn = open;\n",
      'src/bun/process-test-helpers.ts': 'export const open = 1;\n',
    };

    test('finds a helper imported only from a subpath entry', () => {
      const directory = scratchDirectory();
      writeFiles(directory, {
        ...subpathSources,
        'package.json': JSON.stringify({
          exports: { '.': './src/index.ts', './bun': './src/bun/index.ts' },
        }),
      });
      expect(runtimeImportsOfTestSupport(directory)).toEqual([
        { file: 'src/bun/index.ts', specifier: './process-test-helpers.ts' },
      ]);
    });

    test('walks only the default entry when the package exports nothing else', () => {
      const directory = scratchDirectory();
      writeFiles(directory, {
        ...subpathSources,
        'package.json': JSON.stringify({ exports: { '.': './src/index.ts' } }),
      });
      expect(runtimeImportsOfTestSupport(directory)).toEqual([]);
    });

    test('falls back to src/index.ts without a package manifest or an exports map', () => {
      const withoutManifest = scratchDirectory();
      writeFiles(withoutManifest, subpathSources);
      expect(runtimeImportsOfTestSupport(withoutManifest)).toEqual([]);
      const withoutExports = scratchDirectory();
      writeFiles(withoutExports, { ...subpathSources, 'package.json': '{"name":"x"}' });
      expect(runtimeImportsOfTestSupport(withoutExports)).toEqual([]);
    });

    test('reads a string exports map', () => {
      const directory = scratchDirectory();
      writeFiles(directory, {
        'src/main.ts': "import { open } from './main-test-helpers.ts';\nexport const run = open;\n",
        'src/main-test-helpers.ts': 'export const open = 1;\n',
        'package.json': JSON.stringify({ exports: './src/main.ts' }),
      });
      expect(runtimeImportsOfTestSupport(directory)).toEqual([
        { file: 'src/main.ts', specifier: './main-test-helpers.ts' },
      ]);
    });

    test('follows nested conditions and arrays but not type declarations or non-source targets', () => {
      const directory = scratchDirectory();
      writeFiles(directory, {
        'src/index.ts': 'export const run = 1;\n',
        'src/bun/index.ts': "import './bun-test-helpers.ts';\n",
        'src/bun/bun-test-helpers.ts': 'export const open = 1;\n',
        'src/node/index.ts': "import './node-test-helpers.ts';\n",
        'src/node/node-test-helpers.ts': 'export const open = 1;\n',
        'src/types-only.ts': "import './types-test-helpers.ts';\n",
        'src/types-test-helpers.ts': 'export const open = 1;\n',
        'src/declarations.d.ts': "import './declarations-test-helpers.ts';\n",
        'src/declarations-test-helpers.ts': 'export const open = 1;\n',
        'package.json': JSON.stringify({
          exports: {
            '.': { types: './src/types-only.ts', default: './src/index.ts' },
            './bun': { bun: { import: './src/bun/index.ts' }, default: null },
            './node': ['./src/node/index.ts', './missing.json'],
            './package.json': './package.json',
            './styles.css': './src/styles.css',
            './pattern/*': './src/pattern/*.ts',
            './declarations': './src/declarations.d.ts',
          },
        }),
      });
      expect(runtimeImportsOfTestSupport(directory)).toEqual([
        { file: 'src/bun/index.ts', specifier: './bun-test-helpers.ts' },
        { file: 'src/node/index.ts', specifier: './node-test-helpers.ts' },
      ]);
    });

    test('reports a helper reached from two entries once', () => {
      const directory = scratchDirectory();
      writeFiles(directory, {
        'src/index.ts': "export * from './shared.ts';\n",
        'src/bun/index.ts': "export * from '../shared.ts';\n",
        'src/shared.ts': "import './shared-test-helpers.ts';\n",
        'src/shared-test-helpers.ts': 'export const open = 1;\n',
        'package.json': JSON.stringify({
          exports: { '.': './src/index.ts', './bun': './src/bun/index.ts' },
        }),
      });
      expect(runtimeImportsOfTestSupport(directory)).toEqual([
        { file: 'src/shared.ts', specifier: './shared-test-helpers.ts' },
      ]);
    });

    test('requires every walkable target to exist, naming it', () => {
      const directory = scratchDirectory();
      writeFiles(directory, {
        'src/index.ts': 'export const run = 1;\n',
        'package.json': JSON.stringify({
          exports: { '.': './src/index.ts', './bun': './src/bun/index.ts' },
        }),
      });
      expect(() => runtimeImportsOfTestSupport(directory)).toThrow(
        'Package entry src/bun/index.ts does not exist',
      );
    });
  });
});
