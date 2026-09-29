/**
 * Per-participant typing indicator state for the Chat component.
 *
 * Merges two sources of typing state:
 *   1. The `typingParticipants` prop — a plain array of {@link TypingParticipant}
 *      objects passed directly by the consumer (no adapter required).
 *   2. The adapter's `onTypingChange` push handler, forwarded by the container
 *      via the `onAdapterTypingChange` callback below.
 *
 * The adapter path accepts complete snapshots. An empty snapshot clears the
 * adapter-derived indicator immediately; removed ids disappear on the next
 * snapshot; duplicate ids are last-write-wins in input order. The adapter never
 * synthesizes a fallback participant.
 *
 * Accessibility contract (enforced in the component, not here):
 *   - A single always-in-DOM `<div aria-live="polite" aria-atomic="true">` outside
 *     the `role="log"` div; text is `""` when nobody is typing.
 *   - Announcements are debounced 400 ms to filter keystroke-level noise
 *     (inter-key intervals ~100–200ms) while staying within the ~300–500ms
 *     responsiveness window expected by NVDA/JAWS.
 *   - The announced text contains no trailing ellipsis (just names).
 *
 * @module
 */

import type { TypingParticipant } from '../chat.types.ts';

/** Debounce window for aria-live announcements (ms).
 *
 * 400ms filters keystroke-level noise (inter-key intervals ~100–200ms at normal
 * WPM) while staying within the ~300–500ms responsiveness window expected by
 * NVDA/JAWS users. The previous 2000ms value caused announcements to arrive
 * stale or be permanently suppressed in fast-update scenarios. */
const DEBOUNCE_MS = 400;

export type UseChatTypingIndicatorOptions = {
  /**
   * Getter returning the current `typingParticipants` prop value. Called
   * reactively via `$derived` inside this hook — the getter pattern avoids
   * carrying a `$props()` dependency here.
   */
  getTypingParticipants: () => TypingParticipant[] | undefined;
};

export type UseChatTypingIndicatorResult = {
  /**
   * The human-readable label to show in the typing indicator region.
   * Empty string when nobody is typing.
   */
  readonly typingLabel: string;
  /**
   * The same label, but debounced for the `aria-live` region. Cleared immediately
   * when all participants stop typing; delayed 400 ms before appearing (to avoid
   * announcing very brief typing bursts).
   */
  readonly announcedLabel: string;
  /** Total number of currently-typing participants. */
  readonly participantCount: number;
  /** Receive a complete participant snapshot from the adapter's push handler. */
  handleAdapterTypingChange: (participants: TypingParticipant[]) => void;
  /**
   * Clear all adapter-derived typing state and any pending debounce. Called by
   * the container on conversation change / subscription teardown so a typing
   * event from one conversation cannot leak into the next.
   */
  reset: () => void;
};

/**
 * Normalize adapter snapshots so duplicate participant ids are last-write-wins
 * and the output order follows the final write order from the input snapshot.
 */
export function normalizeTypingParticipants(
  participants: readonly TypingParticipant[],
): TypingParticipant[] {
  const participantsById = new Map<string, TypingParticipant>();

  for (const participant of participants) {
    participantsById.delete(participant.id);
    participantsById.set(participant.id, participant);
  }

  return Array.from(participantsById.values());
}

/**
 * Derive the visible typing label from a participant list.
 *
 * Truncation rules:
 *   - 0 participants  → `""` (empty — indicator hidden)
 *   - 1 participant   → `"Alice is typing…"`
 *   - 2 participants  → `"Alice and Bob are typing…"`
 *   - 3–4 participants → `"3 people are typing…"`
 *   - 5+ participants → `"Several people are typing…"`
 */
export function deriveTypingLabel(participants: TypingParticipant[]): string {
  const count = participants.length;
  if (count === 0) return '';
  if (count === 1) return `${participants[0]!.name} is typing…`;
  if (count === 2) return `${participants[0]!.name} and ${participants[1]!.name} are typing…`;
  if (count <= 4) return `${count} people are typing…`;
  return 'Several people are typing…';
}

/**
 * Derive the announced text for the `aria-live` region. Same as the visible
 * label but WITHOUT the trailing ellipsis (screen readers add their own pause).
 */
export function deriveAnnouncedLabel(participants: TypingParticipant[]): string {
  const count = participants.length;
  if (count === 0) return '';
  if (count === 1) return `${participants[0]!.name} is typing`;
  if (count === 2) return `${participants[0]!.name} and ${participants[1]!.name} are typing`;
  if (count <= 4) return `${count} people are typing`;
  return 'Several people are typing';
}

export function useChatTypingIndicator(
  options: UseChatTypingIndicatorOptions,
): UseChatTypingIndicatorResult {
  let adapterParticipants = $state<TypingParticipant[]>([]);

  // Debounced announced label (for aria-live). Starts empty and updates after a
  // 400 ms delay when participants appear, or immediately when they all clear.
  let announcedLabel = $state('');
  let debounceHandle: ReturnType<typeof setTimeout> | undefined;

  // Merged participant list. When the consumer passes a DEFINED `typingParticipants`
  // prop (even an empty array), it is AUTHORITATIVE — adapter snapshots are
  // ignored so a controlled consumer can clear stale typing state with
  // `typingParticipants={[]}`. The adapter path only contributes when the prop is
  // omitted (undefined).
  const mergedParticipants = $derived.by(() => {
    const propParticipants = options.getTypingParticipants();
    if (propParticipants !== undefined) return propParticipants;
    return adapterParticipants;
  });

  const typingLabel = $derived(deriveTypingLabel(mergedParticipants));
  const participantCount = $derived(mergedParticipants.length);

  // Extract the announcement text as a primitive $derived so the effect only
  // re-runs when the *string value* changes — not when mergedParticipants produces
  // a new array reference with the same count (e.g. participant-object churn at
  // count >= 3 where the label is "3 people are typing"). This prevents spurious
  // debounce restarts that would permanently delay the announcement.
  const announcementText = $derived(deriveAnnouncedLabel(mergedParticipants));

  // Reactively update the debounced announced label whenever typingLabel changes.
  $effect(() => {
    const current = typingLabel;

    if (current === '') {
      // Clear immediately so the live region is silenced as soon as typing stops.
      clearTimeout(debounceHandle);
      debounceHandle = undefined;
      announcedLabel = '';
      return undefined;
    }

    // Non-empty: debounce the announcement so very brief typing bursts are not
    // announced to screen readers.
    if (debounceHandle !== undefined) {
      clearTimeout(debounceHandle);
    }

    // Read the stable primitive $derived (not mergedParticipants) — avoids
    // re-triggering the effect on participant-object churn at stable counts.
    const text = announcementText;

    debounceHandle = setTimeout(() => {
      debounceHandle = undefined;
      announcedLabel = text;
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceHandle);
      debounceHandle = undefined;
    };
  });

  function handleAdapterTypingChange(participants: TypingParticipant[]): void {
    adapterParticipants = normalizeTypingParticipants(participants);
  }

  function reset(): void {
    // Clear ONLY the adapter-derived participants. The announced label and its
    // debounce are owned by the $effect, which is keyed on `typingLabel`: clearing
    // adapterParticipants recomputes `mergedParticipants` → `typingLabel`, and
    // the effect then clears or preserves the announcement as appropriate.
    // Forcibly clearing `announcedLabel`/the timer here would wipe a still-active
    // PROP-driven announcement (the effect would not re-run because `typingLabel`
    // is unchanged) — violating the prop-remains-authoritative invariant.
    adapterParticipants = [];
  }

  return {
    get typingLabel() {
      return typingLabel;
    },
    get announcedLabel() {
      return announcedLabel;
    },
    get participantCount() {
      return participantCount;
    },
    handleAdapterTypingChange,
    reset,
  };
}
