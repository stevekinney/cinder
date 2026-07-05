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

function stripSyntheticDiffPrefix(path: string): string {
  return path.replace(/^[ab]\//, '');
}

function parsePatchPath(path: string, options: { stripSyntheticPrefix: boolean }): string | null {
  const [pathWithoutTimestamp = path] = path.split('\t');
  const trimmedPath = pathWithoutTimestamp.trim();
  const normalized = options.stripSyntheticPrefix
    ? stripSyntheticDiffPrefix(trimmedPath)
    : trimmedPath;
  return normalized === '/dev/null' ? null : normalized;
}

function parseDiffGitHeader(line: string): Pick<SourceDiffFile, 'oldPath' | 'newPath' | 'header'> {
  const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
  if (!match) return { oldPath: null, newPath: null, header: line };

  return {
    oldPath: match[1] ?? null,
    newPath: match[2] ?? null,
    header: line,
  };
}

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
  return files.at(-1) ?? startFile(files, header);
}

function ensureFileForOldHeader(files: SourceDiffFile[]): SourceDiffFile {
  const current = files.at(-1);
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
  return file.metadata.length > 0 || file.hunks.some(hunkHasRenderedContent);
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

function pushMetadata(files: SourceDiffFile[], rawLine: string): void {
  ensureFile(files).metadata.push(rawLine);
}

function preparePatchLines(patch: string): string[] {
  const lines = patch.replace(/\r\n?/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
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
    if (
      previousHunkDiffLineWasRendered ||
      (hunk.lines.length === 0 && renderedLineCount < maxLines)
    ) {
      hunk.lines.push(createHunkMetadataLine(rawLine));
    }
    return { renderedLineCount, lineWasRead: false, lineWasRendered: false };
  }

  if (line.kind === 'metadata') {
    if (previousHunkDiffLineWasRendered) hunk.lines.push(line);
    return { renderedLineCount, lineWasRead: false, lineWasRendered: false };
  }

  if (renderedLineCount < maxLines) {
    hunk.lines.push(line);
    return { renderedLineCount: renderedLineCount + 1, lineWasRead: true, lineWasRendered: true };
  }

  return { renderedLineCount, lineWasRead: true, lineWasRendered: false };
}

function createParsedGitFile(rawLine: string): SourceDiffFile {
  return {
    ...parseDiffGitHeader(rawLine),
    metadata: [],
    hunks: [],
  };
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
  const oldStart = match?.[1] ? Number(match[1]) : null;
  const oldCount = match?.[2] ? Number(match[2]) : oldStart === null ? null : 1;
  const newStart = match?.[3] ? Number(match[3]) : null;
  const newCount = match?.[4] ? Number(match[4]) : newStart === null ? null : 1;

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

export function getSourceDiffFileLabel(file: SourceDiffFile): string {
  if (file.newPath && file.oldPath && file.newPath !== file.oldPath) {
    return `${file.oldPath} -> ${file.newPath}`;
  }

  return file.newPath ?? file.oldPath ?? file.header ?? 'Patch';
}

export function getSourceDiffLineLabel(line: SourceDiffLine): string {
  if (line.kind === 'addition') {
    return `Added line ${line.newLineNumber ?? 'unknown'}: ${line.content}`;
  }

  if (line.kind === 'removal') {
    return `Removed line ${line.oldLineNumber ?? 'unknown'}: ${line.content}`;
  }

  if (line.kind === 'metadata') {
    return `Diff metadata: ${line.content}`;
  }

  if (
    line.oldLineNumber !== null &&
    line.newLineNumber !== null &&
    line.oldLineNumber !== line.newLineNumber
  ) {
    return `Context old line ${line.oldLineNumber}, new line ${line.newLineNumber}: ${line.content}`;
  }

  const lineNumber = line.newLineNumber ?? line.oldLineNumber ?? 'unknown';
  return `Context line ${lineNumber}: ${line.content}`;
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

  for (const rawLine of preparePatchLines(patch)) {
    if (rawLine === '' && files.length === 0) continue;

    if (rawLine.startsWith('diff --git ')) {
      files.push(createParsedGitFile(rawLine));
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (
      currentHunk &&
      currentCursor &&
      (rawLine.startsWith('\\ ') || !hunkIsComplete(currentHunk, currentCursor))
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

    if (rawLine.startsWith('--- ')) {
      const file = ensureFileForOldHeader(files);
      file.oldPath = parsePatchPath(rawLine.slice(4), {
        stripSyntheticPrefix: file.header?.startsWith('diff --git ') ?? false,
      });
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (rawLine.startsWith('+++ ')) {
      const file = ensureFile(files);
      file.newPath = parsePatchPath(rawLine.slice(4), {
        stripSyntheticPrefix: file.header?.startsWith('diff --git ') ?? false,
      });
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (rawLine.startsWith('@@ ')) {
      const file = ensureFile(files);
      const { hunk, cursor } = createHunk(rawLine);
      file.hunks.push(hunk);
      currentHunk = hunk;
      currentCursor = cursor;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (!currentHunk || !currentCursor) {
      pushMetadata(files, rawLine);
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

  if (files.length === 0) return createEmptyParseResult();

  return {
    files: pruneFiles(files),
    totalLineCount,
    renderedLineCount,
    truncated: renderedLineCount < totalLineCount,
  };
}
