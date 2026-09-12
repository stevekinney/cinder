# The durability exercise: kill the server mid-run, then ask what survived

This is the procedure CIN-445 asks to be performed and documented, with the state observed at each step. Every command runs from `labs/chat-room`.

## What it demonstrates

That a run interrupted by a process death is classified rather than forgotten. The server-owned variant resolves workflow services as `unavailable` — a run's provider is bound to a request-scoped API key and its writer to one HTTP response's stream controller, and neither exists after a restart — so an interrupted run here is terminally **orphaned**. That is the honest outcome, and the point of the exercise is that the interface says so instead of reporting the benign "nothing to resume" a bare `null` from `recover()` would suggest.

## Why it needs a database

The variant's storage is `MemoryStorage` unless told otherwise. With it, a restart loses the conversation as well as the run, so there is nothing to ask about — the detail route 404s and the exercise has no subject. Set `CHAT_ROOM_SERVER_OWNED_DATABASE` to a file path and the same composition runs over SQLite on disk.

> [!NOTE] Put it in `/tmp`, even though the checkout ignores it
> `*.sqlite` and its WAL siblings are gitignored, so a database left inside the checkout will not be committed by accident. Keep it outside anyway: it is one experiment's scratch state, and a stale one sitting in the lab will quietly answer the next experiment's questions.

## The procedure

Start the provider fixture, so a turn can run without a live API key:

```sh
bun src/routes/streaming-fixture.ts
```

Build, then start the preview server against a database file:

```sh
bun run build
CHAT_ROOM_SERVER_OWNED_DATABASE=/tmp/server-owned-durability.sqlite \
ANTHROPIC_API_KEY=test-key \
ANTHROPIC_BASE_URL=http://127.0.0.1:4599 \
bun run preview -- --port 4791 --strictPort
```

Create a conversation:

```sh
curl -s -X POST http://localhost:4791/api/server-owned/conversations \
  -H 'content-type: application/json' -d '{"title":"Durability exercise"}'
```

```json
{
	"conversation": {
		"id": "session-1-98171819-…",
		"title": "Durability exercise",
		"messageCount": 0
	}
}
```

Ask about recovery before anything has run. **Observed:** the benign answer, which is the truth for a session that has never had a run.

```sh
curl -s http://localhost:4791/api/server-owned/conversations/$ID/recovery
```

```json
{ "kind": "nothing-to-resume", "durability": "on-disk" }
```

Start a turn that parks mid-stream. The `gated` fixture scenario delivers one chunk and then holds the response open, which leaves the run `running` in the store:

```sh
curl -sN -X POST http://localhost:4791/api/server-owned/conversations/$ID/stream \
  -H 'content-type: application/json' \
  -d '{"text":"[fixture gated my-marker]"}'
```

**Observed:** the first half arrives and nothing follows.

```
{"type":"stream:block-start","block":{…,"content":"","complete":false},…}
{"type":"text","text":"Streaming first half. ",…}
{"type":"stream:text-delta","content":"Streaming first half. ",…}
{"type":"stream:block-delta","block":{…,"content":"Streaming first half. ","complete":false},…}
```

Kill the server. `kill -9`, not a graceful stop: a SIGTERM runs the shutdown handler, which drains and marks runs aborted on the way out. A crash is what this exercise is about.

```sh
kill -9 $(lsof -t -iTCP:4791 -sTCP:LISTEN)
```

**Observed:** the process is gone and the database is on disk (`4096 bytes`).

Restart against the **same** database, with the same command as before.

**Observed:** the conversation survived the process. `messageCount` is 0 because the turn never completed — nothing was appended.

```sh
curl -s http://localhost:4791/api/server-owned/conversations/$ID
```

```json
{ "id": "session-1-98171819-…", "title": "Durability exercise", "messageCount": 0, "messages": [] }
```

Ask about recovery. **Observed:** the orphan classification, with the engine's own reason for refusing the resume.

```sh
curl -s http://localhost:4791/api/server-owned/conversations/$ID/recovery
```

```json
{
	"kind": "orphaned",
	"durability": "on-disk",
	"failures": [
		{
			"runId": "session-1-98171819-…:0",
			"reason": "Cannot resume workflow \"session-1-98171819-…:0\": status is \"failed\", expected \"running\" or \"suspended\""
		}
	],
	"note": "Reported once. Operative reconciles a stranded run to terminal as it reports the rejection, so asking again answers \"nothing to resume\"."
}
```

Ask a **second** time. **Observed:** the benign answer.

```json
{ "kind": "nothing-to-resume", "durability": "on-disk" }
```

## The one-shot classification is correct, not a bug

Operative reconciles the stranded `running` reference as part of reporting the rejection — the repair AB-28 shipped. By the second ask nothing is still marked running, so `recover()` has nothing to attempt and answers benignly.

Anyone following this procedure twice would otherwise file that as a defect, so it is in the endpoint's `note` field and in the panel's copy rather than only here.

## In the interface, observed

The same procedure with a browser watching `/server-owned/<id>`, recording the panel's own text at each step.

**On load, before any check** — both regions present and empty. That is the rule `error-live-regions.e2e.ts` enforces: a live region that appears with text already in it is not reliably announced.

```
status:     (empty)
durability: (empty)
```

**After Check, before any run has happened**

```
status:     Nothing to resume. No run was in flight — this session is idle, not lost.
durability: Storage: on disk. A run left in flight is still recorded when the next process starts.
```

**After the restart, on load** — empty again, because the panel asks nothing until asked.

**After the restart, first Check**

```
status:     Orphaned. A re-attach was attempted and every candidate rejected, so this
            run's work is terminally gone.
durability: Storage: on disk. A run left in flight is still recorded when the next process starts.
failures:   session-1-cc723e7d-…:0 — Cannot resume workflow "session-1-cc723e7d-…:0":
            status is "failed", expected "running" or "suspended"
once:       Reported once. Operative reconciles a stranded run to terminal as it reports
            the rejection, so asking again answers "nothing to resume".
```

**After the restart, second Check**

```
status:     Nothing to resume. No run was in flight — this session is idle, not lost.
failures:   (no list rendered)
once:       (no note rendered)
```

> [!WARNING] Kill the server, not its wrapper
> `bun run preview` spawns `vite preview` as a child. Signalling the wrapper leaves the server listening, and what actually happens is the streaming request's client side closing — which aborts the run _cleanly_ and leaves nothing marked running. The exercise then reports "nothing to resume" and looks like the classification failed, when the crash never happened. The first scripted attempt at this made exactly that mistake. Confirm the origin stops answering before treating anything after the kill as evidence.

## What the panel renders

`/server-owned/<id>` carries a **Durable recovery** panel. It names the backing store, so the benign answer is not mistaken for a lost run, and it renders the three outcomes distinctly:

- **nothing to resume** — "No run was in flight — this session is idle, not lost."
- **recovered** — the step-level caveat, with the reason: nothing persisted the tokens that were in flight.
- **orphaned** — the classification, the rejected run ids with their reasons, and the note that the answer is reported once.

The status region is mounted empty before any check runs and carries `role="status"`; the failure region beside it carries `role="alert"` and is registered in `error-live-regions.e2e.ts`, which enforces that rule for every error region in this lab.
