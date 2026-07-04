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

const DEFAULT_MAX_LINES = 1000;
const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function normalizePath(path: string): string {
  return path.replace(/^[ab]\//, '');
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

function ensureFile(files: SourceDiffFile[], header: string | null = null): SourceDiffFile {
  const current = files.at(-1);
  if (current) return current;

  const file: SourceDiffFile = {
    oldPath: null,
    newPath: null,
    header,
    metadata: [],
    hunks: [],
  };
  files.push(file);
  return file;
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
    return `${normalizePath(file.oldPath)} -> ${normalizePath(file.newPath)}`;
  }

  return normalizePath(file.newPath ?? file.oldPath ?? file.header ?? 'Patch');
}

export function getSourceDiffLineLabel(line: SourceDiffLine): string {
  if (line.kind === 'addition') {
    return `Added line ${line.newLineNumber ?? 'unknown'}: ${line.content}`;
  }

  if (line.kind === 'removal') {
    return `Removed line ${line.oldLineNumber ?? 'unknown'}: ${line.content}`;
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

  for (const rawLine of patch.replace(/\r\n?/g, '\n').split('\n')) {
    if (rawLine === '' && files.length === 0) continue;

    if (rawLine.startsWith('diff --git ')) {
      files.push({
        ...parseDiffGitHeader(rawLine),
        metadata: [],
        hunks: [],
      });
      currentHunk = null;
      currentCursor = null;
      continue;
    }

    if (rawLine.startsWith('--- ')) {
      const file = ensureFile(files);
      file.oldPath = normalizePath(rawLine.slice(4).trim());
      currentHunk = null;
      currentCursor = null;
      continue;
    }

    if (rawLine.startsWith('+++ ')) {
      const file = ensureFile(files);
      file.newPath = normalizePath(rawLine.slice(4).trim());
      currentHunk = null;
      currentCursor = null;
      continue;
    }

    if (rawLine.startsWith('@@ ')) {
      const file = ensureFile(files);
      const { hunk, cursor } = createHunk(rawLine);
      file.hunks.push(hunk);
      currentHunk = hunk;
      currentCursor = cursor;
      continue;
    }

    if (!currentHunk || !currentCursor) {
      ensureFile(files).metadata.push(rawLine);
      continue;
    }

    const prefix = rawLine[0];
    const content = rawLine.slice(1);
    const kind =
      prefix === '+' ? 'addition' : prefix === '-' ? 'removal' : prefix === ' ' ? 'context' : null;

    if (!kind) {
      ensureFile(files).metadata.push(rawLine);
      continue;
    }

    totalLineCount += 1;
    if (renderedLineCount < maxLines) {
      currentHunk.lines.push(readLine(kind, content, currentCursor));
      renderedLineCount += 1;
    } else {
      readLine(kind, content, currentCursor);
    }
  }

  return {
    files: files.filter((file) => file.hunks.length > 0 || file.metadata.length > 0),
    totalLineCount,
    renderedLineCount,
    truncated: renderedLineCount < totalLineCount,
  };
}
