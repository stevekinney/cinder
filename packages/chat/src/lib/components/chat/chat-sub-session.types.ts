import type { Snippet } from 'svelte';
import type { ConversationHistory, Message } from './conversation-model.ts';

export type ChatSubSessionProps = {
  conversation: ConversationHistory;
  /** Keeps the child transcript visually active while its owner is running. */
  live?: boolean;
  /** Optional label for the nested transcript landmark. */
  label?: string;
  /** Render a custom row while retaining the child transcript shell. */
  row?: Snippet<[message: Message]>;
};
