import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type CoverageThresholds = {
  functions: number;
  lines: number;
};

export type CoverageThresholdConfiguration = CoverageThresholds & {
  svelte?: CoverageThresholds;
};

export type CoverageRecord = {
  file: string;
  functionsFound: number;
  functionsHit: number;
  linesFound: number;
  linesHit: number;
};

export type CoverageAverages = {
  files: number;
  functions: number;
  functionsFound: number;
  functionsHit: number;
  lines: number;
  linesFound: number;
  linesHit: number;
};

type CoverageScope = 'runtime' | 'svelte';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = resolve(scriptDirectory, '..');

export function parseCoverageThresholds(source: string): CoverageThresholdConfiguration {
  const parsed: unknown = JSON.parse(source);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('lines' in parsed) ||
    typeof parsed.lines !== 'number' ||
    !('functions' in parsed) ||
    typeof parsed.functions !== 'number'
  ) {
    throw new Error('coverage-ratchet.json must define numeric lines and functions thresholds.');
  }

  if (!isRatchetThreshold(parsed.lines) || !isRatchetThreshold(parsed.functions)) {
    throw new Error('Coverage thresholds must be decimals between 0 and 1.');
  }

  const thresholds: CoverageThresholdConfiguration = {
    lines: parsed.lines,
    functions: parsed.functions,
  };

  if ('svelte' in parsed && parsed.svelte !== undefined) {
    if (
      typeof parsed.svelte !== 'object' ||
      parsed.svelte === null ||
      !('lines' in parsed.svelte) ||
      typeof parsed.svelte.lines !== 'number' ||
      !('functions' in parsed.svelte) ||
      typeof parsed.svelte.functions !== 'number'
    ) {
      throw new Error(
        'coverage-ratchet.json svelte thresholds must define numeric lines and functions thresholds.',
      );
    }

    if (!isRatchetThreshold(parsed.svelte.lines) || !isRatchetThreshold(parsed.svelte.functions)) {
      throw new Error('Coverage thresholds must be decimals between 0 and 1.');
    }

    thresholds.svelte = {
      lines: parsed.svelte.lines,
      functions: parsed.svelte.functions,
    };
  }

  return thresholds;
}

function isRatchetThreshold(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * Transient SSR test modules written by component SSR and hydration helpers.
 * They compile source into temporary `.mjs` files, import the files for one
 * render, then delete them. Bun still instruments these modules while they are
 * imported, so they land in the LCOV report even though they are not library
 * source — and because they exercise only a fraction of each component's
 * functions, they drag the aggregate below the real number. They are not
 * shippable code and carry no coverage obligation, so exclude them from the
 * ratchet aggregate.
 */
function isTransientTestArtifact(file: string, packageRoot: string): boolean {
  // Matches the generated contract from server-render.ts / hydrate.ts:
  // `.cinder-ssr-<pid>-<epoch-ms>-<base36 rand>.mjs`. The leading `(?:^|/)` and
  // the trailing `$` anchor the match to the final path segment, so a real
  // source file that merely has the prefix inside a directory name (e.g.
  // `.cinder-ssr-…mjs/real.ts`) is never excluded.
  if (/(?:^|\/)\.cinder-ssr-\d+-\d+-[a-z0-9]+(?:\.svelte-server)?\.mjs$/.test(file)) {
    return true;
  }

  // SSR probes may generate named `.cinder-ssr-*-<pid>-<epoch-ms>.mjs` files
  // next to the source. They have the same one-render temporary-module shape.
  if (/(?:^|\/)\.cinder-ssr-[a-z0-9-]+-\d+-\d+(?:\.svelte-server)?\.mjs$/.test(file)) {
    return true;
  }

  // hydration-safety.ts writes paired server/client bundles into the package
  // root's `tmp/hydration-safety`, imports them once, then unlinks them.
  const normalizedFile = file.replaceAll('\\', '/');
  const normalizedPackageRoot = packageRoot.replaceAll('\\', '/');
  const artifactPrefix = 'tmp/hydration-safety/';
  const packageArtifactPrefix = `${normalizedPackageRoot}/tmp/hydration-safety/`;
  let artifactFileName = '';
  if (normalizedFile.startsWith(packageArtifactPrefix)) {
    artifactFileName = normalizedFile.slice(packageArtifactPrefix.length);
  } else if (normalizedFile.startsWith(artifactPrefix)) {
    artifactFileName = normalizedFile.slice(artifactPrefix.length);
  }

  return /^(?:client|server)-\d+-\d+-[a-z0-9]+(?:\.svelte-server)?\.mjs$/.test(artifactFileName);
}

/**
 * Bun follows source maps into sibling workspaces when component tests exercise
 * packed private packages such as @cinder/editor and @cinder/markdown. Those
 * packages have their own validation scripts; this ratchet is scoped to the
 * @lostgradient/cinder package directory.
 */
function isOutsidePackageRootSourceMap(file: string, packageRoot: string): boolean {
  const relativeFile = toPackageRootRelativePath(file, packageRoot);
  return relativeFile === '..' || relativeFile.startsWith('../');
}

function toPackageRootRelativePath(file: string, packageRoot: string): string {
  const absoluteFile = isAbsolute(file) ? file : resolve(packageRoot, file);
  return relative(packageRoot, absoluteFile).replaceAll('\\', '/');
}

/**
 * Keep the default ratchet focused on package runtime TypeScript that Bun can
 * measure deterministically. Svelte component modules and `.svelte.ts` rune
 * modules are checked by a separate measured gate because Bun's generated
 * source maps report them as large mostly-unhit generated functions. Test
 * harnesses and package scripts are validated by their own direct tests and
 * gates, not by the public runtime-source ratchet.
 */
function isOutsideCoverageScope(file: string, scope: CoverageScope, packageRoot: string): boolean {
  const normalizedFile = toPackageRootRelativePath(file, packageRoot);
  if (normalizedFile.startsWith('scripts/')) return true;
  // The CLI entrypoint is tested as a subprocess so process I/O matches the
  // published binary. Bun does not merge subprocess LCOV into the parent report,
  // so keep only that entrypoint out of the in-process runtime ratchet.
  if (normalizedFile === 'src/cli/index.ts') return true;
  if (normalizedFile.endsWith('.test.ts') || normalizedFile.endsWith('.spec.ts')) return true;
  if (normalizedFile.startsWith('src/test/') || normalizedFile.startsWith('src/lib/test/')) {
    return true;
  }
  const isSvelteSource =
    normalizedFile.endsWith('.svelte') || normalizedFile.endsWith('.svelte.ts');
  if (scope === 'runtime') return isSvelteSource;
  return !isSvelteSource;
}

export function parseRuntimeLcovRecords(
  source: string,
  packageRoot: string = defaultPackageRoot,
): CoverageRecord[] {
  return parseLcovRecords(source, 'runtime', packageRoot);
}

export function parseSvelteLcovRecords(
  source: string,
  packageRoot: string = defaultPackageRoot,
): CoverageRecord[] {
  return parseLcovRecords(source, 'svelte', packageRoot);
}

export function parseLcovRecords(source: string): CoverageRecord[];
export function parseLcovRecords(source: string, scope: CoverageScope): CoverageRecord[];
export function parseLcovRecords(
  source: string,
  scope: CoverageScope,
  packageRoot: string,
): CoverageRecord[];
export function parseLcovRecords(
  source: string,
  scope: CoverageScope = 'runtime',
  packageRoot: string = defaultPackageRoot,
): CoverageRecord[] {
  return parseAllLcovRecords(source).filter(
    (record) =>
      !isTransientTestArtifact(record.file, packageRoot) &&
      !isOutsidePackageRootSourceMap(record.file, packageRoot) &&
      !isOutsideCoverageScope(record.file, scope, packageRoot),
  );
}

function parseAllLcovRecords(source: string): CoverageRecord[] {
  return source
    .split('end_of_record')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const lines = record.split(/\r?\n/);
      const file = readStringField(lines, 'SF');
      return {
        file,
        functionsFound: readNumberField(lines, 'FNF'),
        functionsHit: readNumberField(lines, 'FNH'),
        linesFound: readNumberField(lines, 'LF'),
        linesHit: readNumberField(lines, 'LH'),
      };
    });
}

function readStringField(lines: string[], key: string): string {
  const prefix = `${key}:`;
  const value = lines.find((line) => line.startsWith(prefix))?.slice(prefix.length);
  if (!value) throw new Error(`LCOV record is missing ${key}.`);
  return value;
}

function readNumberField(lines: string[], key: string): number {
  const value = readStringField(lines, key);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`LCOV field ${key} must be numeric.`);
  return parsed;
}

export function computeCoverageAverages(records: CoverageRecord[]): CoverageAverages {
  if (records.length === 0) throw new Error('LCOV report did not contain any records.');

  let functionsFound = 0;
  let functionsHit = 0;
  let linesFound = 0;
  let linesHit = 0;

  for (const record of records) {
    functionsFound += record.functionsFound;
    functionsHit += record.functionsHit;
    linesFound += record.linesFound;
    linesHit += record.linesHit;
  }

  return {
    files: records.length,
    functions: percentage(functionsHit, functionsFound),
    functionsFound,
    functionsHit,
    lines: percentage(linesHit, linesFound),
    linesFound,
    linesHit,
  };
}

function percentage(hit: number, found: number): number {
  return found === 0 ? 100 : (hit / found) * 100;
}

export function coverageFailures(
  averages: CoverageAverages,
  thresholds: CoverageThresholds,
): string[] {
  const failures: string[] = [];
  if (averages.functions / 100 < thresholds.functions) {
    failures.push(
      `functions ${formatPercentage(averages.functions)} < ${formatThreshold(thresholds.functions)}`,
    );
  }
  if (averages.lines / 100 < thresholds.lines) {
    failures.push(
      `lines ${formatPercentage(averages.lines)} < ${formatThreshold(thresholds.lines)}`,
    );
  }
  return failures;
}

export function formatCoverageSummary(
  averages: CoverageAverages,
  thresholds: CoverageThresholds,
  label = 'Coverage ratchet',
): string {
  return [
    `${label} (${averages.files} files):`,
    `functions ${formatPercentage(averages.functions)} >= ${formatThreshold(thresholds.functions)}`,
    `lines ${formatPercentage(averages.lines)} >= ${formatThreshold(thresholds.lines)}`,
  ].join(' ');
}

function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatThreshold(value: number): string {
  return formatPercentage(value * 100);
}

/**
 * The unhit line numbers of every in-scope file that has at least one, keyed by
 * the same scope filters the ratchet aggregates over. A bare "runtime lines
 * 99.88% < 100%" failure is otherwise un-actionable in CI, where the coverage
 * environment (which tests run, which modules load) can differ from a local
 * build and the offending lines are invisible in the logs.
 */
export function uncoveredLineReport(
  source: string,
  scope: CoverageScope,
  packageRoot: string = defaultPackageRoot,
): { file: string; unhitLines: number[] }[] {
  const report: { file: string; unhitLines: number[] }[] = [];
  for (const rawRecord of source.split('end_of_record')) {
    const lines = rawRecord.split(/\r?\n/);
    const sourceFile = lines.find((line) => line.startsWith('SF:'))?.slice('SF:'.length);
    if (sourceFile === undefined || sourceFile === '') continue;
    if (
      isTransientTestArtifact(sourceFile, packageRoot) ||
      isOutsidePackageRootSourceMap(sourceFile, packageRoot) ||
      isOutsideCoverageScope(sourceFile, scope, packageRoot)
    ) {
      continue;
    }
    const unhitLines: number[] = [];
    for (const line of lines) {
      if (!line.startsWith('DA:')) continue;
      const [lineNumber, hitCount] = line.slice('DA:'.length).split(',');
      if (hitCount === '0' && lineNumber !== undefined) unhitLines.push(Number(lineNumber));
    }
    if (unhitLines.length > 0) {
      report.push({ file: toPackageRootRelativePath(sourceFile, packageRoot), unhitLines });
    }
  }
  return report;
}

/** Condense a sorted line-number list into compact ranges: `[1,2,3,7] → "1-3, 7"`. */
export function formatLineRanges(lineNumbers: number[]): string {
  const sorted = [...new Set(lineNumbers)].toSorted((a, b) => a - b);
  const ranges: string[] = [];
  let start: number | undefined;
  let previous: number | undefined;
  for (const line of sorted) {
    if (start === undefined || previous === undefined) {
      start = line;
      previous = line;
    } else if (line === previous + 1) {
      previous = line;
    } else {
      ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
      start = line;
      previous = line;
    }
  }
  if (start !== undefined && previous !== undefined) {
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
  }
  return ranges.join(', ');
}

export async function main(): Promise<void> {
  const packageRootArgumentIndex = process.argv.indexOf('--package-root');
  const packageRootArgument =
    packageRootArgumentIndex >= 0 ? process.argv[packageRootArgumentIndex + 1] : undefined;
  if (packageRootArgumentIndex >= 0 && packageRootArgument === undefined) {
    throw new Error('--package-root requires a path argument');
  }
  const packageRoot = packageRootArgument
    ? resolve(process.cwd(), packageRootArgument)
    : defaultPackageRoot;
  const thresholdsPath = resolve(packageRoot, 'coverage-ratchet.json');
  const coveragePath = resolve(packageRoot, 'coverage/lcov.info');
  const thresholds = parseCoverageThresholds(await Bun.file(thresholdsPath).text());
  const coverageSource = await Bun.file(coveragePath).text();
  const averages = computeCoverageAverages(parseRuntimeLcovRecords(coverageSource, packageRoot));
  const summaries = [formatCoverageSummary(averages, thresholds)];
  const failures = coverageFailures(averages, thresholds).map((failure) => `runtime ${failure}`);

  if (thresholds.svelte) {
    const svelteAverages = computeCoverageAverages(
      parseSvelteLcovRecords(coverageSource, packageRoot),
    );
    summaries.push(
      formatCoverageSummary(svelteAverages, thresholds.svelte, 'Svelte coverage ratchet'),
    );
    failures.push(
      ...coverageFailures(svelteAverages, thresholds.svelte).map((failure) => `svelte ${failure}`),
    );
  }

  if (failures.length > 0) {
    console.error(`${summaries.join('\n')} Failed: ${failures.join(', ')}.`);
    const scopesToReport: CoverageScope[] = [];
    if (failures.some((failure) => failure.startsWith('runtime lines')))
      scopesToReport.push('runtime');
    if (failures.some((failure) => failure.startsWith('svelte lines')))
      scopesToReport.push('svelte');
    for (const scope of scopesToReport) {
      const gaps = uncoveredLineReport(coverageSource, scope, packageRoot);
      if (gaps.length === 0) continue;
      console.error(`\nUncovered ${scope} lines (${gaps.length} file(s)):`);
      for (const { file, unhitLines } of gaps) {
        console.error(`  ${file}: ${formatLineRanges(unhitLines)}`);
      }
    }
    process.exit(1);
  }

  console.log(summaries.join('\n'));
}

if (import.meta.main) await main();
