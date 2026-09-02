# Host responsibilities for an Operative-backed chat route

This document defines the constraints a host application must satisfy when it drives an agent loop on behalf of a browser chat client. It exists next to the code because violating any rule here is a **bug**, not a plan change — a leaked credential, a replayed side effect, an orphaned run, a transcript the provider will reject on the next turn.

It is deliberately not a planning document. It names no package versions, no issue numbers, and no schedule. (`wireVersion` below is a constant of the protocol this document defines, not a dependency version.) What to adopt, when, and in what order is tracked in Linear; `package.json` and `bun.lock` are the only source of truth for what is installed. Anything here that can be settled by reading the lockfile has been removed on purpose, because duplicating that state is what made an earlier version of this file go stale.

Where a rule names an API, confirm it against the installed declarations before relying on it.

<a id="state-model"></a>

## State model

Two owners, on purpose:

- The browser owns the authoritative `ConversationHistory` value it renders.
- The server owns an ephemeral `AgentRun` for exactly one HTTP request, plus all authority needed to execute it.

Operative owns the limits _within_ a run: `createAgent({ maximumSteps, stopWhen, ... })` decides when one `AgentRun` stops. Because the route ends each run after a tool call (see below), that per-run limit resets on every request, so it does not bound the turn. The published chat session controller does: it defaults `maxContinuationTurns` to 5, re-POSTs at most that many times for one user turn, and fails the turn when the limit is reached. Today the browser cap is therefore the effective turn-wide bound, and a host configuring loop limits must set it on the controller rather than on the agent alone. That is a consequence of the current continuation regime, not the target: once Operative drives continuation inside a single request, `maximumSteps` becomes the turn-wide bound and the client cap becomes redundant.

Who drives continuation _between_ tool results is a different question, and the honest answer today is the browser. The published chat session controller re-POSTs whenever it observes a resolved, non-approval tool result, so a host that also let Operative continue within the same request would produce two continuations for one tool call. The route therefore stops after any tool call, and the client's existing loop carries the turn forward.

So today a request contains **one** model step, plus the tool executions that step triggered. The stateless claim below is about server persistence, not about execution: a new request always starts a new run from the full client-owned history, and the server keeps nothing between them.

Reconciliation of the authoritative post-run history is part of the target state rather than current behaviour. It requires a terminal run frame carrying that history, which the wire vocabulary does not yet include — the browser reconstructs the turn from the frames it receives instead.

That target is Operative owning multi-step continuation inside a single request, with a terminal frame closing it. Reaching it requires the client controller to stop re-POSTing first. Until that lands, a host MUST match whichever side actually drives the loop rather than assuming this document's end state, and the stop condition in the route is the authority on which regime is in force.

<a id="conversation-ownership"></a>

## Conversation ownership

The browser creates, renders, and stores `ConversationHistory`, and sends `{ conversation }` to the chat route. The server validates that boundary before passing the value to the run.

Operative snapshots the input. It must never mutate the object supplied by the request parser, and the browser must never assume its posted object is updated remotely. During a streamed run, wire events extend the browser's copy, and today that is the whole story: the route emits only text and tool frames followed by EOF, so the browser reconstructs the turn from those frames. Reconciling a serialized final conversation as the authority for the turn is target state only — it needs the terminal run frame described above, which the wire vocabulary does not yet carry.

System instructions belong to the module-scoped agent definition. They are not appended again when resuming from `{ conversation }` — the posted history already carries the accumulated context.

Approval resume changes one **existing** message: the resolved result replaces the earlier `action_required` result by `callId`. Appending a second tool result for the same call is invalid, because it leaves the provider with two results for one tool call.

<a id="credential-boundary"></a>

## Credential boundary

`ANTHROPIC_API_KEY` stays server-side. Provider constructors are called only in server modules. No `.svelte` file, browser bundle, NDJSON frame, transcript message, error message, or log may contain the provider credential or the toolbox approval secret.

The browser may hold a signed pending-approval descriptor. That descriptor is a capability for one represented action — not the signing secret, and not general tool authority.

<a id="toolbox-and-approval-ownership"></a>

## Toolbox and approval ownership

The host creates **one module-scoped `Toolbox`** and passes that exact instance to the agent. Building a fresh toolbox per request breaks `toolbox.resumeApproval(signedApproval)`, because only the instance configured with the signing `approvalSecret` can verify the token.

The secret must stay stable at least as long as an approval descriptor can be resumed, and every server instance that may accept a resume request must use the same secret. A process-random secret is acceptable only as a documented local-development limitation where a restart invalidates pending approvals; it is not the deployable contract.

The agent parks by combining a pending-approval stop condition with a no-tool-calls stop condition. The first stops after an approval-gated result; the second ends an ordinary text response instead of running to `maximumSteps`.

The server never trusts a client-edited approval descriptor. The resume route validates its shape and lets the toolbox verify the signature before execution. **Signature validity is necessary but not sufficient**: the host atomically consumes each signed capability before the side effect begins. A second submission returns the already-recorded outcome or a deterministic consumed-capability response — it never calls `resumeApproval()` again. The deployable contract therefore includes a shared consumed-capability ledger keyed by the descriptor's stable identity. A process-local ledger is a local-development limitation and must never be presented as replay protection across restarts or instances. Signature verification comes from the toolbox; the ledger and its idempotency are host responsibilities.

Every tool that can cause a non-reversible external effect must use that approval-and-consumption path. A tool may run unapproved only when it is read-only, safely replayable, or protected by a host-owned idempotency key claimed atomically before the effect and reused across retries of the same user intent. A fresh model-generated `toolCallId` is not sufficient, because a retry may generate a different call for the same action.

<a id="stream-wire-contract"></a>

## Stream wire contract

UTF-8 NDJSON, `Content-Type: application/x-ndjson; charset=utf-8`. Every frame is one complete JSON object followed by `\n`; an object never spans lines. The route projects event data into JSON-safe values explicitly rather than calling `JSON.stringify()` on an `Event` instance and hoping its fields are enumerable.

Each frame carries `wireVersion: 1`, a request-local monotonically increasing `sequence`, a `type`, and the event-specific payload.

| Event types                                                                         | Browser responsibility                                                                                                                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stream:text-delta`                                                                 | Append `content` to the active assistant message and push the same delta as a token.                                                                                |
| `stream:tool-call-start`, `stream:tool-call-delta`, `stream:tool-call-complete`     | Render tool activity as request-local provisional state; stage the complete call, but do not append it to authoritative history yet.                                |
| `tool.started`, `tool.progress`, `tool.settled`, `tool.error`, `tool.policy-denied` | Render execution progress. Once a result exists, append the staged call and its result as one update keyed by `toolCallId`. A paused result may carry a descriptor. |
| `run.completed`                                                                     | Reconcile the final conversation and terminal result, then finalize the placeholder. The only successful terminal frame.                                            |
| `run.error`, `run.tripwire`                                                         | Preserve committed call/result pairs, discard unresolved staged calls, apply the error contract, cancel the placeholder, end the turn.                              |
| `run.aborted`                                                                       | Discard every staged call and unresolved mutation from this run, then apply the cancellation contract without presenting an adapter failure.                        |

Events from the streaming target and the run iterator enter **one request-local sequencer** before encoding, so their relative order is explicit rather than dependent on two consumers racing to call `controller.enqueue()`.

The enhanced-streaming event target must also be **request-local**. `EventTarget` dispatch is broadcast, so a module-scoped target cannot distinguish overlapping requests unless every event carries a stable public run identifier and the listener filters on it before sequencing. Arrival time, listener registration order, and conversation identity are not sufficient provenance.

Exactly one terminal frame is written when the connection remains available, and the server closes the stream immediately after it. EOF without a terminal frame is a truncated response — a transport failure, not success. Client cancellation is the exception, because the client deliberately stopped reading and cannot receive the terminal frame.

> [!NOTE] This vocabulary is wider than the client decoder currently accepts
> The published chat client decodes a narrower union and throws on anything outside it, so the decoder must be extended before this table can be emitted. The decoder grows to meet this contract rather than this contract narrowing to fit the decoder.

<a id="cancellation-contract"></a>

## Cancellation contract

One causal chain:

```text
ChatAdapter.stopGenerating()
  -> AbortController.abort()
  -> fetch signal aborts and the response reader cancels
  -> ReadableStream.cancel()
  -> AgentRun.abort('user cancelled')
  -> run context signal reaches the provider
  -> provider connection closes
```

The route holds the run handle before constructing the response stream, registers the incoming `Request.signal` with the run's one-shot abort-and-dispose path, calls that same path from `ReadableStream.cancel()`, and removes the request listener during cleanup. The request signal is required because a disconnect may abort the request before the client acquires or cancels the response body. **Cleanup must be idempotent**, because provider failure, normal completion, request cancellation, and stream cancellation can race.

A user stop is not an adapter error. The browser finalizes a non-empty partial assistant message, removes an empty placeholder, ends streaming, and resolves `stopGenerating()`. It does not mark the user message failed and does not populate the error banner.

Tool-call frames are provisional until a matching result arrives. On cancellation the adapter discards that request's staged calls and progress UI before the next turn can be posted. If history was already mutated, it restores the pre-run snapshot and may preserve only the non-empty partial assistant text. It must not retain a call without a result, and must not invent a provider-visible aborted result that Operative never produced — either would make the next provider transcript invalid.

<a id="error-contract"></a>

## Error contract

Three boundaries, kept separate so a denied tool never looks like a broken network request, and a broken network request never becomes permanent transcript content.

- **Request errors**: malformed JSON or an invalid body fails before streaming begins, with a non-2xx JSON response. No placeholder is committed.
- **Run errors**: provider, generation, output-validation, guardrail, budget, and runtime failures become a terminal `run.error` or `run.tripwire` frame. Operative types these two paths differently, and the host must not treat them alike. The run **event** classes carry a typed `AgentRunError` with `kind` and `code`, and ship a JSON-safe serializer for it — use that rather than inventing a parallel envelope. The terminal **result**, by contrast, still declares its error as `unknown`, so anything read from there must be narrowed by the host, for which a published classification helper exists. Under either path the host decides which fields cross to the browser: it never serializes an unknown error object, and never forwards an error's `cause` unfiltered, since `cause` is untyped and may carry a credential-bearing provider payload.
- **Tool outcomes**: success, denial, and `action_required` are transcript-domain results delivered through `tool.*` events. They update the conversation and tool UI. They are not adapter errors.

The adapter rejects its active command for transport failures, malformed frames, truncated EOF, or terminal run failures. Every unsuccessful terminal path preserves committed call/result pairs but discards request-local staged calls before a retry can render or post the history.

For a client-detected protocol failure while the response is still open — malformed JSON, an unsupported `wireVersion`, an invalid `sequence` — the adapter **first** aborts its fetch controller and cancels the reader through the same idempotent stop path, so the server reaches `AgentRun.abort()`. Only then does it cancel the placeholder and mark the initiating user message failed, so the Retry affordance stays available.

No automatic host retry is added. Retry policy configured on the agent is part of the loop; a user-visible retry is a new adapter command from unchanged client-owned history.

<a id="guardrails-and-context"></a>

## Guardrails and context

Guardrails and context management are agent-owned configuration. They may not move trust decisions or canonical history into the browser. A tripwire follows the terminal error-frame contract. Compaction changes the **model-visible projection**, never the browser's authoritative transcript.

<a id="lifecycle-and-disposal"></a>

## Lifecycle and disposal

The stateless route owns one agent and one run per request, and disposes the run after completion, error, or cancellation.

Module-scoped: immutable agent configuration, provider client or factory, toolbox, consumed-approval ledger. **Not** module-scoped: enhanced-streaming targets, live runs, request conversations.

Development hot-module replacement must not leave a run, provider connection, request listener, or toolbox listener orphaned.

<a id="durability-and-recovery"></a>

## Durability and recovery

The canonical path is ephemeral by design: a disconnected or restarted request does not reattach to its old run. The browser keeps conversation history, never executable run state.

Durable recovery belongs to the server-owned variant below, which must preserve the distinction between live token streaming and recovered execution — the latter may expose only step-level progress. A failed re-attach must be distinguishable in the UI from a benign "nothing to resume".

<a id="server-owned-session-variant"></a>

## Server-owned session variant

A labeled, non-canonical route family may own sessions server-side using Operative's public session and durable-run APIs. It is additive: it does not silently replace the browser-owned exemplar, which remains canonical.

Its lifecycle boundary differs from the stateless route's and must be documented and tested on its own terms rather than borrowed by implication, because the host owns a session store, a run engine, checkpoint storage, and workflow-service reconstruction.

Operative does not own the conversation-list index, so the host maintains the mapping from a user-visible conversation to its session, reconstructs workflow services on restart, and sweeps orphaned run references that can no longer be resumed.

This variant must not import Bureau internals or locally recreate capabilities that belong in a published package.
