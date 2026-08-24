import {
  formatTimeoutIncreaseViolations,
  normalizeThresholdKind,
  readDiffInput,
  thresholdIdentity,
} from './check-timeout-increase-comparison';
import { findTimeoutIncreaseViolationsInDiff } from './check-timeout-increase-diff';
import {
  effectiveThresholdValue,
  findBunTestTimeoutArguments,
  findWaitThresholdArguments,
  NUMERIC_EXPRESSION_PATTERN,
  parseNumericLiteral,
} from './check-timeout-increase-numeric';
import {
  extractExecutableCliThresholdArguments,
  extractMultilineExecutableCliThresholdArguments,
  isTestOrValidationInfrastructure,
  isTestThresholdAssignment,
  sourceLineForAnalysis,
  sourceLinesForAnalysis,
} from './check-timeout-increase-strings';
import type { ThresholdCandidate, TimeoutIncreaseViolation } from './check-timeout-increase-types';

export type { TimeoutIncreaseViolation } from './check-timeout-increase-types';
export { formatTimeoutIncreaseViolations };

const BASIC_THRESHOLD_LABEL_PATTERN = String.raw`(?:timeout-minutes|testTimeout|timeout|deadline|retries|retry|slow)`;
const NAMED_THRESHOLD_LABEL_PATTERN = String.raw`(?:(?:(?:TIMEOUT|WAIT|DEADLINE|RETRY|RETRIES|POLL|INTERVAL|DELAY)[A-Z0-9_]*|[A-Z][A-Z0-9_]*(?:TIMEOUT|WAIT|DEADLINE|RETRY|RETRIES|POLL|INTERVAL|DELAY)[A-Z0-9_]*)|(?:[a-z][a-z0-9_]*(?:_timeout|_wait|_deadline|_retry|_retries|_poll|_interval|_delay)[a-z0-9_]*)|(?:[A-Za-z_$][\w$]*(?:Timeout|Wait|Deadline|Retry|Retries|Poll|Interval|Delay)[\w$]*)|(?:(?:timeout|wait|deadline|poll|interval|delay)[A-Z_$][\w$]*))`;

function implicitBaselineFor(
  label: string,
  line = '',
  filePath = '',
  inPlaywrightExpectConfiguration = false,
): { renderedValue: string; value: number } | undefined {
  const kind = normalizeThresholdKind(label);
  if (
    label.toLowerCase() === 'timeout-minutes' &&
    /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(filePath)
  ) {
    return { renderedValue: '360 (implicit GitHub Actions job timeout)', value: 360 };
  }
  if (kind === 'retries') return { renderedValue: '0 (implicit default retries)', value: 0 };
  if (kind === 'slow') return { renderedValue: '1 (implicit normal timeout)', value: 1 };
  if (kind === 'timeout' && inPlaywrightExpectConfiguration) {
    return { renderedValue: '5_000 (implicit Playwright expect timeout)', value: 5_000 };
  }
  if (
    kind === 'timeout' &&
    (/(?:^|\/)playwright\.config\.[^/]+$/u.test(filePath) ||
      /\btest\.describe\.configure\s*\(/u.test(line))
  ) {
    return { renderedValue: '30_000 (implicit Playwright test timeout)', value: 30_000 };
  }
  if (kind === 'timeout' && /\bbun\s+test(?:\s|$)/u.test(line)) {
    return { renderedValue: '5_000 (implicit Bun test timeout)', value: 5_000 };
  }
  if (label.toLowerCase() === 'settimeout' && /\btest\.setTimeout\s*\(/u.test(line)) {
    return { renderedValue: '30_000 (implicit Playwright test timeout)', value: 30_000 };
  }
  if (
    ['setdefaulttimeout', 'setdefaultnavigationtimeout'].includes(label.toLowerCase()) &&
    /\.\s*setDefault(?:Navigation)?Timeout\s*\(/u.test(line)
  ) {
    return { renderedValue: '30_000 (implicit Playwright action timeout)', value: 30_000 };
  }
  if (
    label.toLowerCase() === 'setdefaulttimeout' &&
    /(?<![\w$.])setDefaultTimeout\s*\(/u.test(line)
  ) {
    return { renderedValue: '5_000 (implicit Bun test timeout)', value: 5_000 };
  }
  return undefined;
}

function isInsidePlaywrightExpectConfiguration(
  filePath: string,
  analysisBeforeLine: string,
  analysisLine: string,
  candidateOffset: number,
): boolean {
  if (!/(?:^|\/)playwright\.config\.[^/]+$/u.test(filePath)) return false;
  const prefix = `${analysisBeforeLine}\n${analysisLine.slice(0, candidateOffset)}`;
  const expectBlocks = [...prefix.matchAll(/\bexpect\s*:\s*\{/gu)];
  const lastExpectBlock = expectBlocks.at(-1);
  if (lastExpectBlock?.index === undefined) return false;
  let braceDepth = 0;
  for (const character of prefix.slice(lastExpectBlock.index)) {
    if (character === '{') braceDepth += 1;
    else if (character === '}') braceDepth -= 1;
  }
  return braceDepth > 0;
}

function implicitBaselineForMatch(
  label: string,
  line: string,
  filePath: string,
  analysisBeforeLine: string,
  analysisLine: string,
  candidateOffset: number,
): { renderedValue: string; value: number } | undefined {
  return implicitBaselineFor(
    label,
    line,
    filePath,
    isInsidePlaywrightExpectConfiguration(
      filePath,
      analysisBeforeLine,
      analysisLine,
      candidateOffset,
    ),
  );
}

function pushCandidate(
  candidates: ThresholdCandidate[],
  line: string,
  lineNumber: number,
  label: string,
  renderedValue: string | undefined,
  baseline?: { renderedValue: string; value: number },
  occurrenceIndex?: number,
): void {
  if (renderedValue === undefined) return;
  const parsedValue = parseNumericLiteral(renderedValue);
  if (Number.isNaN(parsedValue)) return;
  const value = Number.isFinite(parsedValue) ? parsedValue : Number.POSITIVE_INFINITY;
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
    kind: normalizeThresholdKind(label),
    identity: thresholdIdentity(label),
    label,
    effectiveValue,
    value,
    renderedValue,
    ...(occurrenceIndex === undefined ? {} : { occurrenceIndex }),
    lineNumber,
    line: line.trim(),
  });
}

function extractThresholdCandidates(
  filePath: string,
  line: string,
  lineNumber: number,
  analysisLine = sourceLineForAnalysis(filePath, line),
  analysisBeforeLine = '',
): ThresholdCandidate[] {
  if (analysisLine.trim().length === 0) return [];

  const candidates: ThresholdCandidate[] = [];
  const conditionalThresholdAssignmentPattern = new RegExp(
    String.raw`\b(?<label>${BASIC_THRESHOLD_LABEL_PATTERN}|${NAMED_THRESHOLD_LABEL_PATTERN})\b\s*(?::\s*[^=;\n]+?=\s*|(?::|=)\s*)[^?;\n]+?\?\s*(?<consequent>${NUMERIC_EXPRESSION_PATTERN})\s*:\s*(?<alternate>${NUMERIC_EXPRESSION_PATTERN})`,
    'gu',
  );
  for (const match of analysisLine.matchAll(conditionalThresholdAssignmentPattern)) {
    const label = match.groups?.['label'] ?? '';
    if (!isTestThresholdAssignment(filePath, analysisLine, label)) continue;
    for (const [occurrenceIndex, groupName] of ['consequent', 'alternate'].entries()) {
      pushCandidate(
        candidates,
        line,
        lineNumber,
        label,
        match.groups?.[groupName],
        implicitBaselineForMatch(
          label,
          line,
          filePath,
          analysisBeforeLine,
          analysisLine,
          match.index ?? 0,
        ),
        occurrenceIndex,
      );
    }
  }
  const thresholdAssignmentPattern = new RegExp(
    String.raw`\b(?<label>${BASIC_THRESHOLD_LABEL_PATTERN})\b\s*(?::|=)\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'giu',
  );
  for (const match of analysisLine.matchAll(thresholdAssignmentPattern)) {
    const label = match.groups?.['label'] ?? '';
    if (!isTestThresholdAssignment(filePath, analysisLine, label)) continue;
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineForMatch(
        label,
        line,
        filePath,
        analysisBeforeLine,
        analysisLine,
        match.index ?? 0,
      ),
    );
  }

  const namedThresholdAssignmentPattern = new RegExp(
    String.raw`\b(?<label>${NAMED_THRESHOLD_LABEL_PATTERN})\b\s*(?::\s*[^=;\n]+?=\s*|(?::|=)\s*)(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'gu',
  );
  for (const match of analysisLine.matchAll(namedThresholdAssignmentPattern)) {
    const label = match.groups?.['label'] ?? '';
    if (!isTestThresholdAssignment(filePath, analysisLine, label)) continue;
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineForMatch(
        label,
        line,
        filePath,
        analysisBeforeLine,
        analysisLine,
        match.index ?? 0,
      ),
    );
  }

  const cliPattern = new RegExp(
    String.raw`--(?<label>timeout-minutes|timeout|test-timeout|retries|retry|rerun-each|slow)(?:=|\s+)(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
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
      implicitBaselineFor(label, line, filePath),
    );
  }

  for (const argument of extractExecutableCliThresholdArguments(line)) {
    pushCandidate(
      candidates,
      line,
      lineNumber,
      argument.label,
      argument.renderedValue,
      argument.bunTestCommand
        ? { renderedValue: '5_000 (implicit Bun test timeout)', value: 5_000 }
        : implicitBaselineFor(argument.label, line, filePath),
    );
  }

  const callPattern = new RegExp(
    String.raw`\b(?<label>AbortSignal\.timeout|waitForTimeout|setDefaultNavigationTimeout|setDefaultTimeout|setTimeout|(?:test|testInfo)\.slow)\s*\(\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'giu',
  );
  let callOccurrenceIndex = 0;
  for (const match of analysisLine.matchAll(callPattern)) {
    const label = match.groups?.['label'] ?? '';
    if (!isTestThresholdAssignment(filePath, analysisLine, label)) continue;
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label, line, filePath),
      callOccurrenceIndex,
    );
    callOccurrenceIndex += 1;
  }

  const slowAnnotationPattern = /\b(?:test|testInfo)\.(?<label>slow)\s*\((?<arguments>[^)]*)\)/gu;
  let slowOccurrenceIndex = 0;
  for (const slowAnnotationMatch of analysisLine.matchAll(slowAnnotationPattern)) {
    const argumentsText = slowAnnotationMatch.groups?.['arguments']?.trim() ?? '';
    if (
      new RegExp(String.raw`^${NUMERIC_EXPRESSION_PATTERN}(?:\s*,|\s*$)`, 'u').test(argumentsText)
    ) {
      continue;
    }
    pushCandidate(
      candidates,
      line,
      lineNumber,
      slowAnnotationMatch.groups?.['label'] ?? '',
      /^false(?:\s*,|\s*$)/u.test(argumentsText) ? '1' : '3',
      { renderedValue: '1 (implicit normal timeout)', value: 1 },
      slowOccurrenceIndex,
    );
    slowOccurrenceIndex += 1;
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.identity}:${candidate.renderedValue}:${candidate.lineNumber}:${candidate.occurrenceIndex ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractMultilineCallCandidates(
  filePath: string,
  source: Array<{ changed: boolean; line: string; lineNumber: number }>,
): ThresholdCandidate[] {
  const analysis = sourceLinesForAnalysis(
    filePath,
    source.map(({ line }) => line),
  ).join('\n');
  const candidates: ThresholdCandidate[] = [];
  const pattern = new RegExp(
    String.raw`\b(?<label>AbortSignal\.timeout|waitForTimeout|setDefaultNavigationTimeout|setDefaultTimeout|setTimeout|(?:test|testInfo)\.slow)\s*\(\s*\n\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'giu',
  );
  for (const match of analysis.matchAll(pattern)) {
    const label = match.groups?.['label'] ?? '';
    if (!isTestThresholdAssignment(filePath, analysis, label)) continue;
    const sourceIndex = analysis.slice(0, match.index).split('\n').length - 1;
    pushCandidate(
      candidates,
      match[0].replaceAll('\n', ' ').replace(/\s+/gu, ' ').trim(),
      source[sourceIndex]?.lineNumber ?? 0,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label, match[0], filePath),
    );
  }

  const assignmentPatterns = [
    new RegExp(
      String.raw`\b(?<label>timeout-minutes|testTimeout|timeout|deadline|retries|retry|slow)\b\s*(?::\s*[^=;\n]+?=\s*|(?::|=)\s*)\n\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
      'giu',
    ),
    new RegExp(
      String.raw`\b(?<label>${NAMED_THRESHOLD_LABEL_PATTERN})\b\s*(?::\s*[^=;\n]+?=\s*|(?::|=)\s*)\n\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
      'gu',
    ),
  ];
  for (const assignmentPattern of assignmentPatterns) {
    for (const match of analysis.matchAll(assignmentPattern)) {
      const label = match.groups?.['label'] ?? '';
      if (!isTestThresholdAssignment(filePath, analysis, label)) continue;
      const sourceIndex = analysis.slice(0, match.index).split('\n').length - 1;
      pushCandidate(
        candidates,
        match[0].replaceAll('\n', ' ').replace(/\s+/gu, ' ').trim(),
        source[sourceIndex]?.lineNumber ?? 0,
        label,
        match.groups?.['value'],
        implicitBaselineFor(label, match[0], filePath),
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
    if (isTestOrValidationInfrastructure(filePath)) continue;
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
        implicitBaselineFor(label, retryMatch[0], filePath),
      );
    }
  }
  const retryLoopBoundPattern = new RegExp(
    String.raw`\b(?:for\s*\([^;]*;\s*|while\s*\(\s*)(?<label>[A-Za-z_$][\w$]*)\s*<(?<inclusive>=?)\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'giu',
  );
  for (const loopMatch of analysis.matchAll(retryLoopBoundPattern)) {
    const label = loopMatch.groups?.['label'] ?? '';
    if (!/(?:attempt|retry|retries)/iu.test(label)) continue;
    const renderedValue = loopMatch.groups?.['value'];
    if (renderedValue === undefined) continue;
    const sourceIndex = analysis.slice(0, loopMatch.index).split('\n').length - 1;
    pushCandidate(
      candidates,
      source[sourceIndex]?.line ?? loopMatch[0],
      source[sourceIndex]?.lineNumber ?? 0,
      label,
      loopMatch.groups?.['inclusive'] === '=' ? `${renderedValue} + 1` : renderedValue,
      implicitBaselineFor(label, loopMatch[0], filePath),
    );
  }
  if (isTestOrValidationInfrastructure(filePath, analysis)) {
    for (const waitArgument of findWaitThresholdArguments(analysis)) {
      const sourceIndex = analysis.slice(0, waitArgument.offset).split('\n').length - 1;
      pushCandidate(
        candidates,
        source[sourceIndex]?.line ?? waitArgument.renderedValue,
        source[sourceIndex]?.lineNumber ?? 0,
        waitArgument.label,
        waitArgument.renderedValue,
      );
    }
  }
  if (/(?:^|\/)[^/]+(?:\.(?:spec|test)\.|_(?:spec|test)_)[^/]+$/u.test(filePath)) {
    for (const timeoutArgument of findBunTestTimeoutArguments(analysis)) {
      const sourceIndex = analysis.slice(0, timeoutArgument.offset).split('\n').length - 1;
      pushCandidate(
        candidates,
        source[sourceIndex]?.line ?? timeoutArgument.renderedValue,
        source[sourceIndex]?.lineNumber ?? 0,
        'bun-test-timeout',
        timeoutArgument.renderedValue,
        { renderedValue: '5_000 (implicit Bun test timeout)', value: 5_000 },
      );
    }
  }

  for (const argument of extractMultilineExecutableCliThresholdArguments(
    source.map(({ line }) => line),
  )) {
    pushCandidate(
      candidates,
      source[argument.lineIndex]?.line ?? argument.renderedValue,
      source[argument.lineIndex]?.lineNumber ?? 0,
      argument.label,
      argument.renderedValue,
      argument.bunTestCommand
        ? { renderedValue: '5_000 (implicit Bun test timeout)', value: 5_000 }
        : implicitBaselineFor(argument.label, '', filePath),
    );
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
  return findTimeoutIncreaseViolationsInDiff(
    diff,
    extractThresholdCandidates,
    extractMultilineCallCandidates,
  );
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
