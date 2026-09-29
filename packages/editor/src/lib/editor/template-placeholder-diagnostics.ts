/**
 * The ordered placeholder diagnostics reported to MarkdownEditor callers.
 *
 * Token diagnostics are computed from the Markdown string the component
 * exposes as `value`, so their offsets index that string in every editing
 * mode. Rich-mode decorations scan ProseMirror runs separately.
 */

import {
  parseMarkdownPlaceholderTokens,
  sortPlaceholderDiagnostics,
  validatePlaceholderTokens,
  type PlaceholderDiagnostic,
} from '@lostgradient/markdown';

import type { ResolvedPlaceholderConfiguration } from './template-placeholder-configuration.js';

/**
 * Configuration diagnostics plus, when validation is configured, one token
 * diagnostic per invalid token in `markdown`, in the Markdown package's order.
 * With nothing configured nothing is scanned.
 */
export function computePlaceholderDiagnostics(
  configuration: ResolvedPlaceholderConfiguration,
  markdown: string,
): readonly PlaceholderDiagnostic[] {
  const candidates = configuration.validationCandidates;
  if (!candidates) return configuration.issues;
  const tokenIssues = validatePlaceholderTokens(
    parseMarkdownPlaceholderTokens(markdown),
    candidates,
  );
  if (tokenIssues.length === 0) return configuration.issues;
  return Object.freeze(sortPlaceholderDiagnostics([...configuration.issues, ...tokenIssues]));
}
