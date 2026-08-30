/**
 * The single motion affordance selected for a chat turn.
 *
 * Specific, nested activity wins over the conversation-level streaming
 * indicator. This keeps a reasoning or tool row from competing with the
 * global typing indicator when both are active.
 */
export type ChatProgressState = 'idle' | 'streaming' | 'reasoning' | 'tool';

export type ChatProgressStateInputs = {
  streaming: boolean;
  reasoningStreaming: boolean;
  toolActivity: boolean;
};

/**
 * Selects exactly one progress affordance using this precedence:
 * reasoning (most specific), tool activity, streaming, then idle.
 */
export function selectChatProgressState({
  streaming,
  reasoningStreaming,
  toolActivity,
}: ChatProgressStateInputs): ChatProgressState {
  if (reasoningStreaming) return 'reasoning';
  if (toolActivity) return 'tool';
  if (streaming) return 'streaming';
  return 'idle';
}
