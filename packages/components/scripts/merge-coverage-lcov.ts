import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');

type FunctionCoverage = {
  name: string;
  line: number;
  count: number;
};

type FileCoverage = {
  // Keyed by `${line}\0${name}` — line alone collides when two functions
  // start on the same line (compact callbacks, object methods).
  functions: Map<string, FunctionCoverage>;
  lines: Map<number, number>;
  summaryOnlyFunctionsFound: number;
  summaryOnlyFunctionsHit: number;
};

function functionKey(line: number, name: string): string {
  return `${line}\0${name}`;
}

function parseArguments(argv: string[]): { inputs: string[]; output: string } {
  const outputIndex = argv.indexOf('--output');
  if (outputIndex === -1 || argv[outputIndex + 1] === undefined) {
    throw new Error('Usage: merge-coverage-lcov.ts <lcov...> --output <lcov>');
  }

  const inputs = argv.slice(0, outputIndex);
  if (inputs.length === 0) throw new Error('At least one LCOV input is required.');

  return { inputs, output: argv[outputIndex + 1]! };
}

function coverageForFile(files: Map<string, FileCoverage>, file: string): FileCoverage {
  const existing = files.get(file);
  if (existing !== undefined) return existing;

  const coverage = {
    functions: new Map<string, FunctionCoverage>(),
    lines: new Map<number, number>(),
    summaryOnlyFunctionsFound: 0,
    summaryOnlyFunctionsHit: 0,
  };
  files.set(file, coverage);
  return coverage;
}

function parseLcov(source: string, files: Map<string, FileCoverage>): void {
  for (const rawRecord of source.split('end_of_record')) {
    const record = rawRecord.trim();
    if (record.length === 0) continue;

    const fileLine = record.split(/\r?\n/).find((line) => line.startsWith('SF:'));
    const file = fileLine?.slice('SF:'.length);
    if (file === undefined || file.length === 0) {
      throw new Error('LCOV record is missing SF.');
    }

    const coverage = coverageForFile(files, file);

    // Duplicate function names (e.g. two nested `visit` helpers) can't be told
    // apart by name alone, so FNDA hits are matched to the FN entry with the
    // same name that appears earliest and hasn't been consumed yet.
    const pendingLinesByName = new Map<string, number[]>();
    let hasFunctionDetail = false;
    let summaryFunctionsFound: number | undefined;
    let summaryFunctionsHit: number | undefined;

    for (const line of record.split(/\r?\n/)) {
      if (line.startsWith('FN:')) {
        const [lineNumber, name] = line.slice('FN:'.length).split(',', 2);
        if (lineNumber === undefined || name === undefined) continue;

        const parsedLine = Number(lineNumber);
        if (!Number.isFinite(parsedLine)) continue;

        hasFunctionDetail = true;
        const queue = pendingLinesByName.get(name) ?? [];
        queue.push(parsedLine);
        pendingLinesByName.set(name, queue);
        const key = functionKey(parsedLine, name);
        if (!coverage.functions.has(key)) {
          coverage.functions.set(key, { name, line: parsedLine, count: 0 });
        }
      } else if (line.startsWith('FNDA:')) {
        const [count, name] = line.slice('FNDA:'.length).split(',', 2);
        if (count === undefined || name === undefined) continue;

        const functionLine = pendingLinesByName.get(name)?.shift();
        if (functionLine === undefined) continue;

        const key = functionKey(functionLine, name);
        const existing = coverage.functions.get(key);
        coverage.functions.set(key, {
          name,
          line: functionLine,
          count: (existing?.count ?? 0) + Number(count),
        });
      } else if (line.startsWith('FNF:')) {
        summaryFunctionsFound = Number(line.slice('FNF:'.length));
      } else if (line.startsWith('FNH:')) {
        summaryFunctionsHit = Number(line.slice('FNH:'.length));
      } else if (line.startsWith('DA:')) {
        const [lineNumber, count] = line.slice('DA:'.length).split(',', 2);
        if (lineNumber === undefined || count === undefined) continue;

        const parsedLine = Number(lineNumber);
        if (!Number.isFinite(parsedLine)) continue;
        coverage.lines.set(parsedLine, (coverage.lines.get(parsedLine) ?? 0) + Number(count));
      }
    }

    // Bun sometimes emits FNF/FNH summary counts with no per-function FN/FNDA
    // detail for a file. Fold that summary in rather than discarding it, or
    // the merged report silently reports 0 functions (100% coverage) for it.
    //
    // Summary-only records carry no function identity, so when the same file
    // appears in more than one shard there is no way to tell whether the
    // shards hit the same functions (correct combined count = max) or
    // disjoint ones (correct combined count = sum, up to FNF). Taking the max
    // can undercount in the disjoint case; summing can double-count in the
    // same-function case. Max is the safer default for a ratchet: undercount
    // can only cause a false-fail (blocks a legitimate PR), while summing's
    // overcount risks a false-pass that hides a real coverage regression.
    if (!hasFunctionDetail && summaryFunctionsFound !== undefined) {
      coverage.summaryOnlyFunctionsFound = Math.max(
        coverage.summaryOnlyFunctionsFound,
        summaryFunctionsFound,
      );
      coverage.summaryOnlyFunctionsHit = Math.max(
        coverage.summaryOnlyFunctionsHit,
        summaryFunctionsHit ?? 0,
      );
    }
  }
}

function serializeLcov(files: Map<string, FileCoverage>): string {
  const records: string[] = [];

  for (const [file, coverage] of [...files.entries()].toSorted(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const functions = [...coverage.functions.values()].toSorted(
      (left, right) => left.line - right.line || left.name.localeCompare(right.name),
    );
    const lines = [...coverage.lines.entries()].toSorted(([left], [right]) => left - right);

    // A summary-only record for this file from one shard describes the same
    // inventory a detailed shard already counted via FN/FNDA — fall back to
    // the summary only when no shard ever gave per-function detail, or the
    // two would be added together and double-count the file's functions.
    const functionsFound =
      functions.length > 0 ? functions.length : coverage.summaryOnlyFunctionsFound;
    const functionsHit =
      functions.length > 0
        ? functions.filter(({ count }) => count > 0).length
        : coverage.summaryOnlyFunctionsHit;

    const record = [`SF:${file}`];
    for (const { line, name } of functions) record.push(`FN:${line},${name}`);
    for (const { name, count } of functions) record.push(`FNDA:${count},${name}`);
    record.push(`FNF:${functionsFound}`);
    record.push(`FNH:${functionsHit}`);
    for (const [line, count] of lines) record.push(`DA:${line},${count}`);
    record.push(`LF:${lines.length}`);
    record.push(`LH:${lines.filter(([, count]) => count > 0).length}`);
    record.push('end_of_record');
    records.push(record.join('\n'));
  }

  return `${records.join('\n')}\n`;
}

export function mergeLcovSources(sources: string[]): string {
  const files = new Map<string, FileCoverage>();
  for (const source of sources) parseLcov(source, files);
  return serializeLcov(files);
}

async function main(): Promise<void> {
  const { inputs, output } = parseArguments(process.argv.slice(2));
  const merged = mergeLcovSources(
    await Promise.all(inputs.map((input) => Bun.file(resolve(packageRoot, input)).text())),
  );

  const outputPath = resolve(packageRoot, output);
  mkdirSync(dirname(outputPath), { recursive: true });
  await Bun.write(outputPath, merged);
}

if (import.meta.main) {
  try {
    await main();
  } catch (caught) {
    console.error('merge-coverage-lcov failed:', caught);
    process.exit(1);
  }
}
