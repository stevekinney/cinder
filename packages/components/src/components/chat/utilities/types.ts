/**
 * Chat data model types built on top of the vendored conversation model.
 *
 * Core types live in `../conversation-model.ts`; this module provides only
 * project-specific extensions, including the cinder-OWNED render-part layer
 * (`ChatMessagePart`) that sits on top of the structural `Message` mirror.
 */

import type {
  Message,
  MultiModalContent,
  ToMarkdownOptions,
  ToolCall,
  ToolCallPair,
  ToolResult,
} from '../conversation-model.ts';

/**
 * Delivery status for messages in the UI.
 * This is transient state stored in message metadata with a `_` prefix
 * (e.g., `_deliveryStatus`) so it's automatically stripped on export.
 */
export type DeliveryStatus = 'draft' | 'sending' | 'sent' | 'failed';

/**
 * Options for exporting a chat transcript. Equivalent to the vendored
 * {@link ToMarkdownOptions} (which already carries `includeHidden`,
 * `redactHiddenContent`, and the redaction controls); exposed under a
 * chat-specific name for the public `@lostgradient/cinder/chat` surface.
 */
export type ChatExportOptions = ToMarkdownOptions;

/**
 * A markdown render part — the effective body text of a message.
 *
 * `content` is always the full effective text (streaming `overrideContent` is
 * resolved into it by `deriveMessageParts`, so the part is render-ready). The
 * streaming/expanded flags are presentation hints the renderer forwards to the
 * markdown sub-component; they never become authoritative transcript data.
 */
export type MarkdownMessagePart = {
  type: 'markdown';
  /** Stable identity for the keyed `{#each}` over parts. */
  key: string;
  content: string;
  /** Whether this part is being streamed (drives the cursor/tail affordance). */
  streaming: boolean;
  /** Whether long content is fully expanded (drives truncation). */
  expanded: boolean;
};

/**
 * A tool-call render part — one tool invocation paired with its result, if one
 * exists yet.
 *
 * `pair` is the resolved {@link ToolCallPair} threaded in through
 * `MessagePartDerivationContext`. When no result has arrived (the pairing is
 * still pending), `pair.result` is `undefined` — the part is still emitted so a
 * pending tool call renders rather than silently falling back to text.
 */
export type ToolCallMessagePart = {
  type: 'tool-call';
  /** Stable identity, derived from the message id + the tool call id. */
  key: string;
  pair: ToolCallPair;
};

/**
 * A tool-result render part — the outcome of a tool call rendered on its own.
 *
 * Used for tool-result messages that are NOT folded into a paired tool-call
 * card (the container hides paired results). Carries the structured
 * {@link ToolResult} so the renderer can branch on `outcome` for error /
 * action-required / success styling, exactly as the historical role-branch did.
 */
export type ToolResultMessagePart = {
  type: 'tool-result';
  /** Stable identity, derived from the message id + the result's call id. */
  key: string;
  result: ToolResult;
};

/**
 * An image render part — a single image segment of multi-modal message content.
 *
 * Carries the original {@link MultiModalContent} image so the renderer can hand
 * it to the existing attachment view (url, alt text, lightbox).
 */
export type ImageMessagePart = {
  type: 'image';
  /** Stable identity, derived from the message id + the image's content index. */
  key: string;
  image: Extract<MultiModalContent, { type: 'image' }>;
};

/**
 * The cinder-owned discriminated union of renderable message parts.
 *
 * This is a UI layer derived from the compatible {@link Message} shape — it is
 * never written back to the transcript. C1 ships the renderable set
 * (`markdown`, `tool-call`, `tool-result`, `image`); the agent-specific parts
 * (tool-approval, reasoning, step, suggestion) are added by later Chat tasks,
 * which widen this union and add their renderer cases together so the static
 * part switch stays exhaustive (the renderer's `{:else}` sentinel + the `never`
 * narrowing there force the new branch to be added).
 */
export type ChatMessagePart =
  | MarkdownMessagePart
  | ToolCallMessagePart
  | ToolResultMessagePart
  | ImageMessagePart;

/**
 * Per-message context threaded into `deriveMessageParts`.
 *
 * Keeps the bridge pure while informing it of conversation-global facts it
 * cannot compute from a single {@link Message}: the resolved tool-call pairing
 * (computed once at the container from the ordered transcript) and the live
 * streaming override buffer. Passing the already-resolved pair — rather than the
 * whole pairs-by-id map — avoids both a re-pairing pass inside derive and the
 * reactive-staleness trap of mutating a shared map in place.
 */
export type MessagePartDerivationContext = {
  /**
   * The resolved tool-call pair for this message's `toolCall`, if the container
   * found one. A tool-call message renders as a card only when this is present
   * (mirroring the original `isToolCall && toolPair` guard); with no pair, derive
   * falls through to the text body. A still-pending call is represented by a pair
   * whose `result` is `undefined`, not by an absent pair.
   */
  toolCallPair?: ToolCallPair | undefined;
  /**
   * Live streaming buffer for this message. When present, it replaces the
   * message's text body so the markdown part is render-ready (no override
   * plumbing leaks into the part component).
   */
  overrideContent?: string | undefined;
  /** Whether this message is currently streaming (drives the markdown part's cursor/tail). */
  streaming?: boolean | undefined;
  /** Whether long content is expanded (drives the markdown part's truncation). */
  expanded?: boolean | undefined;
};

/** Re-export the part-relevant model types so part consumers import from one place. */
export type { Message, MultiModalContent, ToolCall, ToolCallPair, ToolResult };
