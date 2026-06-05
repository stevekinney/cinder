import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type CoverageThresholds = {
  functions: number;
  lines: number;
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

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const defaultThresholdsPath = resolve(packageRoot, 'coverage-ratchet.json');
const defaultCoveragePath = resolve(packageRoot, 'coverage/lcov.info');

export function parseCoverageThresholds(source: string): CoverageThresholds {
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

  return { lines: parsed.lines, functions: parsed.functions };
}

function isRatchetThreshold(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * Transient SSR test modules written by `src/test/server-render.ts` and
 * `src/test/hydrate.ts`. They compile a component in `generate: 'server'` mode
 * to a `.cinder-ssr-<pid>-<time>-<rand>.mjs` file next to the source, import it
 * for one render, then delete it. Bun still instruments these modules while
 * they are imported, so they land in the LCOV report even though they are not
 * library source — and at ~56% function coverage they drag the aggregate below
 * the real number (82% vs. a polluted 80.6%). They are not shippable code and
 * carry no coverage obligation, so exclude them from the ratchet aggregate.
 */
function isTransientTestArtifact(file: string): boolean {
  // Matches the generated contract from server-render.ts / hydrate.ts:
  // `.cinder-ssr-<pid>-<epoch-ms>-<base36 rand>.mjs`. Anchored to the final path
  // segment (the leading `(?:^|/)` plus `[^/]*` end) so a real source file that
  // merely has the prefix inside a directory name is never excluded.
  return /(?:^|\/)\.cinder-ssr-\d+-\d+-[a-z0-9]+\.mjs$/.test(file);
}

export function parseLcovRecords(source: string): CoverageRecord[] {
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
    })
    .filter((record) => !isTransientTestArtifact(record.file));
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
): string {
  return [
    `Coverage ratchet (${averages.files} files):`,
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

export async function main(): Promise<void> {
  const thresholds = parseCoverageThresholds(await Bun.file(defaultThresholdsPath).text());
  const averages = computeCoverageAverages(
    parseLcovRecords(await Bun.file(defaultCoveragePath).text()),
  );
  const failures = coverageFailures(averages, thresholds);

  if (failures.length > 0) {
    console.error(`${formatCoverageSummary(averages, thresholds)} Failed: ${failures.join(', ')}.`);
    process.exit(1);
  }

  console.log(formatCoverageSummary(averages, thresholds));
}

if (import.meta.main) await main();
