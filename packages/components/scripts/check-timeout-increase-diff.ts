import {
  collectComparableViolations,
  isSupportedFile,
  parseHunkStart,
} from './check-timeout-increase-comparison';
import {
  isTestOrValidationInfrastructure,
  sourceLinesForAnalysis,
} from './check-timeout-increase-strings';
import type {
  DiffHunk,
  ThresholdCandidate,
  TimeoutIncreaseViolation,
} from './check-timeout-increase-types';

type SourceLine = DiffHunk['oldSource'][number];
type ExtractLineCandidates = (
  filePath: string,
  line: string,
  lineNumber: number,
  analysisLine?: string,
  analysisBeforeLine?: string,
) => ThresholdCandidate[];
type ExtractMultilineCandidates = (
  filePath: string,
  source: Array<SourceLine>,
) => ThresholdCandidate[];

function boundedAnalysisPrefixes(lines: readonly string[]): string[] {
  const prefixes: string[] = [];
  let prefix = '';
  for (const line of lines) {
    prefixes.push(prefix);
    prefix = `${prefix}\n${line}`.slice(-8_192);
  }
  return prefixes;
}

export function findTimeoutIncreaseViolationsInDiff(
  diff: string,
  extractLineCandidates: ExtractLineCandidates,
  extractMultilineCandidates: ExtractMultilineCandidates,
): TimeoutIncreaseViolation[] {
  const hunks: DiffHunk[] = [];
  let currentFilePath = '';
  let currentFileDeleted = false;
  let oldFilePath = '';
  let currentHunk: DiffHunk | undefined;
  let oldLine = 0;
  let newLine = 0;

  const flushHunk = (): void => {
    if (currentHunk === undefined) return;
    const analysisFilePath = isTestOrValidationInfrastructure(currentHunk.filePath)
      ? currentHunk.filePath
      : isTestOrValidationInfrastructure(currentHunk.oldFilePath)
        ? currentHunk.oldFilePath
        : currentHunk.filePath;
    const oldAnalysisLines = sourceLinesForAnalysis(
      analysisFilePath,
      currentHunk.oldSource.map(({ line }) => line),
    );
    const newAnalysisLines = sourceLinesForAnalysis(
      analysisFilePath,
      currentHunk.newSource.map(({ line }) => line),
    );
    const oldAnalysisPrefixes = boundedAnalysisPrefixes(oldAnalysisLines);
    const newAnalysisPrefixes = boundedAnalysisPrefixes(newAnalysisLines);
    for (const [index, sourceLine] of currentHunk.oldSource.entries()) {
      if (!sourceLine.changed) continue;
      currentHunk.removed.push(
        ...extractLineCandidates(
          analysisFilePath,
          sourceLine.line,
          sourceLine.lineNumber,
          oldAnalysisLines[index],
          oldAnalysisPrefixes[index],
        ),
      );
    }
    for (const [index, sourceLine] of currentHunk.newSource.entries()) {
      if (!sourceLine.changed) continue;
      currentHunk.added.push(
        ...extractLineCandidates(
          analysisFilePath,
          sourceLine.line,
          sourceLine.lineNumber,
          newAnalysisLines[index],
          newAnalysisPrefixes[index],
        ),
      );
    }
    currentHunk.removed.push(
      ...extractMultilineCandidates(analysisFilePath, currentHunk.oldSource),
    );
    currentHunk.added.push(...extractMultilineCandidates(analysisFilePath, currentHunk.newSource));
    hunks.push(currentHunk);
    currentHunk = undefined;
  };

  for (const rawLine of diff.split('\n')) {
    if (rawLine.startsWith('diff --git ')) {
      flushHunk();
      currentFilePath = '';
      currentFileDeleted = false;
      oldFilePath = '';
      continue;
    }

    if (currentHunk === undefined && rawLine.startsWith('--- ')) {
      const path = rawLine.slice(4).trim();
      oldFilePath = path.startsWith('a/') ? path.slice(2) : path;
      if (oldFilePath === '/dev/null') oldFilePath = '';
      continue;
    }

    if (currentHunk === undefined && rawLine.startsWith('+++ ')) {
      const path = rawLine.slice(4).trim();
      currentFilePath = path.startsWith('b/') ? path.slice(2) : path;
      if (currentFilePath === '/dev/null') {
        currentFileDeleted = true;
        currentFilePath = oldFilePath;
      }
      continue;
    }

    if (rawLine.startsWith('@@ ')) {
      flushHunk();
      const starts = parseHunkStart(rawLine);
      oldLine = starts.oldLine;
      newLine = starts.newLine;
      currentHunk =
        isSupportedFile(currentFilePath) || isSupportedFile(oldFilePath)
          ? {
              filePath: currentFilePath,
              fileDeleted: currentFileDeleted,
              oldFilePath: oldFilePath || currentFilePath,
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
    if (rawLine.startsWith('-')) {
      const content = rawLine.slice(1);
      currentHunk.oldSource.push({ changed: true, line: content, lineNumber: oldLine });
      oldLine += 1;
      continue;
    }
    if (rawLine.startsWith('+')) {
      const content = rawLine.slice(1);
      currentHunk.newSource.push({ changed: true, line: content, lineNumber: newLine });
      newLine += 1;
      continue;
    }
    if (rawLine.startsWith(' ')) {
      const content = rawLine.slice(1);
      currentHunk.oldSource.push({ changed: false, line: content, lineNumber: oldLine });
      currentHunk.newSource.push({ changed: false, line: content, lineNumber: newLine });
      oldLine += 1;
      newLine += 1;
    }
  }

  flushHunk();
  return collectComparableViolations(hunks);
}
