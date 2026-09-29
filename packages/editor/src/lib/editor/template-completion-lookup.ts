/**
 * The low-level `lookupCandidates` call behind placeholder completion,
 * shared by every editing mode.
 *
 * One lookup runs at a time, debounced by the configuration's
 * `lookupDebounceMs`. Starting another or cancelling aborts the previous
 * one, and results are delivered with the configuration they were requested
 * under, so the caller can discard results for any other configuration.
 */

import type { PlaceholderCandidate } from '@lostgradient/markdown';

import type { PlaceholderCompletionSource } from './template-placeholder-configuration.js';

/** Results of one lookup. */
export interface CompletionLookupResult {
  readonly query: string;
  readonly candidates: PlaceholderCandidate[];
  /** The completion configuration the lookup ran under. */
  readonly source: PlaceholderCompletionSource;
}

export class CompletionLookup {
  readonly #deliver: (result: CompletionLookupResult) => void;
  #pending: { controller: AbortController; timeout: ReturnType<typeof setTimeout> } | null = null;
  #query: string | null = null;

  constructor(deliver: (result: CompletionLookupResult) => void) {
    this.#deliver = deliver;
  }

  /** The query of the current lookup, or `null` when none was started since the last cancel. */
  get query(): string | null {
    return this.#query;
  }

  /** Abort any pending lookup and forget its query. */
  cancel(): void {
    this.#query = null;
    if (!this.#pending) return;
    this.#pending.controller.abort();
    clearTimeout(this.#pending.timeout);
    this.#pending = null;
  }

  /** Replace any pending lookup with one for `query` under `completion`. */
  schedule(query: string, completion: PlaceholderCompletionSource): void {
    this.cancel();
    this.#query = query;
    const lookupCandidates = completion.lookupCandidates;
    if (!lookupCandidates) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const candidates = await lookupCandidates(query, controller.signal);
        if (controller.signal.aborted) return;
        this.#deliver({ query, candidates, source: completion });
      } catch {
        // Lookup failures leave static suggestions visible and do not escape the view lifecycle.
      }
    }, completion.lookupDebounceMs);
    this.#pending = { controller, timeout };
  }
}
