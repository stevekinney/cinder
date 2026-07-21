/**
 * Chat data model types built on top of the published Conversationalist model.
 *
 * Core types live in `../conversation-model.ts`; this module provides only
 * project-specific extensions, including the cinder-OWNED render-part layer
 * (`ChatMessagePart`) that sits on top of the structural `Message` mirror.
 */

import type {
  Message,
  MultiModalContent,
  ToMarkdownOptions,
  ToolAction,
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
 * Options for exporting a chat transcript. Equivalent to the published
 * {@link ToMarkdownOptions} (which already carries `includeHidden`,
 * `redactHiddenContent`, and the redaction controls); exposed under a
 * chat-specific name for the public `@lostgradient/chat` surface.
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
 * A tool-approval render part — emitted in place of a `tool-result` part when
 * the result's `outcome === 'action_required'` and an `action` is present.
 *
 * Renders a prompt asking the user to approve or deny a pending tool action.
 * `approved` is a tri-state: `true` (approved), `false` (denied), or `undefined`
 * (still pending). The `approved` field is derived from the container's
 * `approvedToolCallIds`/`deniedToolCallIds` sets — it is never written back to
 * the transcript.
 */
export type ToolApprovalMessagePart = {
  type: 'tool-approval';
  /** Stable identity, derived from the message id + the tool result's call id. */
  key: string;
  toolCallId: string;
  toolName: string;
  action: ToolAction;
  /** `true` = approved, `false` = denied, `undefined` = pending. */
  approved: boolean | undefined;
};

/**
 * A reasoning render part — an extended thinking block shown before the
 * assistant's final answer.
 *
 * Renders as a collapsible disclosure with a left-accent border. While
 * streaming, the toggle is disabled and a pulsing dot is shown; the expanded
 * region uses `aria-live="off"` during streaming to avoid token-by-token
 * announcements, and one polite "Reasoning complete." fires when streaming ends.
 *
 * Source: `message.metadata['cinder:reasoning']` (a string) or the explicit
 * `messageReasoning` prop on Chat. Never a required transcript field.
 */
export type ReasoningMessagePart = {
  type: 'reasoning';
  /** Stable identity, derived from the message id. */
  key: string;
  content: string;
  /** Whether this reasoning block is currently streaming. */
  streaming: boolean;
};

/**
 * Step status for a single step in a plan/step list.
 */
export type StepStatus = 'pending' | 'running' | 'done' | 'error';

/**
 * A step render part — one entry in an ordered plan/step list shown before
 * the final answer.
 *
 * Renders as a vertical stepper `<ol>`/`<li>`. Status is communicated via
 * both an aria-hidden icon and a visually-hidden text suffix so it is not
 * color-only. `aria-current="step"` is set on the active (running) step.
 *
 * Source: `message.metadata['cinder:steps']` (an array of `{title, content, status}`)
 * or the explicit `messageSteps` prop on Chat. Never a required transcript field.
 */
export type StepMessagePart = {
  type: 'step';
  /** Stable identity, derived from the message id + the step index. */
  key: string;
  index: number;
  title: string;
  content: string;
  status: StepStatus;
};

/**
 * A suggestion render part — a single suggested follow-up reply chip shown
 * after the assistant's final answer.
 *
 * Renders as a button chip inside a `role="toolbar"` container. Selecting a
 * chip calls `onsuggestionselect(label)` and moves focus to the composer input;
 * Chat does not remove the suggestion set automatically.
 * Consumers that want one-shot suggestions can track the selection and have
 * the `messageSuggestions` prop return `[]` for that message. The suggestion
 * set is derived from `message.metadata['cinder:suggestions']` (a JSONValue
 * array of strings) or the explicit `messageSuggestions` prop on Chat. It is
 * UI-only and never written back to the transcript.
 */
export type SuggestionMessagePart = {
  type: 'suggestion';
  /** Stable identity, derived from the message id + the suggestion index. */
  key: string;
  /** Zero-based position of this suggestion in the list. */
  index: number;
  /** The label text displayed on the chip and passed to `onsuggestionselect`. */
  label: string;
};

/**
 * The cinder-owned discriminated union of renderable message parts.
 *
 * This is a UI layer derived from the compatible {@link Message} shape — it is
 * never written back to the transcript. The union includes `markdown`,
 * `tool-call`, `tool-result`, `image`, `tool-approval`, `reasoning`, `step`,
 * and `suggestion`. Each widening also adds a renderer branch so the static
 * part switch stays exhaustive (the renderer's `{:else}` sentinel + the
 * `never` narrowing there force the new branch to be added).
 */
export type ChatMessagePart =
  | MarkdownMessagePart
  | ToolCallMessagePart
  | ToolResultMessagePart
  | ImageMessagePart
  | ToolApprovalMessagePart
  | ReasoningMessagePart
  | StepMessagePart
  | SuggestionMessagePart;

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
  /**
   * The set of tool-call IDs the consumer has already approved. Used to
   * derive the `approved: true` state on a `tool-approval` part without mutating
   * the transcript. Tool calls NOT in either set render as pending (`undefined`).
   */
  approvedToolCallIds?: ReadonlySet<string> | undefined;
  /**
   * The set of tool-call IDs the consumer has denied. Used to derive the
   * `approved: false` state on a `tool-approval` part without mutating the
   * transcript.
   */
  deniedToolCallIds?: ReadonlySet<string> | undefined;
  /**
   * Pre-body extended thinking block. When present and non-empty, a
   * `reasoning` part is emitted before the markdown body part. An empty string
   * is an explicit suppression sentinel and also blocks transcript-native
   * `thinking` content from rendering as reasoning.
   *
   * Source: `message.metadata['cinder:reasoning']` (a JSONValue string) or the
   * explicit `messageReasoning` per-message prop on Chat. Never a required
   * transcript field — absent from a plain transcript, this is `undefined` and
   * zero visual change results.
   */
  reasoning?: string | undefined;
  /**
   * Ordered plan/step list. When present and non-empty, one `step` part
   * per entry is emitted before the reasoning and markdown body parts.
   *
   * Source: `message.metadata['cinder:steps']` (a JSONValue array) or the
   * explicit `messageSteps` per-message prop on Chat. Never a required
   * transcript field.
   */
  steps?: ReadonlyArray<StepInfo> | undefined;
  /**
   * Suggested follow-up labels. When present and non-empty, one
   * `suggestion` part per entry is emitted after the markdown body part (and
   * before any image parts).
   *
   * Source: `message.metadata['cinder:suggestions']` (a JSONValue array of
   * strings) or the explicit `messageSuggestions` per-message prop on Chat.
   * Never a required transcript field — absent from a plain transcript, this
   * is `undefined` and zero visual change results.
   */
  suggestions?: ReadonlyArray<string> | undefined;
};

/** Re-export the part-relevant model types so part consumers import from one place. */
export type { Message, MultiModalContent, ToolAction, ToolCall, ToolCallPair, ToolResult };

/**
 * Shape of a single step entry as accepted by ChatProps.messageSteps and
 * stored in message.metadata['cinder:steps'].
 */
export type StepInfo = { title: string; content: string; status: StepStatus };
