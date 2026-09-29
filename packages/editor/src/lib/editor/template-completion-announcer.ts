/**
 * The persistent status announcements for placeholder completion, shared by
 * every editing mode: the match count whenever the list changes, then the
 * active option whenever it moves.
 */

import { describeCandidateTypes } from './template-completion-popup.js';
import type { CompletionState } from './template-completion-state.js';

type AnnouncedState = Pick<CompletionState, 'suggestions' | 'activeIndex'>;

/** The count announcement for a list of matches. */
export function describeMatchCount(count: number): string {
  if (count === 0) return 'No matching placeholders';
  return count === 1 ? '1 placeholder available' : `${count} placeholders available`;
}

function describeActiveOption(state: AnnouncedState): string {
  const candidate = state.suggestions[state.activeIndex];
  if (!candidate) return '';
  const position = `${state.activeIndex + 1} of ${state.suggestions.length}`;
  return `${candidate.path}, ${describeCandidateTypes(candidate)}, ${position}`;
}

/** Tracks what was last announced so each message is sent once. */
export class CompletionAnnouncer {
  readonly #onStatusChange: ((message: string) => void) | undefined;
  #status = '';
  #announcedList: string | null = null;
  #announcedIndex = -1;

  constructor(onStatusChange: ((message: string) => void) | undefined) {
    this.#onStatusChange = onStatusChange;
  }

  /** Announce the count for a new list, or the active option after it moves. */
  announceState(state: AnnouncedState): void {
    const listKey = state.suggestions.map((candidate) => candidate.path).join('\n');
    if (listKey !== this.#announcedList) {
      this.#announcedList = listKey;
      this.#announcedIndex = state.activeIndex;
      this.#announce(describeMatchCount(state.suggestions.length));
      return;
    }
    if (state.activeIndex !== this.#announcedIndex) {
      this.#announcedIndex = state.activeIndex;
      this.#announce(describeActiveOption(state));
    }
  }

  /** Empty the status region and forget what was announced. */
  clear(): void {
    this.#announce('');
  }

  #announce(message: string): void {
    if (message === '') {
      this.#announcedList = null;
      this.#announcedIndex = -1;
    }
    if (message === this.#status) return;
    this.#status = message;
    this.#onStatusChange?.(message);
  }
}
