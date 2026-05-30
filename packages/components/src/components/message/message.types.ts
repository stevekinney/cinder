import type { Snippet } from 'svelte';
/**
 * Chat-style bubble with a role label and optional timestamp. Use to
 * compose AI agent transcripts, support-thread views, run streams.
 */
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageProps = {
  /** Role of the speaker — drives visual treatment. */
  role: MessageRole;
  /** Optional timestamp string rendered in the header. */
  time?: string;
  /** Optional speaker name override (defaults derived from role). */
  name?: string;
  /** Additional class names merged with `.cinder-message`. */
  class?: string;
  /** Message body content. */
  children: Snippet;
};
