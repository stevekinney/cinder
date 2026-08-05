import type { SourceDiffFile, SourceDiffLine } from './source-diff-viewer.types.ts';

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
