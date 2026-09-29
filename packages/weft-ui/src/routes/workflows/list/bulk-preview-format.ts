/**
 * Pure formatting helpers for the Tier-3 bulk-action dialog (plan §9.2/§10.6
 * T8.1; design `Weft Patterns.dc.html` Tier-3 mock: "Type `cancel 47
 * workflows` to confirm" / filter chip `status:failed · type:payment-capture`).
 */
/**
 * Structurally loose enough to accept both the server's own
 * `BulkOperationFilterSummary` (dry-run `preview.scope.filter`, mutable
 * arrays) and this track's local `BulkListFilterInput` (readonly arrays,
 * `bulk-list-filter.ts`) — `filterSummaryChip` renders the same chip from
 * either source (a fresh dry-run result, or the not-yet-previewed purge
 * filter) without needing two near-identical functions.
 */
interface FilterSummaryLike {
  readonly status?: string | readonly string[];
  readonly type?: string;
  readonly tags?: readonly string[];
  readonly attributes?: readonly { readonly key: string }[];
}

/**
 * The exact phrase the operator must type to confirm — matches the design
 * mock's `<verb> <matched> workflow(s)` pattern precisely
 * (`cancel 47 workflows`, `delete 1 workflow`).
 */
export function confirmPhrase(verb: string, matched: number): string {
  return `${verb} ${matched} workflow${matched === 1 ? '' : 's'}`;
}

/** `true` when `input` matches `phrase` case-insensitively, trimmed — the `ConfirmDialog`/`AlertDialog` type-to-confirm rule (plan §10.6). */
export function confirmPhraseMatches(input: string, phrase: string): boolean {
  return input.trim().toLowerCase() === phrase.toLowerCase();
}

/**
 * One-line filter summary chip (design: `status:failed · type:payment-capture`).
 * Dimensions appear in the same order as `BulkOperationFilterSummary`'s own
 * fields; an omitted dimension is simply absent from the chip. Returns the
 * empty string for a filter with no scoping dimension at all — the bar
 * itself disables actions before that state is reachable
 * (`bulk-filter-scope.ts`), but this stays honest rather than fabricating a
 * placeholder.
 */
export function filterSummaryChip(filter: FilterSummaryLike): string {
  const parts: string[] = [];

  if (filter.status !== undefined) {
    const status: string | readonly string[] = filter.status;
    parts.push(`status:${Array.isArray(status) ? status.join(',') : String(status)}`);
  }
  if (filter.type !== undefined) {
    parts.push(`type:${filter.type}`);
  }
  if (filter.tags !== undefined && filter.tags.length > 0) {
    parts.push(`tags:${filter.tags.join(',')}`);
  }
  if (filter.attributes !== undefined && filter.attributes.length > 0) {
    parts.push(`attributes:${filter.attributes.map((attribute) => attribute.key).join(',')}`);
  }

  return parts.join(' · ');
}
