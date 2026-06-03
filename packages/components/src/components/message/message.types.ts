import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Chat-style bubble with a role label and optional timestamp. Use to
 * compose AI agent transcripts, support-thread views, run streams.
 */
export type MessageRole = 'user' | 'assistant' | 'system';
// `role` here is the cinder *speaker* role (drives `data-cinder-role` and visual
// treatment), NOT the native ARIA `role`. The native one is Omit-ted so the bespoke
// union owns the name unambiguously rather than intersecting with `AriaRole`.
export type MessageProps = Omit<HTMLAttributes<HTMLElement>, 'class' | 'role'> & {
  /** Role of the speaker — drives visual treatment. */
  role: MessageRole;
  /**
   * The machine-readable date/time value placed on the `<time datetime>` attribute.
   * @example "2026-04-29T10:00"
   */
  datetime?: string;
  /**
   * Human-readable display text rendered inside the `<time>` element.
   * Falls back to `datetime` when omitted.
   */
  timestamp?: string;
  /** Optional speaker name override (defaults derived from role). */
  name?: string;
  /** Additional class names merged with `.cinder-message`. */
  class?: string;
  /** Message body content. */
  children: Snippet;
};
