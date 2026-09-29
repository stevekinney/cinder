import type { ConversationHistory, JSONValue, TokenUsage, ToolResult } from 'conversationalist';

/**
 * A settled tool call as the wire carries it.
 *
 * DEFINED HERE, not imported from the component layer, and that direction is
 * the point. This module describes a transport contract: it is compiled by
 * every producer of chat frames, including servers and desktop main processes
 * that render nothing. It previously took this type from
 * `components/chat/adapter/chat-adapter.ts`, which type-imports
 * `@lostgradient/cinder` for an unrelated approval type — so a producer that
 * wanted `ChatStreamEvent` and nothing else compiled 1,086 Cinder files and
 * every one of their `import './x.css'` side effects, which a bundler-free
 * `tsc` program cannot resolve at all.
 *
 * Both halves come from `conversationalist`, which the wire types
 * already depend on, so nothing about the type changed — only who owns it.
 * `chat-adapter.ts` re-exports it, so every existing consumer is unaffected.
 */
export type ChatToolResult = ToolResult & {
  pendingApproval?: JSONValue;
};

/**
 * Wire-envelope fields a frame carries per the reference architecture's
 * stream wire contract: a supported `wireVersion` plus a request-local
 * monotonically increasing `sequence`.
 *
 * Version 2 adds the `assistant.step.*` vocabulary and nothing else. A
 * version 1 producer keeps working unchanged, and a version 1 frame is still
 * decoded exactly as before — the version is carried through rather than
 * normalized, so a consumer can tell which vocabulary it is reading.
 *
 * These are REQUIRED on every member added by CIN-507 (`stream:*`, `tool.*`,
 * `run.*`) because that vocabulary is defined by the wire contract the
 * envelope belongs to. They stay OPTIONAL on the three original members
 * (`text`, `tool_call`, `tool_result`) because a published consumer may
 * already emit those as bare frames predating the envelope, and this change
 * must decode them unchanged rather than break a deployed producer.
 */
export type WireEnvelope = {
  wireVersion: 1 | 2;
  sequence: number;
};

/**
 * The envelope a member introduced by wire version 2 requires. Declaring it
 * separately is what makes "this frame did not exist before version 2" a
 * type error rather than a convention: a version 1 producer cannot construct
 * an `assistant.step.*` frame at all.
 */
export type V2WireEnvelope = {
  wireVersion: 2;
  sequence: number;
};

/**
 * A legacy member either carries no envelope at all, or the complete one —
 * never half of it. `Partial<WireEnvelope>` would let a TypeScript consumer
 * legally construct `{ type: 'text', text: 'x', wireVersion: 1 }` (no
 * `sequence`) with no cast required, even though `encodeChatStreamEvent`
 * throws on it and the decoder rejects it — this union keeps the public
 * type honest about the runtime contract.
 *
 * The `?: never` keys on the bare branch are load-bearing. A plain `T` there
 * is not enough: excess-property checking does not reject `wireVersion`,
 * because the property IS known to another member of the same union, so
 * `{ type: 'text', text: 'x', wireVersion: 1 }` would typecheck against the
 * bare branch even under `exactOptionalPropertyTypes`. Declaring the keys as
 * optional-`never` makes that half-envelope match neither branch.
 */
export type WithOptionalEnvelope<T> =
  (T & { wireVersion?: never; sequence?: never }) | (T & WireEnvelope);

/**
 * An envelope that has been read but not yet required: either complete, or
 * absent entirely.
 *
 * `Partial<WireEnvelope>` is the obvious spelling and the wrong one, for the
 * same reason {@link WithOptionalEnvelope} exists — it admits half an
 * envelope. It is also not portable across `exactOptionalPropertyTypes`:
 * with the flag off, `Partial<T>` adds `| undefined` to every member, and
 * spreading the result into a frame matches neither branch of
 * `WithOptionalEnvelope` (the bare branch declares the keys `?: never`, the
 * versioned branch requires them). A consumer compiling this package with the
 * flag off — an application whose other dependencies force it — would see
 * three otherwise inexplicable errors in the decoder.
 *
 * Stating the same all-or-nothing union the public type already promises
 * fixes both: it cannot express half an envelope, and it means the same thing
 * under either setting.
 */
export type OptionalWireEnvelope = WireEnvelope | { wireVersion?: never; sequence?: never };

/** The supported wire versions. Any other value is rejected outright. */
export const SUPPORTED_WIRE_VERSIONS = [1, 2] as const;

/** Narrows an untrusted value to a wire version this codec speaks. */
export function isSupportedWireVersion(value: unknown): value is 1 | 2 {
  return value === 1 || value === 2;
}

// ---------------------------------------------------------------------------
// Local, provider-neutral equivalents of Operative's `StreamEvent` vocabulary
// (`@lostgradient/operative`, `src/streaming/types.ts`). Chat does not depend on
// Operative at runtime — depending on it here would invert the provider-
// neutral layering — so these shapes are declared structurally rather than
// imported. Keep them in lockstep with Operative's `StreamEvent`,
// `StreamBlock`, and `StreamState` types by hand.
// ---------------------------------------------------------------------------

/** Discriminator for blocks tracked by Operative's stream state machine. */
export type ChatStreamBlockType = 'text' | 'tool-call' | 'thinking' | 'metadata';

/** Local equivalent of Operative's `StreamBlock`. */
export type ChatStreamBlock = {
  id: string;
  type: ChatStreamBlockType;
  index: number;
  content: string;
  complete: boolean;
  toolName?: string;
  partialArguments?: string;
};

/**
 * Local equivalent of Operative's `StreamState`. `usage` reuses
 * Conversationalist's `TokenUsage` — the same type Operative itself imports
 * from Conversationalist for this field, so this is not a parallel
 * definition, just the type Chat already depends on directly.
 */
export type ChatStreamState = {
  blocks: ChatStreamBlock[];
  activeBlock?: ChatStreamBlock;
  textContent: string;
  toolCalls: ChatStreamBlock[];
  complete: boolean;
  usage?: TokenUsage;
};

/**
 * Local equivalents of Operative's `AgentRunErrorKind` / `AgentRunErrorCode`
 * (`@lostgradient/operative`, `src/errors.ts`). Declared structurally rather
 * than imported at runtime — Chat must not depend on Operative at runtime,
 * since that would invert the provider-neutral layering and pull Operative's
 * Anthropic/OpenAI/Gemini provider code into the browser bundle — but
 * `ChatAgentRunErrorCode` is kept in exact, compiler-verified lockstep with
 * Operative's exported `AgentRunErrorCode` by a type-only devDependency and
 * a bidirectional type-equality assertion in
 * `stream-event-codec-error-code-parity.test.ts` (COR-248). Add or remove a
 * member here only in the same change that does so on the Operative side;
 * the parity test fails to typecheck otherwise.
 */
export type ChatAgentRunErrorKind =
  'load' | 'contract' | 'generate' | 'tool' | 'abort' | 'output' | 'policy';

export type ChatAgentRunErrorCode =
  | 'INVALID_EXPORT'
  | 'LOAD_FAILED'
  | 'ABORTED'
  | 'BUDGET_EXCEEDED'
  | 'ELICITATION_DENIED'
  | 'INVALID_AGENT_HANDLE'
  | 'INVALID_OUTPUT'
  | 'MAXIMUM_STEPS'
  | 'NON_JSON_OUTPUT'
  | 'OUTPUT_SCHEMA_CONVERSION_FAILED'
  | 'SELECTION_REVALIDATION_FAILED'
  | 'SUBAGENT_RUN_FAILED'
  | 'TRIPWIRE'
  | 'UNKNOWN';

/**
 * Local equivalent of Operative's `SerializedAgentRunError`, with `cause`
 * removed entirely. `cause` is untyped on the Operative side and may carry a
 * credential-bearing provider payload; the reference architecture's error
 * contract forbids forwarding it unfiltered. Do not add `cause` back to this
 * wire type — if a redacted, JSON-safe projection of it is ever needed, that
 * is a new, deliberately-named field, not this one made permissive again.
 */
export type ChatSerializedRunError = {
  name: string;
  message: string;
  kind: ChatAgentRunErrorKind;
  code: ChatAgentRunErrorCode;
  /**
   * Whether the failure is worth retrying, as the host classified it.
   *
   * `kind` cannot answer this. A rate-limited provider and a rejected API key
   * are both `kind: 'generate'`, and one is worth a retry button while the
   * other never is — so a client deriving retryability from `kind` alone would
   * offer the wrong affordance for a whole category of failure.
   *
   * Optional because a host that does not classify its failures should not be
   * forced to guess: absent means "not stated", which a client must render as
   * neither retryable nor terminal rather than defaulting to either. Every
   * producer written before this field existed keeps working unchanged.
   */
  retryable?: boolean;
};

/** Provider-neutral events emitted by a chat response stream. */
export type ChatStreamEvent =
  | WithOptionalEnvelope<{ type: 'text'; text: string }>
  | WithOptionalEnvelope<{ type: 'tool_call'; id: string; name: string; arguments: JSONValue }>
  | WithOptionalEnvelope<{ type: 'tool_result' } & ChatToolResult>
  // Operative's raw stream event vocabulary, mirrored field-for-field.
  | ({ type: 'stream:block-start'; block: ChatStreamBlock } & WireEnvelope)
  | ({ type: 'stream:block-delta'; block: ChatStreamBlock; delta: string } & WireEnvelope)
  | ({ type: 'stream:block-complete'; block: ChatStreamBlock } & WireEnvelope)
  | ({ type: 'stream:text-delta'; content: string; accumulated: string } & WireEnvelope)
  | ({ type: 'stream:tool-call-start'; toolName: string; blockId: string } & WireEnvelope)
  | ({
      type: 'stream:tool-call-delta';
      toolName: string;
      blockId: string;
      partialArguments: string;
    } & WireEnvelope)
  | ({
      type: 'stream:tool-call-complete';
      toolName: string;
      blockId: string;
      /** Narrowed from Operative's `unknown` — honest here because this value
       *  has already round-tripped through JSON on the wire. */
      arguments: JSONValue;
    } & WireEnvelope)
  | ({ type: 'stream:usage'; usage: TokenUsage } & WireEnvelope)
  | ({ type: 'stream:complete'; state: ChatStreamState } & WireEnvelope)
  | ({
      type: 'stream:error';
      /** Narrowed from Operative's `unknown` — honest here for the same
       *  reason as `stream:tool-call-complete.arguments` above. */
      error: JSONValue;
    } & WireEnvelope)
  // Curated `tool.*` run events, keyed by `toolCallId` per the reference
  // architecture's stream wire contract table.
  | ({ type: 'tool.started'; toolCallId: string; toolName: string } & WireEnvelope)
  | ({
      type: 'tool.progress';
      toolCallId: string;
      toolName: string;
      percent?: number;
      message?: string;
    } & WireEnvelope)
  // `result` reuses `ChatToolResult` — the same type the legacy `tool_result`
  // member already validates — because a paused result's descriptor is
  // exactly `ChatToolResult`'s existing `action` field (outcome:
  // 'action_required'). This is the "paused result may carry a descriptor"
  // case the reference architecture's table calls out.
  | ({
      type: 'tool.settled';
      toolCallId: string;
      toolName: string;
      result: ChatToolResult;
    } & WireEnvelope)
  | ({
      type: 'tool.error';
      toolCallId: string;
      toolName: string;
      /** Narrowed from Operative's `unknown` for the same reason as the
       *  `stream:*` fields above. */
      error: JSONValue;
    } & WireEnvelope)
  | ({
      type: 'tool.policy-denied';
      toolCallId: string;
      toolName: string;
      reason?: string;
    } & WireEnvelope)
  // Terminal `run.*` frames.
  | ({
      type: 'run.completed';
      /** The authoritative final conversation — the only successful
       *  terminal frame per the reference architecture's table. */
      conversation: ConversationHistory;
      content: string;
      usage: TokenUsage;
      finishReason: string;
    } & WireEnvelope)
  | ({ type: 'run.error'; error: ChatSerializedRunError } & WireEnvelope)
  | ({ type: 'run.tripwire'; error: ChatSerializedRunError } & WireEnvelope)
  | ({ type: 'run.aborted'; reason?: string } & WireEnvelope)
  // Assistant step boundaries (wire version 2).
  //
  // `messageId` is the HOST'S identifier for the row this step's text
  // belongs to, read from Operative's `StreamingHandle.messageId` before the
  // provider emits anything. It is deliberately not a provider block id —
  // those are per-block and per-provider — and deliberately not something
  // the client minted, because then the client would be reconciling its own
  // guess against the server's history rather than being told.
  | ({ type: 'assistant.step.started'; step: number; messageId: string } & V2WireEnvelope)
  | ({ type: 'assistant.step.completed'; step: number; messageId: string } & V2WireEnvelope)
  // Elicitation: a question the run is waiting on, and the human's answer.
  //
  // `elicitation.resolved` REPORTS THE HUMAN'S RESPONSE — it is not tool
  // settlement, and conflating the two is the defect this vocabulary exists
  // to avoid. A denied call still settles afterwards, through its own
  // `tool.settled`/`tool_result` frames saying the tool did not run; a client
  // that read a resolution as a settlement would close the call's row on an
  // answer rather than on a result, and would have nothing at all to show for
  // a question answered while its tool was still executing.
  //
  // REQUEST IDENTITY IS IMMUTABLE. `requestId` is the host's own identifier
  // for the question, minted once when it is asked and repeated verbatim on
  // the resolution. It is what lets a client tell "the question I am showing
  // was answered" from "some question was answered" — which is the whole
  // difference between clearing the right prompt and clearing a replacement
  // the person has not read yet. It is required on both members for that
  // reason: a resolution nobody can correlate is not a resolution.
  //
  // `toolCallId` is OPTIONAL because elicitation is not exclusively a tool
  // affordance — a host may ask a question between steps, with no call to
  // attribute it to. When it is present it names the call the question is
  // about.
  //
  // `action` reuses `ChatToolResult['action']` — the same descriptor
  // `tool_result` already carries and validates — because "approval" versus
  // "input" is exactly the distinction it draws, and a second parallel
  // vocabulary for it would be two things to keep in step.
  | ({
      type: 'elicitation.requested';
      requestId: string;
      toolCallId?: string;
      message: string;
      action?: ChatToolResult['action'];
    } & V2WireEnvelope)
  | ({
      type: 'elicitation.resolved';
      requestId: string;
      toolCallId?: string;
      accepted: boolean;
    } & V2WireEnvelope);
