/**
 * Scope ↔ domain affinity for the Operations tab's `PermissionMatrix`
 * toggle (plan §9.7 T7.4; design `Weft UI.dc.html` "System" §
 * OPERATION CATALOG "Table / Scope matrix" toggle).
 *
 * ## What this matrix actually shows (and why it isn't per-operation scope)
 *
 * `operation-catalog.ts`'s module doc already establishes that no discovery
 * document advertises which scope a given operation requires — filed
 * upstream as stevekinney/weft#737. A `PermissionMatrix` with rows=scopes,
 * columns=INDIVIDUAL OPERATIONS therefore can't be built honestly; every
 * cell would be a guess.
 *
 * What IS derivable without guessing: weft's own scope-naming convention
 * puts a domain prefix before the colon (`workflows:read`, `schedules:write`,
 * `system:admin`, …), and every operation's OpenAPI/OpenRPC `tags` entry
 * names that same domain (`"Workflows"`, `"Schedules"`, `"System"`, …) —
 * verified against a live discovery-document pair. Matching a scope's
 * prefix against an operation-tag's lowercased name is a literal string
 * comparison of two REAL, wire-sourced vocabularies, not a fabricated
 * mapping — it says "this scope's vocabulary belongs to this domain," not
 * "this exact operation requires this exact scope." The UI labels the
 * matched state "Same domain" (never "Granted"/"Required") so it can't be
 * mistaken for a per-operation authorization answer.
 */
import type { PermissionMatrixAxisItem, PermissionMatrixCellState } from '@lostgradient/cinder';
import { AUTHORIZATION_SCOPES } from '../../lib/scopes.svelte.ts';

/** Scope rows for the matrix, in `AUTHORIZATION_SCOPES` declaration order. */
export const SCOPE_MATRIX_ROWS: readonly PermissionMatrixAxisItem[] = AUTHORIZATION_SCOPES.map(
  (scope) => ({ id: scope, label: scope }),
);

function domainOf(scope: string): string {
  return scope.split(':')[0] ?? scope;
}

/** Sorted, de-duplicated domain columns from a set of operation-catalog tags. */
export function domainColumnsFromTags(
  tags: readonly string[],
): readonly PermissionMatrixAxisItem[] {
  const unique = [...new Set(tags)].toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return unique.map((tag) => ({ id: tag, label: tag }));
}

/** `'granted'` (displayed as "Same domain") when the scope's prefix matches the tag, case-insensitively — see module doc for exactly what this does and doesn't claim. */
export function scopeDomainCellState(
  row: PermissionMatrixAxisItem,
  column: PermissionMatrixAxisItem,
): PermissionMatrixCellState {
  const scope = row.id;
  return domainOf(scope).toLowerCase() === column.label.toLowerCase()
    ? 'granted'
    : 'not-applicable';
}
