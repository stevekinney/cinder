# The durability exercise: kill the server mid-run, then ask what survived

This is the procedure CIN-445 asks to be performed and documented, with the state observed at each step. Every command runs from `labs/chat-room`.

## What it demonstrates

That a run interrupted by a process death is classified rather than forgotten. The server-owned variant resolves workflow services as `unavailable` — a run's provider is bound to a request-scoped API key and its writer to one HTTP response's stream controller, and neither exists after a restart — so an interrupted run here is terminally **orphaned**. That is the honest outcome, and the point of the exercise is that the interface says so instead of reporting the benign "nothing to resume" a bare `null` from `recover()` would suggest.

## Why it needs a database

The variant's storage is `MemoryStorage` unless told otherwise. With it, a restart loses the conversation as well as the run, so there is nothing to ask about — the detail route 404s and the exercise has no subject. Set `CHAT_ROOM_SERVER_OWNED_DATABASE` to a file path and the same composition runs over SQLite on disk.

> [!NOTE] Put it in `/tmp`, even though the checkout ignores it
> `*.sqlite` and its WAL siblings are gitignored, so a database left inside the checkout will not be committed by accident. Keep it outside anyway: it is one experiment's scratch state, and a stale one sitting in the lab will quietly answer the next experiment's questions.

## The one dependency this needs, and why it is not installed

`vite preview` and `vite dev` run under **Node, not Bun** — `bun run preview` resolves `vite` through a `#!/usr/bin/env node` shebang — so Weft's runtime-neutral SQLite entry point reaches its Node adapter, which needs the `better-sqlite3` peer.

That package is deliberately **not** a dependency of this lab. Its install script exits 127 in the Playwright container CI runs the browser suite in, so declaring it failed every lane for a package no CI command ever constructs. Nothing in this lab imports it at module load either: Weft loads it inside the adapter's constructor, so the code path type-checks and builds without it, and `bun test` reaches the `bun:sqlite` adapter, which needs nothing installed at all.

So the install is a step of this procedure rather than a line in `package.json`:

```sh
bun add --no-save 'better-sqlite3@^12.8.0'
```

**`--no-save`, and pinned to 12.x.** Both halves were caught by review, and both matter.

Saving is `bun add`'s default, so a plain `-d` writes the package into `devDependencies` and the workspace lockfile — contradicting the paragraph above, and failing the guard test that keeps it out, until the reader repairs both files by hand. `--no-save` installs into `node_modules` and touches neither. Verified: after running it, `git diff` reports no change to `labs/chat-room/package.json` or `bun.lock`, and the adapter still resolves.

The version is pinned because Weft `0.23.1` declares the peer as `better-sqlite3: ^12.8.0`, so an unpinned add installs 13.x and runs the adapter against a major the package does not claim to support. That happens to work; it is luck, not a contract. `12.11.1` is what this procedure was last run against.

Setting `CHAT_ROOM_SERVER_OWNED_DATABASE` without it raises `DurableStorageUnavailableError`, which repeats the install command and this file's path. Remove it again when you are done — a failing `bun install` in a lane is harder to diagnose than a missing package here.

## The procedure

Three of these commands do not return: the fixture, the preview server, and the
parked streaming request. Give each its own terminal, or background it as shown
— following the list top to bottom in one shell stops at the first line.

Start the provider fixture, so a turn can run without a live API key. **Terminal 1:**

```sh
bun src/routes/streaming-fixture.ts
```

Build, then start the preview server against a database file. **Terminal 2:**

```sh
bun run build
CHAT_ROOM_SERVER_OWNED_DATABASE=/tmp/server-owned-durability.sqlite \
ANTHROPIC_API_KEY=test-key \
ANTHROPIC_BASE_URL=http://127.0.0.1:4599 \
bun run preview -- --port 4791 --strictPort
```

Create a conversation. **Terminal 3**, where every `curl` below runs:

```sh
ID=$(curl -s -X POST http://localhost:4791/api/server-owned/conversations \
  -H 'content-type: application/json' -d '{"title":"Durability exercise"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["conversation"]["id"])')
echo "$ID"
```

The only thing this prints is the id — the substitution captures the response and the program projects it down. **Observed:**

```
session-1-a72e39af-4bca-4c1c-8423-17a3f12b9ec8
```

Ask about recovery before anything has run. **A POST, not a GET** — asking reconciles a stranded run, so the question is not safely repeatable and the verb has to say so. **Observed:** the benign answer, which is the truth for a session that has never had a run.

```sh
curl -s -X POST http://localhost:4791/api/server-owned/conversations/$ID/recovery
```

```json
{ "kind": "nothing-to-resume", "durability": "on-disk" }
```

Start a turn that parks mid-stream. The `gated` fixture scenario delivers one chunk and then holds the response open, which leaves the run `running` in the store. **Terminal 3**, and this one stays open until the server is killed:

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
{ "id": "session-1-a72e39af-…", "title": "Durability exercise", "messageCount": 0, "messages": [] }
```

Ask about recovery. The endpoint reports the orphan classification with a client-safe reason. Provider rejection details are withheld from both the response and server logs because they can contain connection strings. The response and log retain the run identifier, which distinguishes the affected runs.

```sh
curl -s -X POST http://localhost:4791/api/server-owned/conversations/$ID/recovery
```

```json
{
	"kind": "orphaned",
	"durability": "on-disk",
	"failures": [
		{
			"runId": "session-1-a72e39af-…:0",
			"reason": "Provider details are withheld."
		}
	],
	"note": "Reported once. Operative reconciles a stranded run to terminal as it reports the rejection, so asking again answers \"nothing to resume\"."
}
```

Ask a **second** time. **Observed:** the benign answer.

```json
{
	"kind": "nothing-to-resume",
	"durability": "on-disk",
	"previouslyOrphaned": ["session-1-a72e39af-…:0"]
}
```

`previouslyOrphaned` is the point of asking twice. The classification itself is available once — reconciliation happens as it is reported — so this field is what lets a second ask, a reloaded page, or a client whose first response never arrived still tell "a run was orphaned and you have been told" from "nothing was ever in flight." A conversation that never had a run reports it empty.

> [!WARNING] Asking consumes the answer
> `POST …/recovery` reconciles the stranded run it reports, so **the first ask is the only one that returns `orphaned`** — and anything that asks counts. While writing this file I lost the classification twice to my own diagnostics: a probe that hit the endpoint before the panel did, and a transcript stitched from two runs because of it. If you are scripting around this, ask once and keep the answer.
>
> Every id below is from one run, `session-1-a72e39af-4bca-4c1c-8423-17a3f12b9ec8`. A transcript with two ids in it is a transcript of two different runs, whatever it claims.

## The one-shot classification is correct, not a bug

Operative reconciles the stranded `running` reference as part of reporting the rejection — the repair AB-28 shipped. By the second ask nothing is still marked running, so `recover()` has nothing to attempt and answers benignly.

Anyone following this procedure twice would otherwise file that as a defect, so it is in the endpoint's `note` field and in the panel's copy rather than only here.

## In the interface, observed

The same procedure with a browser watching `/server-owned/<id>`, recording the panel's own text at each step.

The panel is a disclosure, closed on load. Before the layout fix, expanding it at 844×390 could leave the transcript and composer at 0px. The current layout retains a fixed-height chat while idle, then allows document scrolling and gives the chat an `8rem` minimum block size while an approval question, recovery status, or failure is visible. The short-viewport regression includes a populated recovery failure, so a failed check cannot collapse the transcript. Status and error regions remain mounted whether the disclosure is open or closed; opening it reveals the check control.

**On load, before any check** — both regions present and empty. That is the rule `error-live-regions.e2e.ts` enforces: a live region that appears with text already in it is not reliably announced.

```
status:     (empty)
durability: (empty)
```

**After Check, before any run has happened**

```
status:     Nothing is currently resumable. No run is in flight for this session.
            Storage is on disk, so a run left in flight is recorded for the next process.
durability: Storage: on disk.
```

The storage sentence is inside the announcement, not only in the paragraph beside it. A screen reader hearing "nothing is currently resumable" without it would not learn whether this process could have observed a previous run at all.

**After the restart, on load** — empty again, because the panel asks nothing until asked.

**After the restart, first Check** — the disclosure has to be opened first; a reload closes it.

```
status:     Orphaned. A re-attach was attempted and every candidate rejected, so this
            run's work is terminally gone. Storage is on disk, so a run left in flight
            is recorded for the next process.
failures:   session-1-a72e39af-…:0 — Provider details are withheld.
once:       Reported once. Operative reconciles a stranded run to terminal as it reports
            the rejection, so asking again answers "nothing to resume".
```

The run identifier remains available in the browser and server log. Provider details are withheld in both places.

**After the restart, second Check**

```
status:     Nothing is currently resumable. The orphaned run reported earlier is already
            reconciled; this is what a second check answers, not a claim that nothing
            was lost. Storage is on disk, so a run left in flight is recorded for the
            next process.
failures:   (no list rendered)
once:       (no note rendered)
```

Deliberately not "no run was in flight". One was, and its work was lost — saying otherwise here would make the panel contradict the step above it.

> [!WARNING] Kill the server, not its wrapper
> `bun run preview` spawns `vite preview` as a child. Signalling the wrapper leaves the server listening, and what actually happens is the streaming request's client side closing — which aborts the run _cleanly_ and leaves nothing marked running. The exercise then reports "nothing to resume" and looks like the classification failed, when the crash never happened. The first scripted attempt at this made exactly that mistake. Confirm the origin stops answering before treating anything after the kill as evidence.

## What the panel renders

`/server-owned/<id>` carries a **Durable recovery** panel. It names the backing store, so the benign answer is not mistaken for a lost run, and it renders the three outcomes distinctly:

- **nothing currently resumable** — and which of two things that means. Before any run: "No run is in flight for this session." After an orphan has been reported and reconciled: "The orphaned run reported earlier is already reconciled." The wording deliberately avoids "no run was in flight", which would be a false historical claim in exactly the two-check sequence above.
- **recovered** — the step-level caveat, with the reason: nothing persisted the tokens that were in flight.
- **orphaned** — the classification, the rejected run ids with a client-safe reason, and the note that the answer is reported once.

Each of the three carries the backing store in the same sentence, so the outcome is never announced without the qualifier that gives it meaning.

The status region is mounted empty before any check runs and carries `role="status"`; the failure region beside it carries `role="alert"` and is registered in `error-live-regions.e2e.ts`, which enforces that rule for every error region in this lab.
