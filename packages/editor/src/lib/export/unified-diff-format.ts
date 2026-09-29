import type { DiffHunk as MarkdownDiffHunk } from '@lostgradient/markdown';
import type { DiffHunk } from './unified-diff-hunks.js';
import { splitIntoLines, type SplitContent } from './unified-diff-lines.js';

export interface ComputedUnifiedDiffOptions {
  original: string;
  current: string;
}

/** Join the exact front-matter and body strings rendered by DiffViewer. */
export function composeDisplayedDocument(
  frontMatter: string,
  body: string,
  hasTerminatingNewline: boolean,
): string {
  return frontMatter ? `${frontMatter}${hasTerminatingNewline ? '\n' : ''}${body}` : body;
}

export function formatComputedUnifiedDiff(
  hunks: MarkdownDiffHunk[],
  content?: ComputedUnifiedDiffOptions,
): string {
  if (hunks.length === 0) return '';
  const original = content ? splitIntoLines(content.original, false) : undefined;
  const current = content ? splitIntoLines(content.current, false) : undefined;
  const lines = ['--- a/document.md', '+++ b/document.md'];
  for (const hunk of hunks) {
    lines.push(
      `@@ -${hunk.originalStart},${hunk.originalCount} +${hunk.currentStart},${hunk.currentCount} @@`,
    );
    appendComputedHunkLines(lines, hunk, original, current);
  }
  return `${lines.join('\n')}\n`;
}

function appendComputedHunkLines(
  lines: string[],
  hunk: MarkdownDiffHunk,
  original: SplitContent | undefined,
  current: SplitContent | undefined,
): void {
  let originalLine = hunk.originalStart;
  let currentLine = hunk.currentStart;
  for (const line of hunk.lines) {
    if (line.type === 'same') {
      appendSameLine(lines, line.text, original, current, originalLine, currentLine);
      originalLine++;
      currentLine++;
    } else if (line.type === 'added') {
      appendLine(lines, '+', line.text, current, currentLine);
      currentLine++;
    } else if (line.type === 'removed') {
      appendLine(lines, '-', line.text, original, originalLine);
      originalLine++;
    } else {
      appendLine(lines, '-', line.oldText, original, originalLine);
      appendLine(lines, '+', line.newText, current, currentLine);
      originalLine++;
      currentLine++;
    }
  }
}

function appendSameLine(
  lines: string[],
  text: string,
  original: SplitContent | undefined,
  current: SplitContent | undefined,
  originalLine: number,
  currentLine: number,
): void {
  const originalMissing = isFinalLineWithoutNewline(original, originalLine);
  const currentMissing = isFinalLineWithoutNewline(current, currentLine);
  if (originalMissing !== currentMissing) {
    appendLine(lines, '-', text, original, originalLine);
    appendLine(lines, '+', text, current, currentLine);
  } else {
    lines.push(` ${text}`);
    if (originalMissing && currentMissing) lines.push('\\ No newline at end of file');
  }
}

function appendLine(
  lines: string[],
  prefix: '-' | '+',
  text: string,
  content: SplitContent | undefined,
  lineNumber: number,
): void {
  lines.push(`${prefix}${text}`);
  if (isFinalLineWithoutNewline(content, lineNumber)) lines.push('\\ No newline at end of file');
}

function isFinalLineWithoutNewline(content: SplitContent | undefined, lineNumber: number): boolean {
  return Boolean(content && !content.hasTrailingNewline && lineNumber === content.lines.length);
}

export type { DiffHunk };
