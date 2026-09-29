/**
 * Split rich-editor text into the runs where placeholder tokens may live.
 *
 * A run is a maximal stretch of adjacent text nodes carrying an identical
 * mark set inside an eligible textblock. Code blocks and inline code are
 * ineligible, and any non-text inline node (hard break, image, raw HTML)
 * ends a run. Link labels are ordinary marked text and stay eligible; a link
 * target is an attribute, never text. Because tokens are scanned per run, a
 * token can never cross a node or formatting boundary.
 */

import { Mark, type Node as ProseMirrorNode } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';

/** One contiguous, same-mark text run with its absolute start position. */
export interface PlaceholderTextRun {
  /** The run's text. */
  readonly text: string;
  /** Absolute document position of the run's first character. */
  readonly from: number;
  /** The mark set every character of the run carries. */
  readonly marks: readonly Mark[];
}

function isCodeMark(mark: Mark): boolean {
  return mark.type.spec.code === true;
}

/** Whether a textblock may contain placeholder tokens at all. */
export function isEligibleTextblock(node: ProseMirrorNode): boolean {
  return node.isTextblock && node.type.spec.code !== true;
}

/** Collect the eligible runs of one textblock whose content starts at `contentStart`. */
export function collectTextblockRuns(
  block: ProseMirrorNode,
  contentStart: number,
): PlaceholderTextRun[] {
  const runs: PlaceholderTextRun[] = [];
  let current: { text: string; from: number; marks: readonly Mark[] } | null = null;
  const flush = () => {
    if (current && current.text.length > 0) runs.push(current);
    current = null;
  };

  block.forEach((child, offset) => {
    const text = child.isText ? (child.text ?? '') : null;
    if (text === null || child.marks.some(isCodeMark)) {
      flush();
      return;
    }
    if (current && Mark.sameSet(current.marks, child.marks)) {
      current.text += text;
      return;
    }
    flush();
    current = { text, from: contentStart + offset, marks: child.marks };
  });
  flush();
  return runs;
}

/** Visit every eligible run in the document. */
export function forEachPlaceholderRun(
  document: ProseMirrorNode,
  visit: (run: PlaceholderTextRun) => void,
): void {
  document.descendants((node, position) => {
    if (!node.isTextblock) return true;
    if (isEligibleTextblock(node)) {
      for (const run of collectTextblockRuns(node, position + 1)) visit(run);
    }
    return false;
  });
}

/**
 * The run that holds the text immediately before a collapsed caret, with the
 * caret's offset inside it, or `null` when the caret is not in eligible text.
 */
export function findRunBeforeCaret(
  state: EditorState,
): { run: PlaceholderTextRun; offset: number } | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if (!isEligibleTextblock($from.parent)) return null;
  const caret = selection.from;
  for (const run of collectTextblockRuns($from.parent, $from.start())) {
    if (run.from < caret && caret <= run.from + run.text.length) {
      return { run, offset: caret - run.from };
    }
  }
  return null;
}
