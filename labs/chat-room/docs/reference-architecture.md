# Operative adoption reference architecture

<a id="decision-summary"></a>

## Decision summary

Chatroom's canonical exemplar keeps the `ConversationHistory` in the browser and posts the complete history to the server for each turn. The server owns the agent loop, provider credentials, toolbox, approval policy, and approval secret. This gives us one useful split: the browser owns _conversation state_, while the server owns _execution authority_.

The server-owned session model is a conditional variant, not a co-equal default. [CHR-2](https://linear.app/lost-gradient/issue/CHR-2/decide-the-canonical-state-model-for-the-operative-exemplar) made that decision explicitly. [CHR-15](https://linear.app/lost-gradient/issue/CHR-15/spike-whether-operatives-session-primitives-alone-can-carry-conversation-list) then proved that Operative's public session and durable-run primitives are sufficient for that variant. Bureau remains an internal application and is not a Chatroom dependency.

This document is the design authority for CHR-3 through CHR-14. A downstream pull request must link to the exact section that governs each design choice. If implementation evidence contradicts a decision here, update this document in the same pull request _before_ changing the implementation.

<a id="api-surface-and-versioning"></a>

## API surface and versioning

The adoption target is `@lostgradient/operative@0.2.0`, installed from the npm registry. The first adoption pull request must declare the dependency as the exact string `"0.2.0"` in `package.json`, with no caret, tilde, tag, or other range, and commit the corresponding registry resolution in `bun.lock`. As of August 20, 2026, npm publishes only [`@lostgradient/operative@0.1.0`](https://www.npmjs.com/package/@lostgradient/operative/v/0.1.0); `0.2.0` is still gated by [AB-24](https://linear.app/lost-gradient/issue/AB-24/publish-and-externally-verify-lostgradientoperative020). No downstream implementation may substitute a workspace link, source checkout, local tarball, patch, override, or another version while that gate is open.

There are two evidence levels, and mixing them would make this document sound more certain than the registry allows:

- **Published baseline**: `@lostgradient/operative@0.1.0` publicly exports `createAgent`, `AgentRun`, `RunEvent`, `RunResult`, `stopWhen`, `createAnthropicProvider`, `createAnthropicProviderStream`, `withStreaming`, `withEnhancedStreaming`, `StreamEvent`, `classifyError`, session primitives, and the run error classes used below.
- **Adoption contract**: `@lostgradient/operative@0.2.0` is required to implement the [approved typed Agent API](https://github.com/stevekinney/agent-bureau/blob/0a3dcc8b169999222833901c2edb1c21b29c2249/documentation/operative-type-safe-api.md): `createAgent({ name, generate, toolbox, output?, ... })`, synchronous `RunnableAgent.run()`, non-thenable `AgentRun`, `result()`, `unwrap()`, conditional `output()`, `abort()`, disposal, and `RunResult.output`. That document is a specification, not evidence that `0.2.0` is published.

The first `0.2.0` implementation pull request must verify the registry artifact before writing application code:

```sh
npm view @lostgradient/operative@0.2.0 version dist.integrity dist.shasum dist.tarball --json
```

It must then confirm every API named in this document against the installed declarations. Any mismatch blocks Chatroom work and belongs upstream; an internal export such as `createActiveRun` is not an acceptable substitute.

Chatroom currently composes the Operative contract with `armorer@0.14.0`, `conversationalist@0.6.1`, and `@lostgradient/chat@0.11.4`. Those exact installed versions define the current `Toolbox`, `ConversationHistory`, conversation-builder, and `ChatAdapter` behavior. A dependency bump that changes one of those contracts requires the same re-verification.

<a id="dependency-provenance"></a>

## Dependency provenance

Chatroom is a published-artifact testbed. `package.json` and `bun.lock` are the source of truth for what the application consumes. Chatroom does not declare Operative yet; the first adoption pull request must add the exact dependency described above, and the resulting lockfile entry must resolve through `https://registry.npmjs.org`. A green source-checkout test in Agent Bureau does not satisfy this boundary. Neither does a merged release pull request: the exact package must exist in npm and pass the external-consumer verification owned by AB-24.

<a id="state-model"></a>

## State model

The canonical model has two different owners on purpose:

- The browser owns the authoritative `ConversationHistory` value rendered by `@lostgradient/chat@0.11.4`.
- The server owns an ephemeral `AgentRun` for one HTTP request and all authority needed to execute it.

Operative owns the loop _within_ a request. The browser does not re-POST after every tool result and does not enforce a second client-side step cap. `createAgent({ maximumSteps, stopWhen, ... })` owns loop limits; `agent.run({ conversation })` snapshots the posted history and returns an `AgentRun`. The final run event returns the authoritative post-run history, which the browser reconciles into its state before considering the turn complete.

This is stateless in the server-persistence sense, not in the execution sense. One request may include several model and tool steps. A new request starts a new run from the full client-owned history.

<a id="conversation-ownership"></a>

## Conversation ownership

The browser creates, renders, and stores `ConversationHistory` using the public builders re-exported by `@lostgradient/chat@0.11.4`. It sends `{ conversation }` to `/api/chat`. The server validates that boundary, then passes the value to `RunnableAgent.run({ conversation })` from `@lostgradient/operative@0.2.0`.

Operative snapshots the input. It must never mutate the object supplied by the request parser, and the browser must never assume its posted object is being updated remotely. During a streamed run, wire events extend the browser's copy. On `run.completed`, the client reconciles the serialized `RunResult.conversation.current` as the final authority for that turn.

System instructions belong to the module-scoped `createAgent` definition. They are not appended again when resuming from `{ conversation }`; the posted history already contains the context accumulated so far.

Approval resume changes one existing message. `toolbox.resumeApproval()` produces the resolved result, and `resolveToolResult()` from `conversationalist@0.6.1` replaces the earlier `action_required` result by `callId`. Appending a second tool result for the same call is invalid because it leaves the provider with two results for one tool call.

<a id="credential-boundary"></a>

## Credential boundary

`ANTHROPIC_API_KEY` stays server-side. `createAnthropicProvider()` and `createAnthropicProviderStream()` from `@lostgradient/operative@0.2.0` are constructed only in server modules. No `.svelte` file, browser bundle, NDJSON frame, transcript message, error message, or log may contain the provider credential or the toolbox approval secret.

The browser may hold a signed pending-approval descriptor. That descriptor is a capability for one represented action, not the signing secret and not general tool authority.

<a id="toolbox-and-approval-ownership"></a>

## Toolbox and approval ownership

The host creates one module-scoped `Toolbox` with `createToolbox()` from `armorer@0.14.0` and passes that exact instance to `createAgent({ toolbox })`. Operative must use it as-is across runs. Building a fresh toolbox for each request breaks `toolbox.resumeApproval(signedApproval)`, because only the instance configured with the signing `approvalSecret` can verify the token.

The secret must remain stable for at least as long as an approval descriptor can be resumed, and every server instance that may accept `/api/chat/resume` must use the same secret. A process-random secret is acceptable only for the explicitly documented local-development limitation where a restart invalidates every pending approval. It is not the deployable stateless-host contract.

The agent parks with `stopWhen.pendingApproval()` combined with `stopWhen.noToolCalls()` from `@lostgradient/operative@0.2.0`. The combination matters: `pendingApproval()` stops after an approval-gated result, while `noToolCalls()` ends an ordinary text response instead of running to `maximumSteps`. The pending descriptor travels to the browser as tool activity. Approval or denial resolves that one call, replaces its existing `action_required` result, and starts a fresh run from the updated browser-owned history.

The server never trusts a client-edited approval descriptor. `/api/chat/resume` validates its shape and lets `toolbox.resumeApproval()` verify the signature before execution. Signature validity is necessary but not sufficient: the host atomically consumes each signed approval capability before the tool side effect begins. A second submission of the same capability returns the already-recorded outcome or a deterministic consumed-capability response; it never calls `resumeApproval()` again. The deployable stateless-host contract therefore includes a shared consumed-capability ledger keyed by the signed descriptor's stable identity. A process-local ledger is acceptable only for the documented local-development limitation and must not be presented as replay protection across restarts or server instances. `armorer@0.14.0` supplies signature verification through `Toolbox.resumeApproval()`; the atomic consumption ledger and its idempotency behavior are Chatroom host responsibilities.

Every tool that can create a non-reversible external side effect must use that approval-and-consumption path. A tool may execute without approval only when it is read-only, safely replayable, or protected by a host-owned idempotency key that is claimed atomically before the effect and reused across retries of the same user intent. A fresh model-generated `toolCallId` is not sufficient because a retry may generate a different call for the same action. The canonical exemplar keeps this boundary simple: replay-unsafe tools require approval, while ordinary tools are replay-safe. A lost `tool.settled` or `run.completed` frame may therefore lose display progress, but a user retry cannot repeat an untracked external effect.

<a id="stream-wire-contract"></a>

## Stream wire contract

The streaming response uses UTF-8 NDJSON with `Content-Type: application/x-ndjson; charset=utf-8`. Every frame is one complete JSON object followed by `\n`; a JSON object never spans lines. The route explicitly projects public event data into JSON-safe values rather than calling `JSON.stringify()` on an `Event` instance and hoping its fields are enumerable.

Each frame carries `wireVersion: 1`, a request-local monotonically increasing `sequence`, a `type`, and the event-specific public payload. The table below defines Chatroom's host-owned wire vocabulary. Its `stream:*` names match the public `StreamEvent` union in `@lostgradient/operative@0.1.0`; its `tool.*` and `run.*` names match the public `RunEvent` union and exported event classes in `0.1.0`. Those current declarations are the design baseline, not proof that `0.2.0` preserves the same surface.

| Event types                                                                         | Browser responsibility                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stream:text-delta`                                                                 | Append `content` to the active assistant message and call Chat's `pushToken()` with the same delta.                                                                                                        |
| `stream:tool-call-start`, `stream:tool-call-delta`, `stream:tool-call-complete`     | Render tool activity as request-local provisional state; stage the complete JSON-safe call, but do not append it to authoritative conversation history yet.                                                |
| `tool.started`, `tool.progress`, `tool.settled`, `tool.error`, `tool.policy-denied` | Render execution progress. When a result exists, append the staged call and its result as one conversation update keyed by `toolCallId`. A `paused` result may carry a signed pending-approval descriptor. |
| `run.completed`                                                                     | Reconcile the final serialized conversation and terminal `RunResult`, then finalize the assistant placeholder. This is the only successful terminal frame.                                                 |
| `run.error`, `run.tripwire`                                                         | Preserve committed call/result pairs, discard unresolved staged calls and progress, apply the error contract below, cancel the placeholder, and end the turn.                                              |
| `run.aborted`                                                                       | Discard every staged call and unresolved tool mutation from this run, then apply the cancellation contract below without presenting an adapter failure.                                                    |

The exact public baseline types involved are `StreamEvent`, `RunEvent`, and `RunCompletedEvent` from `@lostgradient/operative@0.1.0`. At that version, `withEnhancedStreaming(createAnthropicProviderStream(...), { eventTarget })` supplies the structured `stream:*` events and the `AgentRun` async iterator supplies tool and run lifecycle events. `withStreaming()` alone updates the conversation but does not expose the structured streaming event target required by this wire contract.

Before CHR-5 writes application code, it must verify that the installed `@lostgradient/operative@0.2.0` declarations export those APIs and discriminants or their documented replacements. If the surface changed, this section changes first. Chatroom does not preserve both shapes with a compatibility adapter. The approved `0.2.0` Agent API specification settles the nested `RunCompletedEvent.result` shape but does not settle `StreamEvent`, `withEnhancedStreaming()`, or the tool-event vocabulary.

The published `0.1.0` implementation does not prove the required timing for every event. In particular, CHR-5 requires tool-call events while the provider response is still open. The `0.2.0` registry verification must demonstrate that timing with the real public wrapper. If `stream:tool-call-*` still arrives only after the generate function resolves, that is an upstream blocker, not permission to return to Chatroom's ad hoc `tool_call` frame.

The `0.2.0` contract nests a completed event's terminal data under `result`; the wire follows that shape instead of flattening a second result vocabulary. The route may omit unrelated public events, but it may not rename a selected discriminant or forward internal provider events. Events from the streaming target and the run iterator enter one request-local sequencer before encoding, so their relative order is explicit rather than dependent on two consumers racing to call `controller.enqueue()`.

The enhanced-streaming target must also be request-local. The published `0.1.0` `StreamEvent` union does not carry an `AgentRun` identifier, and `EventTarget` dispatch is broadcast, so a module-scoped target cannot distinguish overlapping requests. Under that baseline, each request constructs its own `TypedEventTarget<StreamEventMap>`, `withEnhancedStreaming(createAnthropicProviderStream(...), { eventTarget })` wrapper, and `RunnableAgent`, while reusing the module-scoped toolbox and immutable agent configuration. If the installed `0.2.0` declarations instead provide a stable public run identifier on every enhanced-streaming event, a shared target is allowed only when the listener filters on that identifier before sequencing. Arrival time, listener registration order, or conversation identity is not sufficient provenance.

Exactly one terminal frame is written when the connection remains available. The server closes the stream immediately after that frame. EOF without a terminal frame is a truncated response and therefore a transport failure, not success. A client cancellation is the exception because the client deliberately stopped reading and cannot receive the terminal abort frame.

<a id="cancellation-contract"></a>

## Cancellation contract

Cancellation is one causal chain:

```text
ChatAdapter.stopGenerating()
  -> AbortController.abort()
  -> fetch signal aborts and the response reader cancels
  -> ReadableStream.cancel()
  -> AgentRun.abort('user cancelled')
  -> AgentRunContext.signal reaches the provider
  -> provider connection closes
```

`AgentRun.abort()` and `[Symbol.dispose]()` are public `@lostgradient/operative@0.2.0` APIs. The route holds the run handle before constructing the response stream, registers the incoming `Request.signal` with the run's one-shot abort-and-dispose path, calls the same path from `ReadableStream.cancel()`, and removes the request listener during cleanup. The request signal is required because a disconnect may abort the request before the client acquires or cancels the response body. Cleanup must be idempotent because provider failure, normal completion, request cancellation, and stream cancellation can race.

A user stop is not an adapter error. The browser finalizes a non-empty partial assistant message, removes an empty placeholder with `cancelStreamingMessage()`, calls Chat's `endStreaming()`, and resolves `stopGenerating()`. It does not mark the user message failed and does not populate the error banner.

Tool-call frames are provisional until a matching result arrives. On cancellation, the adapter discards that request's staged tool calls and progress UI before the next turn can be posted. If an implementation has already mutated `ConversationHistory`, it restores the pre-run snapshot and may then preserve only the non-empty partial assistant text; it must not retain a call without a result or invent a provider-visible aborted result that Operative did not produce. The public `withConversationHistory()` and `ConversationHistoryDraft.appendMessages()` APIs from `conversationalist@0.6.1` commit a paired call and result in one returned history value, while `@lostgradient/chat@0.11.4` `cancelStreamingMessage()` and `endStreaming()` own placeholder cleanup. This keeps the next provider transcript valid even when cancellation races with `stream:tool-call-complete`.

<a id="error-contract"></a>

## Error contract

Errors cross three different boundaries. Keeping them separate prevents a denied tool from looking like a broken network request—or a broken network request from becoming permanent transcript content.

- **Request errors**: malformed JSON or an invalid request body fails before streaming begins with a non-2xx JSON response. No placeholder is committed.
- **Run errors**: provider, generation, output-validation, guardrail, budget, and runtime failures become a terminal `run.error` or `run.tripwire` frame owned by Chatroom's wire contract. Operative's published `RunResult.error` and `RunErrorEvent.error` values are `unknown`; the approved `0.2.0` Agent API specification does not replace them with an `AgentRunError` type. The host therefore owns any safe `kind`, `code`, and `message` envelope. It uses the public `classifyError()` helper from `@lostgradient/operative@0.1.0` for `category` and `retryable` where applicable, after verifying that helper in the installed `0.2.0` declarations. It never serializes an unknown error object or credential-bearing provider response directly.
- **Tool outcomes**: success, denial, and `action_required` are transcript-domain results delivered through `tool.*` events. They update the conversation and tool UI. They are not `onadaptererror` events.

The `ChatAdapter` rejects its active command for transport failures, malformed frames, truncated EOF, or terminal run failures. Every unsuccessful terminal path preserves already-committed call/result pairs but discards request-local staged calls and unresolved progress before a retry can render or post the history. For a client-detected protocol failure while the response remains open—including malformed JSON, an unsupported `wireVersion`, or an invalid `sequence`—the adapter first aborts its fetch controller and cancels the response reader through the same idempotent stop path, so the server's `Request.signal` or `ReadableStream.cancel()` handler reaches `AgentRun.abort()`. It then cancels the streaming placeholder and marks the initiating user message as failed so Chat's Retry affordance remains available. `@lostgradient/chat@0.11.4` then routes the rejection to `onadaptererror`, which owns the persistent page-level alert.

No automatic host retry is added. Retry policy configured explicitly on `createAgent` is part of the agent loop; a user-visible Chat retry is a new adapter command from the unchanged client-owned history.

<a id="guardrails-and-context"></a>

## Guardrails and context

Guardrails and context management are agent-owned `createAgent` configuration in the `0.2.0` contract. CHR-9 may demonstrate `createPromptInjectionDetector()` and `createContextCompactor()`, but it may not move trust decisions or canonical history into the browser. A tripwire follows the terminal error-frame contract. Compaction changes the model-visible projection, not the browser's authoritative transcript, unless a later decision updates this document explicitly.

<a id="lifecycle-and-disposal"></a>

## Lifecycle and disposal

The canonical stateless route owns one `RunnableAgent` and one `AgentRun` per request and disposes the run after completion, error, or cancellation. Module-scoped objects are the immutable agent configuration, provider client or factory, toolbox, and deployable consumed-approval ledger—not an enhanced-streaming target, live run, or request conversation. Development hot-module replacement must not leave a run, provider connection, request listener, or toolbox listener orphaned.

The server-owned session variant has a different lifecycle because the host owns a session store, a durable run engine, checkpoint storage, and workflow-service reconstruction. CHR-12 must document and test that route family's initialization and disposal boundary rather than borrowing the stateless route's lifecycle by implication. The public `@lostgradient/operative@0.2.0` APIs involved are the root session exports named below plus `createRunEngine()`, `createCheckpointStore()`, and `createRunWorkflow()` from the `/durable` export.

<a id="durability-and-recovery"></a>

## Durability and recovery

The canonical path is ephemeral by design: a disconnected or restarted request does not reattach to its old `AgentRun`. The browser keeps only conversation history, not executable run state.

Durable recovery belongs to the conditional server-owned variant. CHR-14 must preserve the distinction between live token streaming and recovered durable execution, which may expose only step-level progress. It must compare Operative's session signaling or elicitation path against the stateless `toolbox.resumeApproval()` path here, then update this section with the evidence-backed preferred consumer story.

<a id="server-owned-session-variant"></a>

## Server-owned session variant

CHR-15 proved the server-owned model with public Operative APIs and no Bureau imports. The root `@lostgradient/operative@0.2.0` session surface is `createSessionStore()`, `createAgentSession()`, `loadAgentSession()`, `saveAgentSession()`, `createSessionHandle()`, and `resumeSession()`. Durable recovery adds `createRunEngine()`, `createCheckpointStore()`, and `createRunWorkflow()` from `@lostgradient/operative@0.2.0/durable`.

Operative deliberately does not own Chatroom's conversation-list index, so the host must maintain the index that maps a user-visible conversation to its session. On restart, the host must reconstruct workflow services through `resolveWorkflowServices`, and it must sweep orphaned `RunRef` records when a durable run can no longer be resumed. [AB-28](https://linear.app/lost-gradient/issue/AB-28) is complete in source but is not published as `0.2.0`; [AB-29](https://linear.app/lost-gradient/issue/AB-29) remains in review, and [AB-30](https://linear.app/lost-gradient/issue/AB-30) remains in backlog. Downstream code must wait for the required registry release rather than importing Bureau internals or recreating those capabilities locally.

CHR-12 through CHR-14 remain a labeled variant until a new decision changes the canonical model. They do not silently replace the browser-owned exemplar, and they do not introduce Bureau as a dependency.

<a id="traceability"></a>

## Downstream traceability

Every implementation issue and pull request must cite these anchors:

| Issue  | Required reference sections                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CHR-3  | [API surface and versioning](#api-surface-and-versioning), [Conversation ownership](#conversation-ownership), [Cancellation contract](#cancellation-contract), [Error contract](#error-contract) |
| CHR-4  | [Dependency provenance](#dependency-provenance), [API surface and versioning](#api-surface-and-versioning)                                                                                       |
| CHR-5  | [Stream wire contract](#stream-wire-contract), [Cancellation contract](#cancellation-contract)                                                                                                   |
| CHR-6  | [Toolbox and approval ownership](#toolbox-and-approval-ownership), [Conversation ownership](#conversation-ownership)                                                                             |
| CHR-7  | [Error contract](#error-contract), [Cancellation contract](#cancellation-contract)                                                                                                               |
| CHR-8  | [API surface and versioning](#api-surface-and-versioning), [Error contract](#error-contract)                                                                                                     |
| CHR-9  | [Guardrails and context](#guardrails-and-context), [Stream wire contract](#stream-wire-contract)                                                                                                 |
| CHR-10 | [API surface and versioning](#api-surface-and-versioning), [Stream wire contract](#stream-wire-contract)                                                                                         |
| CHR-11 | [Dependency provenance](#dependency-provenance), [Credential boundary](#credential-boundary)                                                                                                     |
| CHR-12 | [State model](#state-model), [Lifecycle and disposal](#lifecycle-and-disposal), [Server-owned session variant](#server-owned-session-variant)                                                    |
| CHR-13 | [State model](#state-model), [Conversation ownership](#conversation-ownership), [Server-owned session variant](#server-owned-session-variant)                                                    |
| CHR-14 | [Durability and recovery](#durability-and-recovery), [Toolbox and approval ownership](#toolbox-and-approval-ownership), [Server-owned session variant](#server-owned-session-variant)            |

A reviewer should be able to start with a pull request's linked anchor, identify the owner of every piece of state and authority it changes, and then verify the implementation against the exact installed package declarations. If that path is not obvious, the pull request has introduced a new architecture decision and this document must change first.
