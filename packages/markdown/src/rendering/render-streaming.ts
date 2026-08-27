/**
 * Streaming markdown rendering utilities.
 *
 * During streaming, partial content may contain unclosed code fences,
 * incomplete tables, or broken links. These functions find safe boundaries
 * to split content for rendering: everything before the boundary is valid
 * markdown that can be safely rendered; the tail after the boundary is
 * displayed as raw pre-wrap text with a cursor animation.
 *
 * @module
 */

/**
 * Find the last position in `text` where everything before it
 * forms valid, renderable markdown.
 *
 * Strategy (in priority order):
 * 1. If we're inside an unclosed code fence, split before the opening fence.
 * 2. If we're inside an unclosed table, split before the table starts.
 * 3. Otherwise, split at the last paragraph boundary (double newline).
 * 4. Fall back to the last single newline.
 * 5. If no newlines at all, return the full length (render everything).
 */
export function findSafeRenderBoundary(text: string): number {
  // Check for unclosed code fence
  const fenceIndex = findUnclosedCodeFence(text);
  if (fenceIndex !== -1) return fenceIndex;

  // Check for unclosed table (a line starting with | without a closing row)
  const tableIndex = findUnclosedTable(text);
  if (tableIndex !== -1) return tableIndex;

  // Fall back to the last paragraph boundary (double newline)
  const lastDoubleNewline = text.lastIndexOf('\n\n');
  if (lastDoubleNewline !== -1) return lastDoubleNewline;

  // Fall back to last single newline
  const lastNewline = text.lastIndexOf('\n');
  if (lastNewline !== -1) return lastNewline;

  // No good boundary — render everything
  return text.length;
}

/**
 * Find the start of an unclosed code fence.
 *
 * Scans for ``` or ~~~ fences and returns the position of the opening
 * fence if it's unclosed (odd number of fences). Returns -1 if all
 * fences are properly paired.
 */
function findUnclosedCodeFence(text: string): number {
  const fencePattern = /^(`{3,}|~{3,})/gm;
  let lastOpenFence = -1;
  let isOpen = false;
  let openChar = '';
  let openLength = 0;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(text)) !== null) {
    const fence = match[1] ?? '';
    const char = fence[0] ?? '';
    const length = fence.length;

    if (!isOpen) {
      // Opening a new fence
      isOpen = true;
      openChar = char;
      openLength = length;
      lastOpenFence = match.index;
    } else if (char === openChar && length >= openLength) {
      // Closing the fence (same or longer fence of same character)
      isOpen = false;
      lastOpenFence = -1;
    }
    // Otherwise: different char or shorter fence inside open block, skip
  }

  return isOpen ? lastOpenFence : -1;
}

/**
 * Find the start of an unclosed GFM table.
 *
 * A table requires at least a header row, a separator row (with |---|),
 * and is terminated by a blank line or EOF. If we find a separator row
 * without a subsequent blank line, the table is potentially incomplete.
 */
function findUnclosedTable(text: string): number {
  // Find the last table separator row (e.g., |---|---|)
  const separatorPattern = /^\|?[\s-]+\|[\s-|]+$/gm;
  let lastSeparatorIndex = -1;
  let match: RegExpExecArray | null;

  while ((match = separatorPattern.exec(text)) !== null) {
    lastSeparatorIndex = match.index;
  }

  if (lastSeparatorIndex === -1) return -1;

  // Check if there's a blank line after the separator (table might be complete)
  const afterSeparator = text.indexOf('\n\n', lastSeparatorIndex);
  if (afterSeparator !== -1) return -1; // Table is followed by blank line, probably complete

  // The table might be incomplete. Find its start by scanning backward
  // for the first non-table line before the separator.
  const beforeSeparator = text.lastIndexOf('\n\n', lastSeparatorIndex);
  if (beforeSeparator !== -1) return beforeSeparator;

  // Table starts at beginning of text
  return 0;
}

/**
 * Split streaming content into a renderable portion and a raw tail.
 *
 * @returns An object with `rendered` (safe markdown to process through
 * renderMarkdown) and `tail` (raw text to display with pre-wrap styling).
 */
export function splitStreamingContent(text: string): { rendered: string; tail: string } {
  if (!text) return { rendered: '', tail: '' };

  const boundary = findSafeRenderBoundary(text);

  if (boundary >= text.length) {
    return { rendered: text, tail: '' };
  }

  return {
    rendered: text.slice(0, boundary),
    tail: text.slice(boundary),
  };
}
