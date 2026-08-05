import {
  applyFileMetadata,
  isGitBinaryNoticeMetadata,
} from './source-diff-viewer.binary-notice.ts';
import { createParsedGitFile } from './source-diff-viewer.git-header-parser.ts';
import { parseGitFileSidePath } from './source-diff-viewer.path-normalization.ts';
import type {
  SourceDiffFile,
  SourceDiffHunk,
  SourceDiffLine,
  SourceDiffLineKind,
  SourceDiffParseResult,
} from './source-diff-viewer.types.ts';

type HunkCursor = {
  oldLineNumber: number | null;
  newLineNumber: number | null;
};

type HunkLineResult = {
  renderedLineCount: number;
  lineWasRead: boolean;
  lineWasRendered: boolean;
};

const DEFAULT_MAX_LINES = 1000;
const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function createFile(header: string | null = null): SourceDiffFile {
  return {
    oldPath: null,
    newPath: null,
    header,
    metadata: [],
    hunks: [],
  };
}

function startFile(files: SourceDiffFile[], header: string | null = null): SourceDiffFile {
  const file = createFile(header);
  files.push(file);
  return file;
}

function ensureFile(files: SourceDiffFile[], header: string | null = null): SourceDiffFile {
  return files[files.length - 1] ?? startFile(files, header);
}

function ensureFileForOldHeader(files: SourceDiffFile[]): SourceDiffFile {
  const current = files[files.length - 1];
  if (
    current &&
    current.hunks.length === 0 &&
    (current.header?.startsWith('diff --git ') ||
      (current.oldPath === null && current.newPath === null))
  ) {
    return current;
  }

  return startFile(files);
}

function hunkHasRenderedContent(hunk: SourceDiffHunk): boolean {
  return hunk.lines.length > 0;
}

function fileHasRenderedContent(file: SourceDiffFile): boolean {
  return (
    (file.header !== null && isStandaloneRecursiveDiffMetadata(file.header)) ||
    file.metadata.length > 0 ||
    file.hunks.some(hunkHasRenderedContent)
  );
}

function hunkIsComplete(hunk: SourceDiffHunk, cursor: HunkCursor): boolean {
  if (
    hunk.oldStart === null ||
    hunk.oldCount === null ||
    hunk.newStart === null ||
    hunk.newCount === null ||
    cursor.oldLineNumber === null ||
    cursor.newLineNumber === null
  ) {
    return false;
  }

  return (
    cursor.oldLineNumber >= hunk.oldStart + hunk.oldCount &&
    cursor.newLineNumber >= hunk.newStart + hunk.newCount
  );
}

function hunkCanReadAfterZeroCountComplete(hunk: SourceDiffHunk, rawLine: string): boolean {
  return (
    hunk.oldCount === 0 &&
    hunk.newCount === 0 &&
    readRawHunkLine(rawLine, {
      oldLineNumber: null,
      newLineNumber: null,
    }) !== null
  );
}

function readRawHunkLine(rawLine: string, cursor: HunkCursor): SourceDiffLine | null {
  if (rawLine.startsWith('\\ ')) {
    return {
      kind: 'metadata',
      content: rawLine.slice(2),
      oldLineNumber: null,
      newLineNumber: null,
      metadataPrefix: '\\',
    };
  }

  const prefix = rawLine[0];
  const content = rawLine.slice(1);
  const kind =
    prefix === '+' ? 'addition' : prefix === '-' ? 'removal' : prefix === ' ' ? 'context' : null;

  if (!kind) return null;
  return readLine(kind, content, cursor);
}

function createHunkMetadataLine(
  rawLine: string,
  metadataPrefix?: SourceDiffLine['metadataPrefix'],
): SourceDiffLine {
  const line: SourceDiffLine = {
    kind: 'metadata',
    content: rawLine,
    oldLineNumber: null,
    newLineNumber: null,
  };
  if (metadataPrefix) line.metadataPrefix = metadataPrefix;
  return line;
}

function pushMetadata(
  files: SourceDiffFile[],
  rawLine: string,
  renderedLineCount: number,
  maxLines: number,
): { renderedLineCount: number; lineWasRendered: boolean } {
  applyFileMetadata(ensureFile(files), rawLine);

  if (renderedLineCount < maxLines) {
    ensureFile(files).metadata.push(rawLine);
    return { renderedLineCount: renderedLineCount + 1, lineWasRendered: true };
  }

  return { renderedLineCount, lineWasRendered: false };
}

function preparePatchLines(patch: string): string[] {
  const lines = patch.split('\n');
  while (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function stripLineTerminatorCarriageReturn(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}

function pruneFiles(files: SourceDiffFile[]): SourceDiffFile[] {
  return files
    .map((file) => ({
      ...file,
      hunks: file.hunks.filter(hunkHasRenderedContent),
    }))
    .filter(fileHasRenderedContent);
}

function readHunkLine(
  hunk: SourceDiffHunk,
  cursor: HunkCursor,
  rawLine: string,
  renderedLineCount: number,
  maxLines: number,
  previousHunkDiffLineWasRendered: boolean,
): HunkLineResult {
  const line = readRawHunkLine(rawLine, cursor);
  if (!line) {
    const shouldPreserveMetadata = previousHunkDiffLineWasRendered || hunk.lines.length === 0;
    if (shouldPreserveMetadata && renderedLineCount < maxLines) {
      hunk.lines.push(createHunkMetadataLine(rawLine));
      return {
        renderedLineCount: renderedLineCount + 1,
        lineWasRead: true,
        lineWasRendered: true,
      };
    }
    return {
      renderedLineCount,
      lineWasRead: true,
      lineWasRendered: false,
    };
  }

  if (line.kind === 'metadata') {
    const shouldPreserveMetadata = previousHunkDiffLineWasRendered || hunk.lines.length === 0;
    if (shouldPreserveMetadata && renderedLineCount < maxLines) {
      hunk.lines.push(line);
      return {
        renderedLineCount: renderedLineCount + 1,
        lineWasRead: true,
        lineWasRendered: true,
      };
    }
    return {
      renderedLineCount,
      lineWasRead: true,
      lineWasRendered: false,
    };
  }

  if (renderedLineCount < maxLines) {
    hunk.lines.push(line);
    return { renderedLineCount: renderedLineCount + 1, lineWasRead: true, lineWasRendered: true };
  }

  return { renderedLineCount, lineWasRead: true, lineWasRendered: false };
}

function createEmptyParseResult(): SourceDiffParseResult {
  return {
    files: [],
    totalLineCount: 0,
    renderedLineCount: 0,
    truncated: false,
  };
}

function createHunk(header: string): { hunk: SourceDiffHunk; cursor: HunkCursor } {
  const match = HUNK_HEADER_PATTERN.exec(header);
  const oldStart = parseHunkNumber(match?.[1]);
  const oldCount = match?.[2] === undefined ? (oldStart === null ? null : 1) : Number(match[2]);
  const newStart = parseHunkNumber(match?.[3]);
  const newCount = match?.[4] === undefined ? (newStart === null ? null : 1) : Number(match[4]);

  return {
    hunk: {
      header,
      oldStart,
      oldCount,
      newStart,
      newCount,
      lines: [],
    },
    cursor: {
      oldLineNumber: oldStart,
      newLineNumber: newStart,
    },
  };
}

function parseHunkNumber(value: string | undefined): number | null {
  return value === undefined ? null : Number(value);
}

function isStandaloneRecursiveDiffMetadata(rawLine: string): boolean {
  return (
    rawLine.startsWith('Only in ') ||
    rawLine.startsWith('Common subdirectories: ') ||
    rawLine.startsWith('Binary files ') ||
    (rawLine.startsWith('Symbolic links ') && rawLine.endsWith(' differ')) ||
    (rawLine.startsWith('File ') && rawLine.includes(' is a ') && rawLine.includes(' while file '))
  );
}

function isIndexedUnifiedFilePrelude(
  line: string,
  nextLine: string | undefined,
  nextNextLine: string | undefined,
  nextNextNextLine: string | undefined,
  nextNextNextNextLine: string | undefined,
): boolean {
  return (
    line.startsWith('Index: ') &&
    nextLine !== undefined &&
    /^={3,}$/.test(nextLine) &&
    nextNextLine?.startsWith('--- ') === true &&
    nextNextNextLine?.startsWith('+++ ') === true &&
    nextNextNextNextLine?.startsWith('@@ ') === true
  );
}

function readLine(kind: SourceDiffLineKind, content: string, cursor: HunkCursor): SourceDiffLine {
  if (kind === 'addition') {
    const line = {
      kind,
      content,
      oldLineNumber: null,
      newLineNumber: cursor.newLineNumber,
    };
    if (cursor.newLineNumber !== null) cursor.newLineNumber += 1;
    return line;
  }

  if (kind === 'removal') {
    const line = {
      kind,
      content,
      oldLineNumber: cursor.oldLineNumber,
      newLineNumber: null,
    };
    if (cursor.oldLineNumber !== null) cursor.oldLineNumber += 1;
    return line;
  }

  const line = {
    kind,
    content,
    oldLineNumber: cursor.oldLineNumber,
    newLineNumber: cursor.newLineNumber,
  };
  if (cursor.oldLineNumber !== null) cursor.oldLineNumber += 1;
  if (cursor.newLineNumber !== null) cursor.newLineNumber += 1;
  return line;
}

function positiveInteger(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_MAX_LINES;
  return Math.max(0, Math.floor(value));
}

export function parseUnifiedPatch(
  patch: string,
  options: { maxLines?: number } = {},
): SourceDiffParseResult {
  const files: SourceDiffFile[] = [];
  const maxLines = positiveInteger(options.maxLines);
  let currentHunk: SourceDiffHunk | null = null;
  let currentCursor: HunkCursor | null = null;
  let totalLineCount = 0;
  let renderedLineCount = 0;
  let previousHunkDiffLineWasRendered = false;
  const lines = preparePatchLines(patch);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    const line = stripLineTerminatorCarriageReturn(rawLine);
    const nextRawLine = lines[index + 1];
    const nextLine =
      nextRawLine === undefined ? undefined : stripLineTerminatorCarriageReturn(nextRawLine);
    const nextNextRawLine = lines[index + 2];
    const nextNextLine =
      nextNextRawLine === undefined
        ? undefined
        : stripLineTerminatorCarriageReturn(nextNextRawLine);
    const nextNextNextRawLine = lines[index + 3];
    const nextNextNextLine =
      nextNextNextRawLine === undefined
        ? undefined
        : stripLineTerminatorCarriageReturn(nextNextNextRawLine);
    const nextNextNextNextRawLine = lines[index + 4];
    const nextNextNextNextLine =
      nextNextNextNextRawLine === undefined
        ? undefined
        : stripLineTerminatorCarriageReturn(nextNextNextNextRawLine);
    if (line === '' && files.length === 0) continue;

    if (line.startsWith('diff --git ')) {
      files.push(createParsedGitFile(line));
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (line.startsWith('diff ')) {
      startFile(files, line);
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    const previousFileIsGitDiff = files[files.length - 1]?.header?.startsWith('diff --git ');
    const previousFile = files[files.length - 1];
    const previousHunkIsComplete =
      currentHunk && currentCursor && hunkIsComplete(currentHunk, currentCursor);
    const shouldKeepAsGitMetadata =
      previousFileIsGitDiff &&
      previousFile !== undefined &&
      !previousHunkIsComplete &&
      isGitBinaryNoticeMetadata(previousFile, line);
    if (
      isStandaloneRecursiveDiffMetadata(line) &&
      (!currentHunk || !currentCursor || previousHunkIsComplete) &&
      !shouldKeepAsGitMetadata
    ) {
      totalLineCount += 1;
      if (renderedLineCount < maxLines) {
        startFile(files, line);
        renderedLineCount += 1;
      }
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (
      currentHunk &&
      currentCursor &&
      line.startsWith('--- ') &&
      nextLine?.startsWith('+++ ') &&
      nextNextLine?.startsWith('@@ ')
    ) {
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
    }

    if (currentHunk && currentCursor && (line.startsWith('--- ') || line.startsWith('+++ '))) {
      const result = readHunkLine(
        currentHunk,
        currentCursor,
        rawLine,
        renderedLineCount,
        maxLines,
        previousHunkDiffLineWasRendered,
      );
      renderedLineCount = result.renderedLineCount;
      if (result.lineWasRead) {
        totalLineCount += 1;
        previousHunkDiffLineWasRendered = result.lineWasRendered;
      }
      continue;
    }

    if (
      currentHunk &&
      currentCursor &&
      (line.startsWith('\\ ') || !hunkIsComplete(currentHunk, currentCursor))
    ) {
      const result = readHunkLine(
        currentHunk,
        currentCursor,
        rawLine,
        renderedLineCount,
        maxLines,
        previousHunkDiffLineWasRendered,
      );
      renderedLineCount = result.renderedLineCount;
      if (result.lineWasRead) {
        totalLineCount += 1;
        previousHunkDiffLineWasRendered = result.lineWasRendered;
      }
      continue;
    }

    if (
      isIndexedUnifiedFilePrelude(
        line,
        nextLine,
        nextNextLine,
        nextNextNextLine,
        nextNextNextNextLine,
      )
    ) {
      startFile(files, line);
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (line.startsWith('--- ')) {
      const file = ensureFileForOldHeader(files);
      file.oldPath = parseGitFileSidePath(file, line.slice(4), file.oldPath);
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (line.startsWith('+++ ')) {
      const file = ensureFile(files);
      file.newPath = parseGitFileSidePath(file, line.slice(4), file.newPath);
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (line.startsWith('@@ ')) {
      const file = ensureFile(files);
      const { hunk, cursor } = createHunk(line);
      file.hunks.push(hunk);
      currentHunk = hunk;
      currentCursor = cursor;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (
      currentHunk &&
      currentCursor &&
      hunkIsComplete(currentHunk, currentCursor) &&
      !hunkCanReadAfterZeroCountComplete(currentHunk, rawLine)
    ) {
      totalLineCount += 1;
      if (renderedLineCount < maxLines) {
        currentHunk.lines.push(createHunkMetadataLine(line));
        renderedLineCount += 1;
      }
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (!currentHunk || !currentCursor) {
      const result = pushMetadata(files, line, renderedLineCount, maxLines);
      renderedLineCount = result.renderedLineCount;
      totalLineCount += 1;
      continue;
    }

    const result = readHunkLine(
      currentHunk,
      currentCursor,
      rawLine,
      renderedLineCount,
      maxLines,
      previousHunkDiffLineWasRendered,
    );
    renderedLineCount = result.renderedLineCount;
    if (result.lineWasRead) {
      totalLineCount += 1;
      previousHunkDiffLineWasRendered = result.lineWasRendered;
    }
  }

  if (files.length === 0 && totalLineCount === 0) return createEmptyParseResult();

  return {
    files: pruneFiles(files),
    totalLineCount,
    renderedLineCount,
    truncated: renderedLineCount < totalLineCount,
  };
}
