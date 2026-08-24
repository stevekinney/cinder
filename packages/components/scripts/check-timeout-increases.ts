import {
  findPlaywrightRelativeTimeoutExtensions,
  implicitBaselineFor,
  implicitBaselineForMatch,
  waitThresholdBaselineFor,
  type ThresholdBaseline,
} from './check-timeout-increase-baselines';
import {
  formatTimeoutIncreaseViolations,
  normalizeThresholdKind,
  readDiffInput,
  thresholdIdentity,
} from './check-timeout-increase-comparison';
import { findTimeoutIncreaseViolationsInDiff } from './check-timeout-increase-diff';
import {
  effectiveThresholdValue,
  findBunLifecycleTimeoutArguments,
  findBunTestTimeoutArguments,
  findPromiseTimerAliasArguments,
  findReferencedPlaywrightTimeoutAssignments,
  findWaitThresholdArguments,
  findWaitThresholdBounds,
  NUMERIC_EXPRESSION_PATTERN,
  parseNumericLiteral,
} from './check-timeout-increase-numeric';
import {
  extractExecutableCliThresholdArguments,
  extractMultilineExecutableCliThresholdArguments,
  extractShellWaitThresholdArguments,
  isExecutableConfigurationCliLine,
  isTestOrValidationInfrastructure,
  isTestThresholdAssignment,
  normalizeWorkflowExpressions,
  shellContinuationContext,
  sourceLineForAnalysis,
  sourceLinesForAnalysis,
} from './check-timeout-increase-strings';
import type { ThresholdCandidate, TimeoutIncreaseViolation } from './check-timeout-increase-types';
export type { TimeoutIncreaseViolation } from './check-timeout-increase-types';
export { formatTimeoutIncreaseViolations };
const BASIC_THRESHOLD_LABEL_PATTERN = String.raw`(?:timeout-minutes|testTimeout|timeout|deadline|retries|retry|repeatEach|slow)`;
const NAMED_THRESHOLD_LABEL_PATTERN = String.raw`(?:(?:(?:TIMEOUT|WAIT|DEADLINE|RETRY|RETRIES|ATTEMPT|ATTEMPTS|PRESS|PRESSES|POLL|INTERVAL|DELAY|DEBOUNCE|GRACE|STABLE_READS?)[A-Z0-9_]*|[A-Z][A-Z0-9_]*(?:TIMEOUT|WAIT|DEADLINE|RETRY|RETRIES|ATTEMPT|ATTEMPTS|PRESS|PRESSES|POLL|INTERVAL|DELAY|DEBOUNCE|GRACE|STABLE_READS?)[A-Z0-9_]*)|(?:[a-z][a-z0-9_]*(?:_timeout|_wait|_deadline|_retry|_retries|_attempt|_attempts|_press|_presses|_poll|_interval|_delay|_debounce|_grace|_stable_reads?)[a-z0-9_]*)|(?:[A-Za-z_$][\w$]*(?:Timeout|Wait|Deadline|Retry|Retries|Attempt|Attempts|Press|Presses|Poll|Interval|Delay|Debounce|Grace|StableReads?)[\w$]*)|(?:(?:timeout|wait|deadline|attempts?|press(?:es)?|poll|interval|delay|debounce|grace|stableReads?)[A-Z_$][\w$]*))`;
function isGenericTimeoutContext(filePath: string, analysis: string): boolean {
  return (
    /(?:^|\/)(?:jest|playwright|vitest)\.config\.[^/]+$/u.test(filePath) ||
    /(?:^|\/)bunfig\.toml$/u.test(filePath) ||
    /\b(?:expect(?:\.(?:configure|poll))?|waitFor[A-Za-z_$\d]*|setDefaultTimeout|test\.describe\.configure|spawn(?:Sync)?)\b/u.test(
      analysis,
    )
  );
}
function pushCandidate(
  candidates: ThresholdCandidate[],
  line: string,
  lineNumber: number,
  label: string,
  renderedValue: string | undefined,
  baseline?: ThresholdBaseline,
  occurrenceIndex?: number,
  effectiveLine = line,
): void {
  if (renderedValue === undefined) return;
  const parsedValue = parseNumericLiteral(renderedValue);
  if (Number.isNaN(parsedValue)) return;
  const value = Number.isFinite(parsedValue) ? parsedValue : Number.POSITIVE_INFINITY;
  const effectiveValue = effectiveThresholdValue(label, effectiveLine, value);
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
  analysisLine = normalizeWorkflowExpressions(filePath, analysisLine);
  const assignmentAnalysis = normalizeWorkflowExpressions(
    filePath,
    `${analysisBeforeLine}\n${analysisLine}`,
  );
  const conditionalThresholdAssignmentPattern = new RegExp(
    String.raw`\b(?<label>${BASIC_THRESHOLD_LABEL_PATTERN}|${NAMED_THRESHOLD_LABEL_PATTERN})\b\s*(?::\s*[^=;\n]+?=\s*|(?::|=)\s*)[^?;\n]+?\?\s*(?:(?<consequent>${NUMERIC_EXPRESSION_PATTERN})|[^:;\n]+?)\s*:\s*(?:(?<alternate>${NUMERIC_EXPRESSION_PATTERN})|[^;\n]+)`,
    'gu',
  );
  for (const match of analysisLine.matchAll(conditionalThresholdAssignmentPattern)) {
    const label = match.groups?.['label'] ?? '';
    if (!isTestThresholdAssignment(filePath, assignmentAnalysis, label)) continue;
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
    if (!isTestThresholdAssignment(filePath, assignmentAnalysis, label)) continue;
    if (
      label.toLowerCase() === 'timeout' &&
      !isGenericTimeoutContext(
        filePath,
        /^\s*timeout\s*:/iu.test(analysisLine) ? assignmentAnalysis : analysisLine,
      )
    ) {
      continue;
    }
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
    String.raw`\b(?<label>${NAMED_THRESHOLD_LABEL_PATTERN})\b\s*(?::\s*[^=;\n]+?=\s*|(?::|=)\s*)(?:(?<value>${NUMERIC_EXPRESSION_PATTERN})|[^;\n]+?(?:\?\?|\|\|)\s*(?<fallback>${NUMERIC_EXPRESSION_PATTERN}))`,
    'gu',
  );
  for (const match of analysisLine.matchAll(namedThresholdAssignmentPattern)) {
    const label = match.groups?.['label'] ?? '';
    if (!isTestThresholdAssignment(filePath, assignmentAnalysis, label)) continue;
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'] ?? match.groups?.['fallback'],
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
    String.raw`(?:(?:--(?<label>timeout-minutes|timeout|test-timeout|testTimeout|retries|retry|repeat-each|rerun-each|slow|interval))|(?<shortLabel>-i))(?:=|\s+)(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'giu',
  );
  for (const match of analysisLine.matchAll(cliPattern)) {
    if (!isExecutableConfigurationCliLine(filePath, line, analysisBeforeLine)) continue;
    const label = match.groups?.['label'] ?? (match.groups?.['shortLabel'] ? 'interval' : '');
    pushCandidate(
      candidates,
      line,
      lineNumber,
      label,
      match.groups?.['value'],
      implicitBaselineFor(label, shellContinuationContext(analysisBeforeLine, line), filePath),
    );
  }
  for (const argument of extractExecutableCliThresholdArguments(line)) {
    pushCandidate(
      candidates,
      line,
      lineNumber,
      argument.label,
      argument.renderedValue,
      argument.bunTestCommand && normalizeThresholdKind(argument.label) === 'timeout'
        ? { renderedValue: '5_000 (implicit Bun test timeout)', value: 5_000 }
        : implicitBaselineFor(argument.label, line, filePath),
    );
  }
  const callPattern = new RegExp(
    String.raw`\b(?<label>AbortSignal\.timeout|waitForTimeout|setDefaultNavigationTimeout|setDefaultTimeout|setTimeout|(?:test|testInfo)\.slow|jest\.(?:retryTimes|setTimeout))\s*\(\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
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
      label.toLowerCase() === 'jest.retrytimes'
        ? { renderedValue: '0 (implicit default retries)', value: 0 }
        : label.toLowerCase() === 'jest.settimeout'
          ? { renderedValue: '5_000 (implicit Jest timeout)', value: 5_000 }
          : label.toLowerCase() === 'waitfortimeout'
            ? { renderedValue: '0 (no explicit wait)', value: 0 }
            : implicitBaselineFor(label, line, filePath),
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
  const analysis = normalizeWorkflowExpressions(
    filePath,
    sourceLinesForAnalysis(
      filePath,
      source.map(({ line }) => line),
    ).join('\n'),
  );
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
      if (label.toLowerCase() === 'timeout' && !isGenericTimeoutContext(filePath, analysis)) {
        continue;
      }
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
  const conditionalPattern = new RegExp(
    String.raw`\b(?<label>${BASIC_THRESHOLD_LABEL_PATTERN}|${NAMED_THRESHOLD_LABEL_PATTERN})\b\s*(?::|=)\s*[^;]*?\?\s*(?:(?<consequent>${NUMERIC_EXPRESSION_PATTERN})|[^:;]+?)\s*:\s*(?:(?<alternate>${NUMERIC_EXPRESSION_PATTERN})|[^;]+)`,
    'giu',
  );
  for (const match of analysis.matchAll(conditionalPattern)) {
    if (!match[0].includes('\n')) continue;
    const label = match.groups?.['label'] ?? '';
    if (!isTestThresholdAssignment(filePath, analysis, label)) continue;
    const sourceIndex = analysis.slice(0, match.index).split('\n').length - 1;
    for (const [occurrenceIndex, group] of ['consequent', 'alternate'].entries()) {
      pushCandidate(
        candidates,
        source[sourceIndex]?.line ?? match[0],
        source[sourceIndex]?.lineNumber ?? 0,
        label,
        match.groups?.[group],
        implicitBaselineFor(label, match[0], filePath),
        occurrenceIndex,
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
    for (const waitArgument of [
      ...findWaitThresholdArguments(analysis),
      ...findWaitThresholdBounds(analysis),
      ...findPromiseTimerAliasArguments(analysis),
      ...findReferencedPlaywrightTimeoutAssignments(analysis),
    ]) {
      const sourceIndex = analysis.slice(0, waitArgument.offset).split('\n').length - 1;
      pushCandidate(
        candidates,
        source[sourceIndex]?.line ?? waitArgument.renderedValue,
        source[sourceIndex]?.lineNumber ?? 0,
        waitArgument.label,
        waitArgument.renderedValue,
        waitThresholdBaselineFor(waitArgument.label, waitArgument.baseline),
        waitArgument.occurrenceIndex,
      );
    }
  }
  if (/\.(?:bash|sh|yaml|yml|zsh)$/u.test(filePath) || /(?:^|\/)\.husky\/[^/]+$/u.test(filePath)) {
    for (const [occurrenceIndex, wait] of extractShellWaitThresholdArguments(analysis).entries()) {
      const sourceIndex = analysis.slice(0, wait.offset).split('\n').length - 1;
      pushCandidate(
        candidates,
        source[sourceIndex]?.line ?? wait.sourceText,
        source[sourceIndex]?.lineNumber ?? 0,
        wait.label,
        wait.renderedValue,
        implicitBaselineFor(wait.label),
        occurrenceIndex,
        wait.sourceText,
      );
    }
  }
  if (/(?:^|\/)[^/]+(?:\.(?:spec|test)\.|_(?:spec|test)_)[^/]+$/u.test(filePath)) {
    for (const timeoutArgument of [
      ...findBunTestTimeoutArguments(analysis),
      ...findBunLifecycleTimeoutArguments(analysis),
    ]) {
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
  for (const extension of findPlaywrightRelativeTimeoutExtensions(analysis)) {
    const sourceIndex = analysis.slice(0, extension.offset).split('\n').length - 1;
    pushCandidate(
      candidates,
      source[sourceIndex]?.line ?? extension.renderedValue,
      source[sourceIndex]?.lineNumber ?? 0,
      'setTimeout-extension',
      extension.renderedValue,
      { renderedValue: '0 (no relative timeout extension)', value: 0 },
    );
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
      argument.bunTestCommand && normalizeThresholdKind(argument.label) === 'timeout'
        ? { renderedValue: '5_000 (implicit Bun test timeout)', value: 5_000 }
        : implicitBaselineFor(argument.label, '', filePath),
    );
  }
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.identity}:${candidate.renderedValue}:${candidate.lineNumber}:${candidate.occurrenceIndex ?? ''}`;
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
