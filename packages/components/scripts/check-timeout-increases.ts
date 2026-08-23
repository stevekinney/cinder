import { extname } from 'node:path';

import {
  collectComparableViolations,
  formatTimeoutIncreaseViolations,
  isSupportedFile,
  parseHunkStart,
  readDiffInput,
} from './check-timeout-increase-comparison';
import {
  findBunTestTimeoutArguments,
  NUMERIC_EXPRESSION_PATTERN,
  parseNumericLiteral,
} from './check-timeout-increase-numeric';
import { extractTopLevelQuotedStrings, stripQuotedText } from './check-timeout-increase-strings';
import type {
  DiffHunk,
  ThresholdCandidate,
  ThresholdKind,
  TimeoutIncreaseViolation,
} from './check-timeout-increase-types';

export type { TimeoutIncreaseViolation } from './check-timeout-increase-types';
export { formatTimeoutIncreaseViolations };

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
  if (extension === '.svelte' && /^\s*</u.test(line)) return '';
  if (['.cjs', '.js', '.jsx', '.mjs', '.svelte', '.ts', '.tsx'].includes(extension)) {
    return stripQuotedText(exposeQuotedConfigurationKeys(line)).replace(/(?:\/\/|\/\*).*$/u, '');
  }
  if (['.bash', '.sh', '.yaml', '.yml', '.zsh'].includes(extension)) {
    return stripUnquotedHashComment(line);
  }
  return line;
}

function isExecutableCliArgumentLine(line: string, argument: string): boolean {
  for (const quotedArgument of [`'${argument}'`, `"${argument}"`]) {
    const argumentIndex = line.indexOf(quotedArgument);
    if (argumentIndex === -1) continue;
    const prefix = line.slice(0, argumentIndex).trimEnd();
    if (prefix.length === 0 || prefix.endsWith('[') || prefix.endsWith(',')) return true;
  }
  return false;
}

function normalizeKind(label: string): ThresholdKind {
  const normalized = label.toLowerCase();
  if (normalized === 'timeout-minutes') return 'timeout-minutes';
  if (normalized.includes('slow')) return 'slow';
  if (normalized.includes('retr')) return 'retries';
  return 'timeout';
}

const GENERIC_THRESHOLD_LABELS = new Set([
  'bun-test-timeout',
  'deadline',
  'retries',
  'retry',
  'setdefaulttimeout',
  'settimeout',
  'slow',
  'test-timeout',
  'testtimeout',
  'timeout',
  'timeout-minutes',
  'waitfortimeout',
]);

function thresholdIdentity(label: string): string {
  const normalizedLabel = label.toLowerCase();
  return GENERIC_THRESHOLD_LABELS.has(normalizedLabel)
    ? normalizeKind(label)
    : `${normalizeKind(label)}:${normalizedLabel}`;
}

function implicitBaselineFor(
  label: string,
  line = '',
): { renderedValue: string; value: number } | undefined {
  const kind = normalizeKind(label);
  if (kind === 'retries') return { renderedValue: '0 (implicit default retries)', value: 0 };
  if (kind === 'slow') return { renderedValue: '1 (implicit normal timeout)', value: 1 };
  if (label.toLowerCase() === 'settimeout' && /\btest\.setTimeout\s*\(/u.test(line)) {
    return { renderedValue: '30_000 (implicit Playwright test timeout)', value: 30_000 };
  }
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
  const effectiveValue = effectiveThresholdValue(label, line, value);
  const candidateBaseline =
    baseline ??
    (effectiveValue === Number.POSITIVE_INFINITY
      ? { renderedValue: 'bounded implicit framework timeout', value: 0 }
      : undefined);
  candidates.push({
    ...(candidateBaseline === undefined
      ? {}
      : {
          baselineRenderedValue: candidateBaseline.renderedValue,
          baselineValue: candidateBaseline.value,
        }),
    kind: normalizeKind(label),
    identity: thresholdIdentity(label),
    label,
    effectiveValue,
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
  const thresholdAssignmentPattern = new RegExp(
    String.raw`\b(?<label>timeout-minutes|testTimeout|timeout|deadline|retries|retry|slow)\b\s*(?::|=)\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'giu',
  );
  for (const match of analysisLine.matchAll(thresholdAssignmentPattern)) {
    const label = match.groups?.['label'] ?? '';
    if (!isTestConfigurationRetry(filePath, analysisLine, label)) continue;
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label, line),
    );
  }

  const namedThresholdAssignmentPattern = new RegExp(
    String.raw`\b(?<label>(?:[A-Z][A-Z0-9_]*(?:TIMEOUT|WAIT|DEADLINE|RETRY|RETRIES)[A-Z0-9_]*)|(?:[A-Za-z_$][\w$]*(?:Timeout|Wait|Deadline|Retry|Retries)[\w$]*)|(?:(?:timeout|wait|deadline|retry|retries)[A-Z_$][\w$]*))\b\s*(?::|=)\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'gu',
  );
  for (const match of analysisLine.matchAll(namedThresholdAssignmentPattern)) {
    const label = match.groups?.['label'] ?? '';
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label, line),
    );
  }

  const cliPattern = new RegExp(
    String.raw`--(?<label>timeout-minutes|timeout|test-timeout|retries|retry|slow)(?:=|\s+)(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'giu',
  );
  for (const match of analysisLine.matchAll(cliPattern)) {
    const label = match.groups?.['label'] ?? '';
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label, line),
    );
  }

  const quotedCliArgumentPattern = new RegExp(
    String.raw`^--(?<label>timeout-minutes|timeout|test-timeout|retries|retry|slow)=(?<value>${NUMERIC_EXPRESSION_PATTERN})$`,
    'giu',
  );
  for (const argument of extractTopLevelQuotedStrings(line)) {
    if (!isExecutableCliArgumentLine(line, argument)) continue;
    const match = quotedCliArgumentPattern.exec(argument);
    if (match !== null) {
      const label = match.groups?.['label'] ?? '';
      pushCandidate(
        candidates,
        line,
        lineNumber,
        label,
        match.groups?.['value'],
        implicitBaselineFor(label, line),
      );
    }
  }

  const callPattern = new RegExp(
    String.raw`\b(?<label>waitForTimeout|setDefaultTimeout|setTimeout|slow)\s*\(\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'giu',
  );
  for (const match of analysisLine.matchAll(callPattern)) {
    const label = match.groups?.['label'] ?? '';
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label, line),
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

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.identity}:${candidate.renderedValue}:${candidate.lineNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractMultilineCallCandidates(
  filePath: string,
  source: Array<{ line: string; lineNumber: number }>,
): ThresholdCandidate[] {
  const analysis = source.map(({ line }) => sourceLineForAnalysis(filePath, line)).join('\n');
  const candidates: ThresholdCandidate[] = [];
  const pattern = new RegExp(
    String.raw`\b(?<label>waitForTimeout|setDefaultTimeout|setTimeout|slow)\s*\(\s*\n\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'giu',
  );
  for (const match of analysis.matchAll(pattern)) {
    const label = match.groups?.['label'] ?? '';
    const sourceIndex = analysis.slice(0, match.index).split('\n').length - 1;
    pushCandidate(
      candidates,
      match[0].replaceAll('\n', ' ').replace(/\s+/gu, ' ').trim(),
      source[sourceIndex]?.lineNumber ?? 0,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label, match[0]),
    );
  }

  const assignmentPatterns = [
    new RegExp(
      String.raw`\b(?<label>timeout-minutes|testTimeout|timeout|deadline|retries|retry|slow)\b\s*(?::|=)\s*\n\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
      'giu',
    ),
    new RegExp(
      String.raw`\b(?<label>(?:[A-Z][A-Z0-9_]*(?:TIMEOUT|WAIT|DEADLINE|RETRY|RETRIES)[A-Z0-9_]*)|(?:[A-Za-z_$][\w$]*(?:Timeout|Wait|Deadline|Retry|Retries)[\w$]*)|(?:(?:timeout|wait|deadline|retry|retries)[A-Z_$][\w$]*))\b\s*(?::|=)\s*\n\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
      'gu',
    ),
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
        implicitBaselineFor(label, match[0]),
      );
    }
  }

  const retryConfigurationPattern =
    /\btest\.describe\.configure\s*\(\s*\{(?<body>[\s\S]*?)\}\s*\)/gu;
  const retryAssignmentPattern = new RegExp(
    String.raw`\b(?<label>retries|retry)\b\s*:\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'giu',
  );
  for (const configurationMatch of analysis.matchAll(retryConfigurationPattern)) {
    const body = configurationMatch.groups?.['body'] ?? '';
    for (const retryMatch of body.matchAll(retryAssignmentPattern)) {
      const label = retryMatch.groups?.['label'] ?? '';
      const relativeOffset = configurationMatch[0].indexOf(body) + (retryMatch.index ?? 0);
      if (!configurationMatch[0].slice(0, relativeOffset).includes('\n')) continue;
      const absoluteOffset = (configurationMatch.index ?? 0) + relativeOffset;
      const sourceIndex = analysis.slice(0, absoluteOffset).split('\n').length - 1;
      pushCandidate(
        candidates,
        source[sourceIndex]?.line ?? retryMatch[0],
        source[sourceIndex]?.lineNumber ?? 0,
        label,
        retryMatch.groups?.['value'],
        implicitBaselineFor(label, retryMatch[0]),
      );
    }
  }

  if (/(?:^|\/)[^/]+\.(?:spec|test)\.[^/]+$/u.test(filePath)) {
    for (const timeoutArgument of findBunTestTimeoutArguments(analysis)) {
      const sourceIndex = analysis.slice(0, timeoutArgument.offset).split('\n').length - 1;
      pushCandidate(
        candidates,
        source[sourceIndex]?.line ?? timeoutArgument.renderedValue,
        source[sourceIndex]?.lineNumber ?? 0,
        'bun-test-timeout',
        timeoutArgument.renderedValue,
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
