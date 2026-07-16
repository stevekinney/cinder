import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type FunctionCoverage = {
  count: number;
  line: number;
};

type FileCoverage = {
  functions: Map<string, FunctionCoverage>;
  lines: Map<number, number>;
};

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
    const pendingFunctionHits = new Map<string, number>();

    for (const line of record.split(/\r?\n/)) {
      if (line.startsWith('FN:')) {
        const [lineNumber, name] = line.slice('FN:'.length).split(',', 2);
        if (lineNumber === undefined || name === undefined) continue;

        const existing = coverage.functions.get(name);
        const parsedLine = Number(lineNumber);
        coverage.functions.set(name, {
          count: existing?.count ?? 0,
          line: Number.isFinite(parsedLine) ? parsedLine : (existing?.line ?? 0),
        });
      } else if (line.startsWith('FNDA:')) {
        const [count, name] = line.slice('FNDA:'.length).split(',', 2);
        if (count === undefined || name === undefined) continue;
        pendingFunctionHits.set(name, (pendingFunctionHits.get(name) ?? 0) + Number(count));
      } else if (line.startsWith('DA:')) {
        const [lineNumber, count] = line.slice('DA:'.length).split(',', 2);
        if (lineNumber === undefined || count === undefined) continue;

        const parsedLine = Number(lineNumber);
        if (!Number.isFinite(parsedLine)) continue;
        coverage.lines.set(parsedLine, (coverage.lines.get(parsedLine) ?? 0) + Number(count));
      }
    }

    for (const [name, count] of pendingFunctionHits) {
      const existing = coverage.functions.get(name);
      coverage.functions.set(name, {
        count: (existing?.count ?? 0) + count,
        line: existing?.line ?? 0,
      });
    }
  }
}

function serializeLcov(files: Map<string, FileCoverage>): string {
  const records: string[] = [];

  for (const [file, coverage] of [...files.entries()].toSorted(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const functions = [...coverage.functions.entries()].toSorted(
      ([leftName, left], [rightName, right]) =>
        left.line - right.line || leftName.localeCompare(rightName),
    );
    const lines = [...coverage.lines.entries()].toSorted(([left], [right]) => left - right);

    const record = [`SF:${file}`];
    for (const [name, { line }] of functions) record.push(`FN:${line},${name}`);
    for (const [name, { count }] of functions) record.push(`FNDA:${count},${name}`);
    record.push(`FNF:${functions.length}`);
    record.push(`FNH:${functions.filter(([, { count }]) => count > 0).length}`);
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
  const merged = mergeLcovSources(await Promise.all(inputs.map((input) => Bun.file(input).text())));

  const outputPath = resolve(output);
  mkdirSync(dirname(outputPath), { recursive: true });
  await Bun.write(outputPath, merged);
}

if (import.meta.main) {
  try {
    await main();
  } catch (caught) {
    console.error(`merge-coverage-lcov failed: ${String(caught)}`);
    process.exit(1);
  }
}
