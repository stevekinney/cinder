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
const TEXT_ENCODER = new TextEncoder();

function stripSyntheticDiffPrefix(path: string): string {
  return path.replace(/^[ab]\//, '');
}

function stripLeadingPathSegmentPrefix(path: string): string {
  return path.replace(/^[^/]+\//, '');
}

function sharedPathSegmentSuffixSegments(firstPath: string, secondPath: string): string[] {
  const firstSegments = firstPath.split('/');
  const secondSegments = secondPath.split('/');
  const sharedSegments: string[] = [];

  while (firstSegments.length > 0 && secondSegments.length > 0) {
    const firstSegment = firstSegments.pop();
    const secondSegment = secondSegments.pop();
    if (firstSegment !== secondSegment || firstSegment === undefined) break;
    sharedSegments.unshift(firstSegment);
  }

  return sharedSegments;
}

function sharedPathSegmentSuffix(firstPath: string, secondPath: string): string | null {
  const sharedSegments = sharedPathSegmentSuffixSegments(firstPath, secondPath);
  return sharedSegments.length > 0 ? sharedSegments.join('/') : null;
}

function decodeGitQuotedPath(path: string): string {
  if (!path.startsWith('"') || !path.endsWith('"')) return path;

  const bytes: number[] = [];
  const quoted = path.slice(1, -1);
  for (let index = 0; index < quoted.length; index += 1) {
    const character = quoted[index];
    if (character !== '\\') {
      const codePoint = quoted.codePointAt(index);
      if (codePoint !== undefined) {
        bytes.push(...TEXT_ENCODER.encode(String.fromCodePoint(codePoint)));
        if (codePoint > 0xffff) index += 1;
      }
      continue;
    }

    const next = quoted[index + 1];
    if (next && /[0-7]/.test(next)) {
      const octal = quoted.slice(index + 1).match(/^[0-7]{1,3}/)?.[0] ?? '';
      bytes.push(Number.parseInt(octal, 8));
      index += octal.length;
      continue;
    }

    const escapes: Record<string, number> = {
      '"': 0x22,
      '\\': 0x5c,
      a: 0x07,
      b: 0x08,
      f: 0x0c,
      n: 0x0a,
      r: 0x0d,
      t: 0x09,
      v: 0x0b,
    };
    bytes.push(next ? (escapes[next] ?? next.charCodeAt(0)) : 0x5c);
    if (next) index += 1;
  }

  return new TextDecoder().decode(new Uint8Array(bytes));
}

function parsePatchPath(path: string, options: { stripSyntheticPrefix: boolean }): string | null {
  const [pathWithoutTimestamp = path] = path.split('\t');
  const trimmedPath = decodeGitQuotedPath(pathWithoutTimestamp);
  const normalized = options.stripSyntheticPrefix
    ? stripSyntheticDiffPrefix(trimmedPath)
    : trimmedPath;
  return normalized === '/dev/null' ? null : normalized;
}

function normalizeGitHeaderPaths(
  oldPath: string | null,
  newPath: string | null,
): Pick<SourceDiffFile, 'oldPath' | 'newPath'> {
  if (!oldPath || !newPath) return { oldPath, newPath };
  if (oldPath === newPath) return { oldPath, newPath };

  const oldSegments = oldPath.split('/');
  const newSegments = newPath.split('/');
  const sharedSegments = sharedPathSegmentSuffixSegments(oldPath, newPath);
  const [oldPrefix] = oldSegments;
  const [newPrefix] = newSegments;
  if (oldPrefix === 'a' && newPrefix === 'b') {
    return {
      oldPath: stripSyntheticDiffPrefix(oldPath),
      newPath: stripSyntheticDiffPrefix(newPath),
    };
  }

  if (
    sharedSegments.length >= 2 &&
    oldPrefix === 'old' &&
    newPrefix === 'new' &&
    oldSegments.length === sharedSegments.length + 1 &&
    newSegments.length === sharedSegments.length + 1
  ) {
    const sharedSuffix = sharedPathSegmentSuffix(oldPath, newPath);
    return { oldPath: sharedSuffix, newPath: sharedSuffix };
  }

  return { oldPath, newPath };
}

function readQuotedGitToken(
  payload: string,
  startIndex: number,
): { token: string; endIndex: number } | null {
  if (payload[startIndex] !== '"') return null;

  for (let index = startIndex + 1; index < payload.length; index += 1) {
    if (payload[index] === '\\') {
      index += 1;
      continue;
    }

    if (payload[index] === '"') {
      return {
        token: payload.slice(startIndex, index + 1),
        endIndex: index + 1,
      };
    }
  }

  return null;
}

function parseQuotedDiffGitHeader(
  payload: string,
): Pick<SourceDiffFile, 'oldPath' | 'newPath'> | null {
  const oldToken = readQuotedGitToken(payload, 0);
  if (!oldToken) return null;

  const separator = payload.slice(oldToken.endIndex).match(/^ +/);
  if (!separator) return null;

  const newToken = readQuotedGitToken(payload, oldToken.endIndex + separator[0].length);
  if (!newToken || newToken.endIndex !== payload.length) return null;

  return normalizeGitHeaderPaths(
    parsePatchPath(oldToken.token, { stripSyntheticPrefix: false }),
    parsePatchPath(newToken.token, { stripSyntheticPrefix: false }),
  );
}

function parseDiffGitHeader(line: string): Pick<SourceDiffFile, 'oldPath' | 'newPath' | 'header'> {
  const payload = line.slice('diff --git '.length);
  const quotedHeader = parseQuotedDiffGitHeader(payload);
  if (quotedHeader) return { ...quotedHeader, header: line };

  const separatorIndexes = [...payload.matchAll(/ /g)].map((match) => match.index ?? -1);
  for (const separatorIndex of separatorIndexes) {
    if (separatorIndex <= 0) continue;
    const parsedPaths = normalizeGitHeaderPaths(
      parsePatchPath(payload.slice(0, separatorIndex), { stripSyntheticPrefix: false }),
      parsePatchPath(payload.slice(separatorIndex + 1), { stripSyntheticPrefix: false }),
    );
    if (parsedPaths.oldPath && parsedPaths.oldPath === parsedPaths.newPath) {
      return { ...parsedPaths, header: line };
    }
  }

  const separatorIndex = separatorIndexes[separatorIndexes.length - 1] ?? -1;
  if (separatorIndex <= 0) return { oldPath: null, newPath: null, header: line };

  return {
    ...normalizeGitHeaderPaths(
      parsePatchPath(payload.slice(0, separatorIndex), { stripSyntheticPrefix: false }),
      parsePatchPath(payload.slice(separatorIndex + 1), { stripSyntheticPrefix: false }),
    ),
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

function applyFileMetadata(file: SourceDiffFile, rawLine: string): void {
  const binaryMatch =
    rawLine.match(/^Binary files (a\/.+) and (b\/.+) differ$/) ??
    rawLine.match(/^Binary files (.+) and (.+) differ$/);
  if (binaryMatch) {
    file.oldPath = parsePatchPath(binaryMatch[1] ?? '', { stripSyntheticPrefix: true });
    file.newPath = parsePatchPath(binaryMatch[2] ?? '', { stripSyntheticPrefix: true });
    return;
  }

  if (rawLine.startsWith('rename from ')) {
    file.oldPath = parsePatchPath(rawLine.slice('rename from '.length), {
      stripSyntheticPrefix: false,
    });
    return;
  }

  if (rawLine.startsWith('rename to ')) {
    file.newPath = parsePatchPath(rawLine.slice('rename to '.length), {
      stripSyntheticPrefix: false,
    });
    return;
  }

  if (rawLine.startsWith('copy from ')) {
    file.oldPath = parsePatchPath(rawLine.slice('copy from '.length), {
      stripSyntheticPrefix: false,
    });
    return;
  }

  if (rawLine.startsWith('copy to ')) {
    file.newPath = parsePatchPath(rawLine.slice('copy to '.length), {
      stripSyntheticPrefix: false,
    });
  }
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
  const lines = patch.split('\n').map((line) => {
    if (!line.endsWith('\r')) return line;
    if (line.startsWith(' ') || (line.startsWith('+') && !line.startsWith('+++ '))) return line;
    if (line.startsWith('-') && !line.startsWith('--- ')) return line;
    return line.slice(0, -1);
  });
  while (lines[lines.length - 1] === '') lines.pop();
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

function createParsedGitFile(rawLine: string): SourceDiffFile {
  return {
    ...parseDiffGitHeader(rawLine),
    metadata: [],
    hunks: [],
  };
}

function parseGitFileSidePath(
  file: SourceDiffFile,
  rawPath: string,
  currentPath: string | null,
): string | null {
  const parsedPath = parsePatchPath(rawPath, { stripSyntheticPrefix: false });
  if (!parsedPath || !file.header?.startsWith('diff --git ')) return parsedPath;
  if (currentPath && parsedPath === currentPath) return currentPath;
  const [prefix] = parsedPath.split('/');
  const hasKnownDiffPrefix =
    prefix === 'a' || prefix === 'b' || prefix === 'old' || prefix === 'new';
  if (prefix === 'a' || prefix === 'b') return stripSyntheticDiffPrefix(parsedPath);
  if (currentPath && hasKnownDiffPrefix && parsedPath.endsWith(`/${currentPath}`)) {
    return currentPath;
  }

  const pathWithoutPrefix = stripLeadingPathSegmentPrefix(parsedPath);
  return currentPath && hasKnownDiffPrefix && pathWithoutPrefix === currentPath
    ? currentPath
    : parsedPath;
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
    rawLine.startsWith('Binary files ') ||
    (rawLine.startsWith('File ') && rawLine.includes(' is a ') && rawLine.includes(' while file '))
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
  const lines = preparePatchLines(patch);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    const nextRawLine = lines[index + 1];
    const nextNextRawLine = lines[index + 2];
    if (rawLine === '' && files.length === 0) continue;

    if (rawLine.startsWith('diff --git ')) {
      files.push(createParsedGitFile(rawLine));
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (rawLine.startsWith('diff ')) {
      startFile(files, rawLine);
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    const previousFileIsGitDiff = files[files.length - 1]?.header?.startsWith('diff --git ');
    const previousHunkIsComplete =
      currentHunk && currentCursor && hunkIsComplete(currentHunk, currentCursor);
    if (
      isStandaloneRecursiveDiffMetadata(rawLine) &&
      (!currentHunk || !currentCursor || previousHunkIsComplete) &&
      (previousHunkIsComplete || !previousFileIsGitDiff)
    ) {
      totalLineCount += 1;
      if (renderedLineCount < maxLines) {
        startFile(files, rawLine);
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
      rawLine.startsWith('--- ') &&
      nextRawLine?.startsWith('+++ ') &&
      nextNextRawLine?.startsWith('@@ ')
    ) {
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
    }

    if (
      currentHunk &&
      currentCursor &&
      (rawLine.startsWith('--- ') || rawLine.startsWith('+++ '))
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
      file.oldPath = parseGitFileSidePath(file, rawLine.slice(4), file.oldPath);
      currentHunk = null;
      currentCursor = null;
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (rawLine.startsWith('+++ ')) {
      const file = ensureFile(files);
      file.newPath = parseGitFileSidePath(file, rawLine.slice(4), file.newPath);
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

    if (currentHunk && currentCursor && hunkIsComplete(currentHunk, currentCursor)) {
      totalLineCount += 1;
      if (renderedLineCount < maxLines) {
        currentHunk.lines.push(createHunkMetadataLine(rawLine));
        renderedLineCount += 1;
      }
      previousHunkDiffLineWasRendered = false;
      continue;
    }

    if (!currentHunk || !currentCursor) {
      const result = pushMetadata(files, rawLine, renderedLineCount, maxLines);
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
