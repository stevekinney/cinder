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
  lines: number;
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const defaultBunfigPath = resolve(packageRoot, 'bunfig.toml');
const defaultCoveragePath = resolve(packageRoot, 'coverage/lcov.info');

export function parseCoverageThresholds(source: string): CoverageThresholds {
  const objectMatch = source.match(/coverageThreshold\s*=\s*\{([^}]*)\}/);
  if (objectMatch) {
    const body = objectMatch[1]!;
    const lines = readThresholdProperty(body, 'lines');
    const functions = readThresholdProperty(body, 'functions');
    if (lines === undefined || functions === undefined) {
      throw new Error('coverageThreshold must define both lines and functions.');
    }
    return { lines, functions };
  }

  const singleMatch = source.match(/coverageThreshold\s*=\s*([0-9]*\.?[0-9]+)/);
  if (!singleMatch) {
    throw new Error('coverageThreshold was not found in bunfig.toml.');
  }

  const threshold = Number(singleMatch[1]);
  return { lines: threshold, functions: threshold };
}

function readThresholdProperty(
  source: string,
  property: keyof CoverageThresholds,
): number | undefined {
  const match = source.match(new RegExp(`${property}\\s*=\\s*([0-9]*\\.?[0-9]+)`));
  return match ? Number(match[1]) : undefined;
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

  let functions = 0;
  let lines = 0;

  for (const record of records) {
    functions += percentage(record.functionsHit, record.functionsFound);
    lines += percentage(record.linesHit, record.linesFound);
  }

  return {
    files: records.length,
    functions: functions / records.length,
    lines: lines / records.length,
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
  const thresholds = parseCoverageThresholds(await Bun.file(defaultBunfigPath).text());
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
