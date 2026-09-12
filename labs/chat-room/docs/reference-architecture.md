# Host responsibilities for an Operative-backed chat route

This document defines the constraints a host application must satisfy when it drives an agent loop on behalf of a browser chat client. It exists next to the code because violating any rule here is a **bug**, not a plan change — a leaked credential, a replayed side effect, an orphaned run, a transcript the provider will reject on the next turn.

It is deliberately not a planning document. It names no package versions, no issue numbers, and no schedule. (`wireVersion` below is a constant of the protocol this document defines, not a dependency version.) What to adopt, when, and in what order is tracked in Linear; `package.json` and `bun.lock` are the only source of truth for what is installed. Anything here that can be settled by reading the lockfile has been removed on purpose, because duplicating that state is what made an earlier version of this file go stale.

Where a rule names an API, confirm it against the installed declarations before relying on it.

<a id="state-model"></a>

## State model

The two route families have different owners and continuation rules. The stop conditions in each route and its browser transport must agree.

### Browser-owned route

For `/api/chat`, the browser owns the authoritative `ConversationHistory`. Each request sends that history to a new, ephemeral `AgentRun`, and `stopAfterAnyToolCall` ends the run after the model step and its tool executions. The chat session controller drives subsequent model steps by posting again after a resolved tool result.

Operative's `maximumSteps` bounds each individual run, so it resets on each request. The controller's `maxContinuationTurns`, which defaults to 5, bounds the number of follow-up requests for a user turn. Both limits matter, but configuring the agent alone does not bound this browser-driven sequence. The stateless contract in the sections below describes this route family.

### Server-owned route

For `/api/server-owned/conversations/[id]/stream`, the session store owns the authoritative conversation. The browser posts the new user text, and one durable Operative run drives the model and tool steps for that turn. This route uses `stopWhen.noToolCalls()` and deliberately omits `stopAfterAnyToolCall`; `maximumSteps` bounds the multi-step run. Approval pauses execution inside the run through elicitation, then the same run continues after the answer.

The browser keeps a rendering mirror of the server conversation. Its controller may invoke the transport after a resolved tool result, but a transport call without a new user message returns an empty stream and makes no HTTP request. It must neither repost the previous user text nor start another model run. The browser's continuation cap therefore does not bound this family's server-side model steps.

Both families emit terminal run frames. The client codec decodes them, but the session controller does not reconcile the final conversation carried by those frames; it still builds its rendering history from text and tool frames. In the server-owned family, loading the route again reads the authoritative session-store history. Multi-step execution is implemented there; terminal-history reconciliation remains separate work.

<a id="conversation-ownership"></a>

## Conversation ownership

In the browser-owned family, the browser creates, renders, and stores `ConversationHistory`, and sends `{ conversation }` to `/api/chat`. The server validates that boundary before passing the value to the run. In the server-owned family, the session store owns history and the browser posts only the new user text; the loaded and streamed browser history is a rendering mirror.

Operative snapshots the input. It must never mutate the object supplied by the request parser, and the browser must never assume its posted object is updated remotely. During a streamed run, wire events extend the browser's copy, and today that is still the whole story — though for a narrower reason than it used to be. The route now emits a terminal frame after the text and tool frames, and the client decodes it; what is missing is that the session controller never reads the conversation it carries. So the browser reconstructs the turn from the streamed frames, and reconciling the serialized final conversation as the authority remains target state.

System instructions belong to the agent definition. The browser-owned route does not append them again when resuming from `{ conversation }`—the posted history already carries the accumulated context. The server-owned route reads its accumulated history through the session handle.

In the browser-owned park-and-resume path, approval resume changes one existing message: the resolved result replaces the earlier `action_required` result by `callId`. Appending a second tool result for the same call is invalid, because it leaves the provider with two results for one tool call.

<a id="credential-boundary"></a>

## Credential boundary

`ANTHROPIC_API_KEY` stays server-side. Provider constructors are called only in server modules. No `.svelte` file, browser bundle, NDJSON frame, transcript message, error message, or log may contain the provider credential or the toolbox approval secret.

The browser may hold a signed pending-approval descriptor. That descriptor is a capability for one represented action — not the signing secret, and not general tool authority.

<a id="toolbox-and-approval-ownership"></a>

## Toolbox and approval ownership

The host creates **one module-scoped `Toolbox`** and passes that exact instance to the agent. Building a fresh toolbox per request breaks `toolbox.resumeApproval(signedApproval)`, because only the instance configured with the signing `approvalSecret` can verify the token.

The secret must stay stable at least as long as an approval descriptor can be resumed, and every server instance that may accept a resume request must use the same secret. A process-random secret is acceptable only as a documented local-development limitation where a restart invalidates pending approvals; it is not the deployable contract.

The browser-owned agent parks by combining a pending-approval stop condition with a no-tool-calls stop condition and `stopAfterAnyToolCall`. The first stops after an approval-gated result; the second ends an ordinary text response instead of running to `maximumSteps`.

The server never trusts a client-edited approval descriptor. The resume route validates its shape and lets the toolbox verify the signature before execution. **Signature validity is necessary but not sufficient**: the host atomically consumes each signed capability before the side effect begins. A second submission returns the already-recorded outcome or a deterministic consumed-capability response — it never calls `resumeApproval()` again. The deployable contract therefore includes a shared consumed-capability ledger keyed by the descriptor's stable identity. A process-local ledger is a local-development limitation and must never be presented as replay protection across restarts or instances. Signature verification comes from the toolbox; the ledger and its idempotency are host responsibilities.

In the browser-owned family, every tool that can cause a non-reversible external effect must use that approval-and-consumption path. The server-owned family uses the elicitation contract below. A tool may run unapproved only when it is read-only, safely replayable, or protected by a host-owned idempotency key claimed atomically before the effect and reused across retries of the same user intent. A fresh model-generated `toolCallId` is not sufficient, because a retry may generate a different call for the same action.

### Two approval paths, and which one a consumer should reach for

Operative supports approval in two places, and the choice is decided by who owns the run rather than by taste.

**Park and resume, through the toolbox.** The tool declares `policy.beforeExecute` answering `needs_approval`; armorer mints a signed descriptor of the call; the run STOPS; the client sends the descriptor back on a later request and `toolbox.resumeApproval()` verifies it before the effect. Everything about the pending decision travels in that token, so the server holds nothing between the two requests — which is what makes it survive a restart, a load balancer, and a client that waits an hour before answering. This is the canonical browser-owned path, and it is the one to reach for by default.

**Elicit, through the loop.** A `beforeToolExecution` hook calls `ctx.elicit(message, schema)`; the host's `onElicitation` callback answers; the run WAITS inside the step rather than stopping. The decision never becomes a token, so nothing has to be signed, verified, or ledgered — and nothing survives the process either. A pending question is pinned to the one server holding the promise.

The trade is not about ergonomics. It is:

|                                 | Park and resume                                          | Elicit in the loop                                                                  |
| ------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Pending state lives             | in a signed token the client holds                       | in the process holding the run                                                      |
| Survives a restart              | yes                                                      | no — the question dies with the run                                                 |
| Survives more than one instance | yes, with a shared consumed-capability ledger            | no                                                                                  |
| Replay protection needed        | yes: signature plus an atomic consumed-capability claim  | no: there is no token to replay                                                     |
| The run, while waiting          | stopped; the client starts the next turn                 | parked mid-step; the client answers out of band                                     |
| A denial                        | a tool result the model sees; the conversation continues | the hook drops the call, Operative seals it with an error result, the run completes |

So: **a stateless route owning no run state should park and resume. A route that already owns the run server-side, where the client cannot restart a turn, should elicit.** The server-owned variant below is the second case, and it is not a preference — the park is unreachable there. A continuation there carries no user turn to send, because the last conversation message on that call is a tool result — so the token would be minted and then have nowhere to go. (The transport answers such a call with an empty stream rather than rejecting it; see the continuation rule below. It used to throw, which was right while the toolbox was empty and became destructive once a tool could succeed.)

Two properties of the elicitation path are worth stating because they are not obvious from the type signatures:

- `ctx.elicit` returns `T | null` and never throws. A denial is `null`, and what it means is the hook's decision. `ElicitationDeniedError` is a different thing — the shape a denial takes when a _tool_ throws on one, reconstructed by the durable run adapter — and it is a run terminal. A hook that filters the call out instead is not.
- **A denied call reports no result of its own, so the host supplies one.** Operative seals the filtered call with an error result in the CONVERSATION — enough that a later replay is not left with a dangling tool call — but dispatches no tool event. The client renders a pending tool row from the `tool_call` frame and resolves it on a result, so without one that row stays pending until another turn or a reload clears it. A gate whose "no" is invisible is worse than no gate.

  So the pump settles it: any call a step leaves without a result gets an `outcome: 'error'` `tool_result` frame, written in the same loop that writes the calls. That placement is the whole trick — a first attempt wrote the frame from the `beforeToolExecution` hook, which runs BEFORE the step's `tool_call` frames reach the wire, so the result described a call the client had not seen and was dropped. The message stays generic (`This call did not run, and reported no result.`) because the pump knows a result is missing but not why.

Two consequences for the run's shape, both of which cost a review round to find:

- **The server-owned family must not stop after a tool call.** `stopAfterAnyToolCall` hands control back to a client that drives the next turn, which is the browser-owned contract. Under elicitation the approval happens mid-step, so stopping there leaves a tool result with no reply after it — and the session controller's continuation attempt then fails the very turn the tool succeeded in. Dropping the condition lets the loop reach a second generate and deliver one complete turn.
- **A continuation request has nothing to fetch, and must not throw.** The controller re-runs the transport whenever a turn ends with every tool call resolved. In this family the server already sent everything, and there is no user text to send on that call anyway, so the transport answers with an empty stream. Throwing there was right while the toolbox was empty and a continuation could only mean a wiring mistake; it became destructive the moment a tool could succeed.

**A multi-step response renders out of order live, and correctly after a reload.** Measured on the approved-note turn:

```
live:   You … | Assistant "Saved that note."  Called 1 tool … remember_note Succeeded
reload: You … | Assistant Called 1 tool … Succeeded | Assistant "Saved that note."
```

The session controller inserts one assistant placeholder before reading any frames, so when a single response carries two model steps the second step's text is written back into a row that already precedes the tool activity. The follow-up reply therefore appears above the note it is replying about, and disagrees with the server's own history.

Delineating assistant steps belongs to the wire and the controller in `@lostgradient/chat`, and is filed there with these measurements. What this route keeps true in the meantime is the persisted order, which a reload renders and which a spec pins.

**Every gated call needs its own decision, and every decision needs to name its call.** A step can carry more than one approval-gated call — the stop condition runs after a step and never constrained that — so the hook elicits per call rather than once. And because `ctx.elicit` carries no call identity, the answer has to: a click that lands after its own run ended would otherwise settle whatever question is pending next. The host's answering endpoint requires the call id it displayed and compares it in the same step that settles.

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

> [!NOTE] The decoder has caught up with this vocabulary
> This note previously said the published client decoded a narrower union and had to be extended first. That extension has landed: `stream-event-codec.ts` accepts the terminal frames above, and the route emits them. What has not landed is any consumer — the decoded `run.completed` is not read by the session controller, so the conversation it carries is discarded.

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

**Why step-level, precisely.** A live turn streams because the process holding the provider connection is re-encoding its deltas. A recovered run is one the engine resumed from a checkpoint: its progress is whatever the workflow writes from there, which advances a step at a time. The tokens that were in flight when the previous process died were never persisted, so there is nothing to replay. That is the reason, and it is about where events come from rather than about the handle's type.

**A recovered run is NOT a `DiagnosticAgentRun`**, contrary to what this section once implied. Checked against the installed declarations: `SessionHandle.recover()` is declared `Promise<AgentRun | null>` and wraps the recovered handle with `createAgentRun`, deliberately — the comment beside the call reads "wrap it as an `AgentRun` so the caller can observe the resumed run normally." `DiagnosticAgentRun` is what `createDiagnosticAgentRun` produces on the paths that resume a run _without_ a trusted live agent definition; the session path has one, because `SessionHandleContext.runOptions` is required.

The difference between the two shapes is smaller than it sounds, and in one place larger:

- `output()` is absent from `AgentRun` at the default `H = false` anyway, so its absence from `DiagnosticAgentRun` is not a distinction a `recover()` caller could ever observe.
- `unwrap()` is the accessor they genuinely differ on. At `H = false` it resolves to `Promise<string>` — plain text, no schema validation — so its presence on a recovered handle is a mild hazard at most.
- `closed()` is the difference with teeth. `DiagnosticAgentRun` downgrades a wrapped `'completed'` to `{ status: 'unresolved', reason: 'unknown-effect' }`, because durability is undeterminable from a recovered wrapper. The session path passes that status through unchanged, so a run recovered through `recover()` can report a durable boundary the wrapper cannot vouch for. Filed upstream against the owning package.

`server-owned-recovery-contract.test.ts` pins each of these at the type level, so a future Operative that narrows `recover()` breaks the build rather than this paragraph.

**Recovery classification is reported once.** `recover()` reconciles a stranded `running` reference as it reports the rejection, so the first ask after a restart answers `orphaned` with its failures and the second answers `nothing-to-resume`. Both are correct. A surface that showed the classification without saying so would look like it lost the answer, so the panel says it.

The kill/restart procedure, its exact commands, and the observed state at each step are in [durability-exercise.md](./durability-exercise.md).

The recovery panel starts collapsed so idle conversations retain a fixed-height chat with its own transcript scroll. When an approval question, recovery status, or failure message is visible, the page may grow and scroll; the chat keeps an `8rem` minimum block size so expanded content cannot consume the transcript and composer. Both layout selectors include failure messages, which may appear when recovery has no success status to show. The short-viewport, long-approval, and failed-recovery browser tests verify those states.

<a id="server-owned-session-variant"></a>

## Server-owned session variant

A labeled, non-canonical route family may own sessions server-side using Operative's public session and durable-run APIs. It is additive: it does not silently replace the browser-owned exemplar, which remains canonical.

Its lifecycle boundary differs from the stateless route's and must be documented and tested on its own terms rather than borrowed by implication, because the host owns a session store, a run engine, checkpoint storage, and workflow-service reconstruction.

The session store owns the conversation-list index. `SessionStore.list()` returns conversation-shaped summaries — id, agent name, message count, timestamps, and metadata — so the host drives that call rather than maintaining a parallel index, which could only drift from the store it copies. Conversation titles live in session metadata for the same reason: a separate title store would be a second thing to keep in step.

Ordering is by `updatedAt`, newest first, and the host states that explicitly rather than inheriting a default. Sessions written inside the same millisecond share a timestamp and fall back to key order, which is deterministic but unrelated to creation order — anything needing creation order carries it rather than inferring it from the list. A caller cannot work around that by supplying its own timestamps: the store owns `updatedAt` and overwrites what it is given.

Reconstructing workflow services on restart, and sweeping orphaned run references that can no longer be resumed, are the host's responsibilities. `handle.recover()` **is** wired up now, behind `POST /api/server-owned/conversations/[id]/recovery` — a POST because asking RECONCILES the stranded run it reports, so the question is one-shot rather than safely repeatable, and its three outcomes are rendered distinctly on the detail route. The variant still supplies a `resolveWorkflowServices` resolver that always answers `status: 'unavailable'`, which remains the honest answer while a run's dependencies are a provider bound to a request-scoped key and a writer bound to one HTTP response: there is nothing to rebuild once that response is gone. So a run this variant recovers is always terminally orphaned, and the endpoint says so rather than reporting the benign "nothing to resume" a bare `null` would suggest. Nothing sweeps orphaned references on a schedule; Operative's own reconciliation of the ref it just rejected is what clears them, one ask at a time.

The backing store is **in-memory by default and SQLite on disk when `CHAT_ROOM_SERVER_OWNED_DATABASE` names a file**. The default is right for a test suite and for a first read; the on-disk branch is what makes the recovery question answerable at all, because nothing else survives a process. `ServerOwnedRuntime.storage` is typed as Weft's `Storage` interface rather than a concrete adapter precisely so this is one line in one file, and the recovery panel names which of the two it is running over — "nothing to resume" is the truth under one and a surprise under the other.

Each target-state claim elsewhere in this document says so at the point it is made rather than relying on a blanket assurance. One such assurance used to live in this section and was false: three sections still described terminal frames as unshipped after they had landed.

This variant must not import Bureau internals or locally recreate capabilities that belong in a published package.
