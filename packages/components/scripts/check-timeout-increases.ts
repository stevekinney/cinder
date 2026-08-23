import { basename, extname } from 'node:path';

const POLICY_MESSAGE =
  'Pull request policy: timeout, retry, wait, and slow() threshold increases hide real slowness or races. Revert the threshold increase and fix the underlying failure in source or test code.';

type ThresholdKind = 'timeout' | 'timeout-minutes' | 'retries' | 'slow';

type ThresholdCandidate = {
  baselineRenderedValue?: string;
  baselineValue?: number;
  kind: ThresholdKind;
  identity: string;
  label: string;
  effectiveValue: number;
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
  oldSource: Array<{ line: string; lineNumber: number }>;
  newSource: Array<{ line: string; lineNumber: number }>;
};

const SUPPORTED_EXTENSIONS = new Set([
  '.bash',
  '.cjs',
  '.js',
  '.jsx',
  '.json',
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

function stripQuotedText(line: string): string {
  let quote: '"' | "'" | '`' | undefined;
  let escaped = false;
  return Array.from(line)
    .map((character) => {
      if (quote === undefined) {
        if (character === '"' || character === "'" || character === '`') {
          quote = character;
          return ' ';
        }
        return character;
      }
      if (escaped) {
        escaped = false;
        return ' ';
      }
      if (character === '\\') {
        escaped = true;
        return ' ';
      }
      if (character === quote) quote = undefined;
      return ' ';
    })
    .join('');
}

function stripUnquotedHashComment(line: string): string {
  let quote: '"' | "'" | undefined;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote !== undefined) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '#' && (index === 0 || /\s/u.test(line[index - 1] ?? ''))) {
      return line.slice(0, index);
    }
  }
  return line;
}

function exposeQuotedConfigurationKeys(line: string): string {
  return line.replace(
    /(?<quote>['"])(?<key>[A-Za-z_$][\w$-]*)\k<quote>(?=\s*:)/gu,
    (_match, _quote: string, key: string) => key,
  );
}

function sourceLineForAnalysis(filePath: string, line: string): string {
  const extension = extname(filePath);
  if (['.cjs', '.js', '.jsx', '.mjs', '.svelte', '.ts', '.tsx'].includes(extension)) {
    return stripQuotedText(exposeQuotedConfigurationKeys(line)).replace(/(?:\/\/|\/\*).*$/u, '');
  }
  if (['.bash', '.sh', '.yaml', '.yml', '.zsh'].includes(extension)) {
    return stripUnquotedHashComment(line);
  }
  return line;
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

function implicitBaselineFor(label: string): { renderedValue: string; value: number } | undefined {
  const kind = normalizeKind(label);
  if (kind === 'retries') return { renderedValue: '0 (implicit default retries)', value: 0 };
  if (kind === 'slow') return { renderedValue: '1 (implicit normal timeout)', value: 1 };
  return undefined;
}

function isTestConfigurationRetry(filePath: string, analysis: string, label: string): boolean {
  if (normalizeKind(label) !== 'retries') return true;
  return (
    /\btest\.describe\.configure\s*\(/u.test(analysis) ||
    /(?:^|\/)(?:jest|playwright|vitest)\.config\.[^/]+$/u.test(filePath)
  );
}

function effectiveThresholdValue(label: string, line: string, value: number): number {
  if (value !== 0 || normalizeKind(label) !== 'timeout') return value;
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel === 'waitfortimeout') return value;
  if (normalizedLabel === 'settimeout' && !/\btest\.setTimeout\s*\(/u.test(line)) return value;
  return Number.POSITIVE_INFINITY;
}

function pushCandidate(
  candidates: ThresholdCandidate[],
  line: string,
  lineNumber: number,
  label: string,
  renderedValue: string | undefined,
  baseline?: { renderedValue: string; value: number },
): void {
  if (renderedValue === undefined) return;
  const value = parseNumericLiteral(renderedValue);
  if (!Number.isFinite(value)) return;
  candidates.push({
    ...(baseline === undefined
      ? {}
      : {
          baselineRenderedValue: baseline.renderedValue,
          baselineValue: baseline.value,
        }),
    kind: normalizeKind(label),
    identity: normalizeKind(label),
    label,
    effectiveValue: effectiveThresholdValue(label, line, value),
    value,
    renderedValue,
    lineNumber,
    line: line.trim(),
  });
}

function extractThresholdCandidates(
  filePath: string,
  line: string,
  lineNumber: number,
): ThresholdCandidate[] {
  if (isCommentOnlyLine(line)) return [];
  const analysisLine = sourceLineForAnalysis(filePath, line);

  const candidates: ThresholdCandidate[] = [];
  const thresholdAssignmentPattern =
    /\b(?<label>timeout-minutes|testTimeout|timeout|deadline|retries|retry|slow)\b[^\n\d-]{0,80}(?<value>\d[\d_]*(?:\.\d[\d_]*)?)/giu;
  for (const match of analysisLine.matchAll(thresholdAssignmentPattern)) {
    const label = match.groups?.['label'] ?? '';
    if (!isTestConfigurationRetry(filePath, analysisLine, label)) continue;
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label),
    );
  }

  const namedThresholdAssignmentPattern =
    /\b(?<label>(?:[A-Z][A-Z0-9_]*(?:TIMEOUT|WAIT|DEADLINE|RETRY|RETRIES)[A-Z0-9_]*)|(?:[A-Za-z_$][\w$]*(?:Timeout|Wait|Deadline|Retry|Retries)[\w$]*))\b[^\n\d-]{0,80}(?<value>\d[\d_]*(?:\.\d[\d_]*)?)/gu;
  for (const match of analysisLine.matchAll(namedThresholdAssignmentPattern)) {
    const label = match.groups?.['label'] ?? '';
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label),
    );
  }

  const cliPattern =
    /--(?<label>timeout-minutes|timeout|test-timeout|retries|retry|slow)(?:=|\s+)(?<value>\d[\d_]*(?:\.\d[\d_]*)?)/giu;
  for (const match of analysisLine.matchAll(cliPattern)) {
    const label = match.groups?.['label'] ?? '';
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label),
    );
  }

  const callPattern =
    /\b(?<label>waitForTimeout|setDefaultTimeout|setTimeout|slow)\s*\(\s*(?<value>\d[\d_]*(?:\.\d[\d_]*)?)/giu;
  for (const match of analysisLine.matchAll(callPattern)) {
    const label = match.groups?.['label'] ?? '';
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label),
    );
  }

  const slowAnnotationMatch = /^\s*test\.(?<label>slow)\s*\((?<arguments>.*)\)\s*;?\s*$/u.exec(
    analysisLine,
  );
  if (slowAnnotationMatch !== null) {
    const argumentsText = slowAnnotationMatch.groups?.['arguments']?.trim() ?? '';
    if (!/^\d[\d_]*(?:\.\d[\d_]*)?(?:\s*,|\s*$)/u.test(argumentsText)) {
      pushCandidate(
        candidates,
        line,
        lineNumber,
        slowAnnotationMatch.groups?.['label'] ?? '',
        /^false(?:\s*,|\s*$)/u.test(argumentsText) ? '1' : '3',
        { renderedValue: '1 (implicit normal timeout)', value: 1 },
      );
    }
  }

  if (/(?:^|\/)[^/]+\.(?:spec|test)\.[^/]+$/u.test(filePath)) {
    const bunTestTimeoutMatch = /^\s*\},\s*(?<value>\d[\d_]*(?:\.\d[\d_]*)?)\s*\)\s*;?\s*$/u.exec(
      analysisLine,
    );
    if (bunTestTimeoutMatch !== null) {
      pushCandidate(
        candidates,
        line,
        lineNumber,
        'bun-test-timeout',
        bunTestTimeoutMatch.groups?.['value'],
      );
    }
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

function extractMultilineCallCandidates(
  filePath: string,
  source: Array<{ line: string; lineNumber: number }>,
): ThresholdCandidate[] {
  const analysis = source.map(({ line }) => sourceLineForAnalysis(filePath, line)).join('\n');
  const candidates: ThresholdCandidate[] = [];
  const pattern =
    /\b(?<label>waitForTimeout|setDefaultTimeout|setTimeout|slow)\s*\(\s*\n\s*(?<value>\d[\d_]*(?:\.\d[\d_]*)?)/giu;
  for (const match of analysis.matchAll(pattern)) {
    const label = match.groups?.['label'] ?? '';
    const sourceIndex = analysis.slice(0, match.index).split('\n').length - 1;
    pushCandidate(
      candidates,
      match[0].replaceAll('\n', ' ').replace(/\s+/gu, ' ').trim(),
      source[sourceIndex]?.lineNumber ?? 0,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label),
    );
  }

  const assignmentPatterns = [
    /\b(?<label>timeout-minutes|testTimeout|timeout|deadline|retries|retry|slow)\b[^\n\d-]{0,80}\n\s*(?<value>\d[\d_]*(?:\.\d[\d_]*)?)/giu,
    /\b(?<label>(?:[A-Z][A-Z0-9_]*(?:TIMEOUT|WAIT|DEADLINE|RETRY|RETRIES)[A-Z0-9_]*)|(?:[A-Za-z_$][\w$]*(?:Timeout|Wait|Deadline|Retry|Retries)[\w$]*))\b[^\n\d-]{0,80}\n\s*(?<value>\d[\d_]*(?:\.\d[\d_]*)?)/gu,
  ];
  for (const assignmentPattern of assignmentPatterns) {
    for (const match of analysis.matchAll(assignmentPattern)) {
      const label = match.groups?.['label'] ?? '';
      if (!isTestConfigurationRetry(filePath, analysis, label)) continue;
      const sourceIndex = analysis.slice(0, match.index).split('\n').length - 1;
      pushCandidate(
        candidates,
        match[0].replaceAll('\n', ' ').replace(/\s+/gu, ' ').trim(),
        source[sourceIndex]?.lineNumber ?? 0,
        label,
        match.groups?.['value'],
        implicitBaselineFor(label),
      );
    }
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.identity}:${candidate.renderedValue}:${candidate.lineNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectComparableViolations(hunks: readonly DiffHunk[]): TimeoutIncreaseViolation[] {
  const violations: TimeoutIncreaseViolation[] = [];
  const candidateOrder = new Map<ThresholdCandidate, number>();
  let nextCandidateOrder = 0;
  for (const hunk of hunks) {
    for (const candidate of hunk.added) {
      candidateOrder.set(candidate, nextCandidateOrder);
      nextCandidateOrder += 1;
    }
  }
  const identities = new Set([
    ...hunks.flatMap((hunk) => hunk.removed.map((candidate) => candidate.identity)),
    ...hunks.flatMap((hunk) => hunk.added.map((candidate) => candidate.identity)),
  ]);

  for (const identity of identities) {
    const removed = hunks
      .flatMap((hunk) => hunk.removed.map((candidate) => ({ candidate, hunk })))
      .filter(({ candidate }) => candidate.identity === identity)
      .toSorted((left, right) => right.candidate.effectiveValue - left.candidate.effectiveValue);
    const added = hunks
      .flatMap((hunk) => hunk.added.map((candidate) => ({ candidate, hunk })))
      .filter(({ candidate }) => candidate.identity === identity)
      .toSorted((left, right) => right.candidate.effectiveValue - left.candidate.effectiveValue);
    const comparableCount = Math.min(removed.length, added.length);

    for (let index = 0; index < comparableCount; index += 1) {
      const oldEntry = removed[index];
      const newEntry = added[index];
      if (oldEntry === undefined || newEntry === undefined) continue;
      if (newEntry.candidate.effectiveValue > oldEntry.candidate.effectiveValue) {
        violations.push({
          filePath: newEntry.hunk.filePath,
          hunkHeader: newEntry.hunk.hunkHeader,
          old: oldEntry.candidate,
          new: newEntry.candidate,
        });
      }
    }

    for (const { candidate: newCandidate, hunk } of added.slice(removed.length)) {
      if (
        newCandidate.baselineValue === undefined ||
        newCandidate.baselineRenderedValue === undefined ||
        newCandidate.value <= newCandidate.baselineValue
      ) {
        continue;
      }
      violations.push({
        filePath: hunk.filePath,
        hunkHeader: hunk.hunkHeader,
        old: {
          ...newCandidate,
          effectiveValue: newCandidate.baselineValue,
          value: newCandidate.baselineValue,
          renderedValue: newCandidate.baselineRenderedValue,
          line:
            newCandidate.kind === 'retries'
              ? 'test runs with the default retry count (no retries setting)'
              : 'test runs with the normal timeout (no test.slow())',
        },
        new: newCandidate,
      });
    }
  }

  return violations.toSorted(
    (left, right) =>
      (candidateOrder.get(left.new) ?? Number.MAX_SAFE_INTEGER) -
      (candidateOrder.get(right.new) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function findTimeoutIncreaseViolations(diff: string): TimeoutIncreaseViolation[] {
  const hunks: DiffHunk[] = [];
  let currentFilePath = '';
  let currentHunk: DiffHunk | undefined;
  let oldLine = 0;
  let newLine = 0;

  const flushHunk = (): void => {
    if (currentHunk === undefined) return;
    currentHunk.removed.push(
      ...extractMultilineCallCandidates(currentHunk.filePath, currentHunk.oldSource),
    );
    currentHunk.added.push(
      ...extractMultilineCallCandidates(currentHunk.filePath, currentHunk.newSource),
    );
    hunks.push(currentHunk);
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
        ? {
            filePath: currentFilePath,
            hunkHeader: rawLine,
            removed: [],
            added: [],
            oldSource: [],
            newSource: [],
          }
        : undefined;
      continue;
    }

    if (currentHunk === undefined) continue;
    if (rawLine.startsWith('--- ')) continue;

    if (rawLine.startsWith('-')) {
      const content = rawLine.slice(1);
      currentHunk.oldSource.push({ line: content, lineNumber: oldLine });
      currentHunk.removed.push(
        ...extractThresholdCandidates(currentHunk.filePath, content, oldLine),
      );
      oldLine += 1;
      continue;
    }

    if (rawLine.startsWith('+')) {
      const content = rawLine.slice(1);
      currentHunk.newSource.push({ line: content, lineNumber: newLine });
      currentHunk.added.push(...extractThresholdCandidates(currentHunk.filePath, content, newLine));
      newLine += 1;
      continue;
    }

    if (rawLine.startsWith(' ')) {
      const content = rawLine.slice(1);
      currentHunk.oldSource.push({ line: content, lineNumber: oldLine });
      currentHunk.newSource.push({ line: content, lineNumber: newLine });
      oldLine += 1;
      newLine += 1;
    }
  }

  flushHunk();
  return collectComparableViolations(hunks);
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

  const result = Bun.spawnSync(['git', 'diff', '--unified=3', `origin/${baseRef}...HEAD`], {
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
