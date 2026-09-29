/**
 * Equality for placeholder diagnostic lists, so MarkdownEditor reports a
 * list only when it actually changes. Ordering comes from
 * `sortPlaceholderDiagnostics` in `@lostgradient/markdown`.
 */

import type { PlaceholderDiagnostic } from '@lostgradient/markdown';

function sameLocation(left: PlaceholderDiagnostic, right: PlaceholderDiagnostic): boolean {
  const a = left.location;
  const b = right.location;
  if (a.kind === 'token' && b.kind === 'token') {
    return a.startOffset === b.startOffset && a.endOffset === b.endOffset;
  }
  if (a.kind === 'definition' && b.kind === 'definition') return a.pointer === b.pointer;
  if (a.kind === 'configuration' && b.kind === 'configuration') return a.property === b.property;
  return false;
}

/** Whether two ordered lists match by code, path, location and message. */
export function samePlaceholderDiagnostics(
  left: readonly PlaceholderDiagnostic[],
  right: readonly PlaceholderDiagnostic[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((diagnostic, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      diagnostic.code === other.code &&
      diagnostic.path === other.path &&
      diagnostic.message === other.message &&
      sameLocation(diagnostic, other)
    );
  });
}
