import { basename, extname } from 'node:path';

const POLICY_MESSAGE =
  'Pull request policy: timeout, retry, wait, and slow() threshold increases hide real slowness or races. Revert the threshold increase and fix the underlying failure in source or test code.';

type ThresholdKind = 'timeout' | 'timeout-minutes' | 'retries' | 'slow';

type ThresholdCandidate = {
  kind: ThresholdKind;
  identity: string;
  label: string;
  value: number;
  renderedValue: string;
  lineNumber: number;
  line: string;
};

export type TimeoutIncreaseViolation = {
  filePath: string;
  hunkHeader: string;
  old: ThresholdCandidate;
  new: ThresholdCandidate;
};

type DiffHunk = {
  filePath: string;
  hunkHeader: string;
  removed: ThresholdCandidate[];
  added: ThresholdCandidate[];
};

const SUPPORTED_EXTENSIONS = new Set([
  '.bash',
  '.cjs',
  '.js',
  '.jsx',
  '.mjs',
  '.sh',
  '.svelte',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
  '.zsh',
]);

const LOCKFILE_NAMES = new Set([
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

function isSupportedFile(filePath: string): boolean {
  if (LOCKFILE_NAMES.has(basename(filePath))) return false;
  return SUPPORTED_EXTENSIONS.has(extname(filePath));
}

function isCommentOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length === 0 ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('<!--')
  );
}

function parseNumericLiteral(literal: string): number {
  return Number(literal.replaceAll('_', ''));
}

function normalizeKind(label: string): ThresholdKind {
  const normalized = label.toLowerCase();
  if (normalized === 'timeout-minutes') return 'timeout-minutes';
  if (normalized.includes('slow')) return 'slow';
  if (normalized.includes('retr')) return 'retries';
  return 'timeout';
}

function pushCandidate(
  candidates: ThresholdCandidate[],
  line: string,
  lineNumber: number,
  label: string,
  renderedValue: string | undefined,
): void {
  if (renderedValue === undefined) return;
  const value = parseNumericLiteral(renderedValue);
  if (!Number.isFinite(value)) return;
  candidates.push({
    kind: normalizeKind(label),
    identity: `${normalizeKind(label)}:${line
      .trim()
      .toLowerCase()
      .replace(/\d[\d_]*(?:\.\d[\d_]*)?/gu, '<threshold>')}`,
    label,
    value,
    renderedValue,
    lineNumber,
    line: line.trim(),
  });
}

function extractThresholdCandidates(line: string, lineNumber: number): ThresholdCandidate[] {
  if (isCommentOnlyLine(line)) return [];

  const candidates: ThresholdCandidate[] = [];
  const thresholdAssignmentPattern =
    /\b(?<label>timeout-minutes|testTimeout|timeout|deadline|retries|retry|slow)\b[^\n\d-]{0,80}(?<value>\d[\d_]*(?:\.\d[\d_]*)?)/giu;
  for (const match of line.matchAll(thresholdAssignmentPattern)) {
    pushCandidate(
      candidates,
      line,
      lineNumber,
      match.groups?.['label'] ?? '',
      match.groups?.['value'],
    );
  }

  const cliPattern =
    /--(?<label>timeout-minutes|timeout|test-timeout|retries|retry|slow)(?:=|\s+)(?<value>\d[\d_]*(?:\.\d[\d_]*)?)/giu;
  for (const match of line.matchAll(cliPattern)) {
    pushCandidate(
      candidates,
      line,
      lineNumber,
      match.groups?.['label'] ?? '',
      match.groups?.['value'],
    );
  }

  const callPattern =
    /\b(?<label>waitForTimeout|setDefaultTimeout|setTimeout|slow)\s*\(\s*(?<value>\d[\d_]*(?:\.\d[\d_]*)?)/giu;
  for (const match of line.matchAll(callPattern)) {
    pushCandidate(
      candidates,
      line,
      lineNumber,
      match.groups?.['label'] ?? '',
      match.groups?.['value'],
    );
  }

  const implicitSlowMatch = /^\s*test\.(?<label>slow)\s*\(\s*\)\s*;?\s*$/iu.exec(line);
  if (implicitSlowMatch !== null) {
    pushCandidate(candidates, line, lineNumber, implicitSlowMatch.groups?.['label'] ?? '', '3');
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.identity}:${candidate.renderedValue}:${candidate.lineNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseHunkStart(header: string): { oldLine: number; newLine: number } {
  const match = /^@@ -(?<oldLine>\d+)(?:,\d+)? \+(?<newLine>\d+)(?:,\d+)? @@/u.exec(header);
  if (match?.groups === undefined) {
    return { oldLine: 0, newLine: 0 };
  }
  return {
    oldLine: Number(match.groups['oldLine']),
    newLine: Number(match.groups['newLine']),
  };
}

function collectComparableViolations(hunk: DiffHunk): TimeoutIncreaseViolation[] {
  const violations: TimeoutIncreaseViolation[] = [];
  const identities = new Set([
    ...hunk.removed.map((candidate) => candidate.identity),
    ...hunk.added.map((candidate) => candidate.identity),
  ]);

  for (const identity of identities) {
    const removed = hunk.removed
      .filter((candidate) => candidate.identity === identity)
      .toSorted((left, right) => right.value - left.value);
    const added = hunk.added
      .filter((candidate) => candidate.identity === identity)
      .toSorted((left, right) => right.value - left.value);
    const comparableCount = Math.min(removed.length, added.length);

    for (let index = 0; index < comparableCount; index += 1) {
      const oldCandidate = removed[index];
      const newCandidate = added[index];
      if (oldCandidate === undefined || newCandidate === undefined) continue;
      if (newCandidate.value > oldCandidate.value) {
        violations.push({
          filePath: hunk.filePath,
          hunkHeader: hunk.hunkHeader,
          old: oldCandidate,
          new: newCandidate,
        });
      }
    }

    if (!identity.includes('slow:test.slow()')) continue;
    for (const newCandidate of added.slice(removed.length)) {
      violations.push({
        filePath: hunk.filePath,
        hunkHeader: hunk.hunkHeader,
        old: {
          ...newCandidate,
          value: 1,
          renderedValue: '1 (implicit normal timeout)',
          line: 'test runs with the normal timeout (no test.slow())',
        },
        new: newCandidate,
      });
    }
  }

  return violations;
}

export function findTimeoutIncreaseViolations(diff: string): TimeoutIncreaseViolation[] {
  const violations: TimeoutIncreaseViolation[] = [];
  let currentFilePath = '';
  let currentHunk: DiffHunk | undefined;
  let oldLine = 0;
  let newLine = 0;

  const flushHunk = (): void => {
    if (currentHunk === undefined) return;
    violations.push(...collectComparableViolations(currentHunk));
    currentHunk = undefined;
  };

  for (const rawLine of diff.split('\n')) {
    if (rawLine.startsWith('+++ ')) {
      flushHunk();
      const path = rawLine.slice(4).trim();
      currentFilePath = path.startsWith('b/') ? path.slice(2) : path;
      if (currentFilePath === '/dev/null') currentFilePath = '';
      continue;
    }

    if (rawLine.startsWith('@@ ')) {
      flushHunk();
      const starts = parseHunkStart(rawLine);
      oldLine = starts.oldLine;
      newLine = starts.newLine;
      currentHunk = isSupportedFile(currentFilePath)
        ? { filePath: currentFilePath, hunkHeader: rawLine, removed: [], added: [] }
        : undefined;
      continue;
    }

    if (currentHunk === undefined) continue;
    if (rawLine.startsWith('--- ')) continue;

    if (rawLine.startsWith('-')) {
      const content = rawLine.slice(1);
      currentHunk.removed.push(...extractThresholdCandidates(content, oldLine));
      oldLine += 1;
      continue;
    }

    if (rawLine.startsWith('+')) {
      const content = rawLine.slice(1);
      currentHunk.added.push(...extractThresholdCandidates(content, newLine));
      newLine += 1;
      continue;
    }

    if (rawLine.startsWith(' ')) {
      oldLine += 1;
      newLine += 1;
    }
  }

  flushHunk();
  return violations;
}

export function formatTimeoutIncreaseViolations(
  violations: readonly TimeoutIncreaseViolation[],
): string {
  if (violations.length === 0) return 'check-timeout-increases — OK\n';
  const lines = [
    'check-timeout-increases — timeout/retry threshold increase(s) detected.',
    POLICY_MESSAGE,
    '',
  ];
  for (const violation of violations) {
    lines.push(
      `${violation.filePath} ${violation.hunkHeader}`,
      `  old line ${violation.old.lineNumber}: ${violation.old.line}`,
      `  new line ${violation.new.lineNumber}: ${violation.new.line}`,
      `  ${violation.old.label} ${violation.old.renderedValue} -> ${violation.new.label} ${violation.new.renderedValue}`,
      '',
    );
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

async function readDiffInput(): Promise<string> {
  const standardInput = await Bun.stdin.text();
  if (standardInput.trim().length > 0) return standardInput;

  const baseRef = Bun.env['BASE_REF'] ?? Bun.env['GITHUB_BASE_REF'];
  if (baseRef === undefined || baseRef.trim().length === 0) return standardInput;

  const result = Bun.spawnSync(['git', 'diff', '--unified=0', `origin/${baseRef}...HEAD`], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `could not read fallback diff against origin/${baseRef}: ${result.stderr.toString().trim()}`,
    );
  }
  return result.stdout.toString();
}

async function main(): Promise<void> {
  const diff = await readDiffInput();
  const violations = findTimeoutIncreaseViolations(diff);
  const output = formatTimeoutIncreaseViolations(violations);
  if (violations.length > 0) {
    process.stderr.write(output);
    process.exit(1);
  }
  process.stdout.write(output);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-timeout-increases failed:', error);
    process.exit(1);
  });
}
