/**
 * A stand-in for the **Anthropic Messages API** — not for `/api/chat`.
 *
 * ROADMAP HS-1 needs `+page.svelte`'s `fetch('/api/chat')` → `getReader()` →
 * per-line `pushToken` loop to see a body arrive in more than one piece, and
 * HS-2 needs a genuinely HMAC-signed `approvalToken` minted by the running
 * server's own toolbox. Both fall out of the same fixture, because both are
 * downstream of what the model returns.
 *
 * WHY THE UPSTREAM AND NOT THE ROUTE. Playwright's `Route` has no incremental
 * write handle: `fulfill` takes a complete `body`, and `route.fetch()` returns
 * an already-buffered `APIResponse`. Any test that mocks `/api/chat` therefore
 * delivers exactly one chunk, no matter how it is written — which is why the
 * four original tests in `page.svelte.e2e.ts` cannot cover progressive
 * rendering even in principle. Standing in one layer further out leaves the
 * entire production path unmocked: the real SvelteKit endpoint, the real
 * Anthropic SDK stream, the real per-`text`-event ndjson re-encode, the real
 * `toolbox.execute` (so the real approval signature), and the real browser
 * `ReadableStream` read. The app reaches this file only because
 * `new Anthropic({ apiKey })` leaves `baseURL` to `readEnv('ANTHROPIC_BASE_URL')`
 * at construction time, so pointing the preview server's environment here
 * changes no application code at all.
 *
 * WHY GATES, NOT DELAYS. A fixture that spaces chunks by `setTimeout(200)` and
 * a test that waits 100ms are the same guess wearing different hats, and this
 * repo treats that guess as a defect. Instead the second chunk does not exist
 * until the test asks for it: the fixture writes chunk one, then blocks on a
 * gate until `POST /__fixture/release?marker=…` arrives. "The partial text is
 * on screen while the response is still open" stops being a timing claim and
 * becomes a causal one.
 *
 * WHY `playwright.config.ts` OWNS THE PROCESS. `page.svelte.e2e.ts` runs in
 * three browser engines, including Playwright's bounded WebKit project shards. A
 * server started from the spec would be started once per worker and every copy
 * after the first would fail to bind. It runs as a `webServer` entry instead —
 * one process for the whole run — and every piece of per-test state below is
 * keyed by a marker the test generates, so the concurrent engines cannot see
 * each other's gates or counters.
 *
 * Run directly (`bun src/routes/streaming-fixture.ts`) to listen; importing it
 * only reads the shared constants, which is what the spec does.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';

/**
 * Fixed, and deliberately not one of the ports the rest of the suite uses
 * (4173 preview, 5175 dev). `playwright.config.ts` has to name the same number
 * in two places — the `webServer` entry that starts this file and the
 * `ANTHROPIC_BASE_URL` handed to the preview server — so it lives here rather
 * than being spelled twice in the config.
 */
export const FIXTURE_PORT = 4599;

export const FIXTURE_ORIGIN = `http://127.0.0.1:${FIXTURE_PORT}`;

/**
 * `gated` — one text chunk, then wait for the test to release the second.
 * `hold` — one text chunk, then hold the response open until the client goes
 *   away, which is the only way to have partial content already buffered when
 *   a user-initiated abort lands.
 * `approval` — a `remember_note` tool call on the first turn (the toolbox's
 *   only tool with an approval policy), plain text on every turn after it.
 */
export type FixtureScenario = 'gated' | 'hold' | 'approval';

export const GATED_FIRST_CHUNK = 'Streaming first half.';
export const GATED_SECOND_CHUNK = 'Streaming second half.';
export const HOLD_PARTIAL_TEXT = 'Partial answer before the stop.';
export const APPROVAL_NOTE_TEXT = 'Ship the release notes';
export const APPROVAL_FOLLOW_UP_TEXT = 'Saved that note.';
export const DEFAULT_REPLY_TEXT = 'Fixture default reply.';

/**
 * The scenario selector, embedded in the user's message.
 *
 * It travels to the fixture inside the conversation the app POSTs to
 * `/api/chat`, so the fixture can read it back out of the request body without
 * any side channel — and, because the app re-sends the whole transcript, it is
 * still there on the follow-up turn after an approval.
 */
export function fixtureMarker(scenario: FixtureScenario, marker: string): string {
	return `[fixture ${scenario} ${marker}]`;
}

const MARKER_PATTERN = /\[fixture (gated|hold|approval) ([A-Za-z0-9-]+)\]/;

/** How many `/v1/messages` requests each marker has produced. */
const requestCounts = new Map<string, number>();

/** Markers whose response is currently parked mid-stream, and how to resume it. */
const heldGates = new Map<string, () => void>();

/**
 * Releases that arrived before the request they belong to. The spec never
 * intends to hit this — it releases only after seeing the first chunk rendered,
 * by which time the gate is registered — but recording it means a mis-sequenced
 * test fails on its `released` assertion instead of hanging until timeout.
 */
const earlyReleases = new Set<string>();

function jsonResponse(res: ServerResponse, status: number, payload: unknown): void {
	const body = JSON.stringify(payload);
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Content-Length': Buffer.byteLength(body)
	});
	res.end(body);
}

/**
 * Every write goes through here because a scenario can be parked on a gate when
 * the browser aborts: SvelteKit cancels its ndjson stream, the SDK aborts this
 * request, and the socket is gone before the resumed code writes again. Writing
 * to a dead socket throws inside an async continuation with nothing to catch
 * it, which would take the whole fixture process — and therefore every later
 * test in the run — down with it.
 */
function write(res: ServerResponse, chunk: string): boolean {
	if (res.writableEnded || res.destroyed) return false;
	res.write(chunk);
	return true;
}

function sse(res: ServerResponse, event: string, data: unknown): boolean {
	return write(res, `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function beginMessage(res: ServerResponse): void {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream; charset=utf-8',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive'
	});
	sse(res, 'message_start', {
		type: 'message_start',
		message: {
			id: 'msg_streaming_fixture',
			type: 'message',
			role: 'assistant',
			model: 'claude-sonnet-5',
			content: [],
			stop_reason: null,
			stop_sequence: null,
			usage: { input_tokens: 1, output_tokens: 1 }
		}
	});
}

function endMessage(res: ServerResponse, stopReason: 'end_turn' | 'tool_use'): void {
	sse(res, 'message_delta', {
		type: 'message_delta',
		delta: { stop_reason: stopReason, stop_sequence: null },
		usage: { output_tokens: 1 }
	});
	sse(res, 'message_stop', { type: 'message_stop' });
	if (!res.writableEnded && !res.destroyed) res.end();
}

function textBlock(res: ServerResponse, chunks: readonly string[]): void {
	sse(res, 'content_block_start', {
		type: 'content_block_start',
		index: 0,
		content_block: { type: 'text', text: '' }
	});
	for (const text of chunks) {
		sse(res, 'content_block_delta', {
			type: 'content_block_delta',
			index: 0,
			delta: { type: 'text_delta', text }
		});
	}
	sse(res, 'content_block_stop', { type: 'content_block_stop', index: 0 });
}

/**
 * Parks the response until the test releases this marker or the client hangs
 * up. The gate is registered synchronously, in the same tick as the write that
 * precedes it, so a release that follows an observation of that write can never
 * arrive too early.
 */
function gate(marker: string, res: ServerResponse): Promise<'released' | 'disconnected'> {
	if (earlyReleases.delete(marker)) return Promise.resolve('released');

	return new Promise((resolve) => {
		let settled = false;

		const onClose = () => {
			if (settled) return;
			settled = true;
			heldGates.delete(marker);
			resolve('disconnected');
		};

		heldGates.set(marker, () => {
			if (settled) return;
			settled = true;
			res.off('close', onClose);
			resolve('released');
		});

		res.on('close', onClose);
	});
}

async function respondToMessages(res: ServerResponse, body: string): Promise<void> {
	const match = MARKER_PATTERN.exec(body);
	const scenario = match?.[1] as FixtureScenario | undefined;
	const marker = match?.[2] ?? '';
	const attempt = (requestCounts.get(marker) ?? 0) + 1;
	if (marker) requestCounts.set(marker, attempt);

	beginMessage(res);

	// The turn AFTER an approval carries the same marker (the app re-sends the
	// whole transcript), so the turn number — not the prompt — decides what the
	// approval scenario returns. Discriminating on the presence of a
	// `tool_result` block would work too, but it would silently loop back into
	// another approval if conversationalist ever changed how it lowers one.
	if (scenario === 'approval' && attempt === 1) {
		sse(res, 'content_block_start', {
			type: 'content_block_start',
			index: 0,
			content_block: {
				type: 'tool_use',
				id: `toolu_${marker}`,
				name: 'remember_note',
				input: {}
			}
		});
		sse(res, 'content_block_delta', {
			type: 'content_block_delta',
			index: 0,
			delta: {
				type: 'input_json_delta',
				partial_json: JSON.stringify({ text: APPROVAL_NOTE_TEXT })
			}
		});
		sse(res, 'content_block_stop', { type: 'content_block_stop', index: 0 });
		endMessage(res, 'tool_use');
		return;
	}

	if (scenario === 'gated') {
		sse(res, 'content_block_start', {
			type: 'content_block_start',
			index: 0,
			content_block: { type: 'text', text: '' }
		});
		sse(res, 'content_block_delta', {
			type: 'content_block_delta',
			index: 0,
			delta: { type: 'text_delta', text: `${GATED_FIRST_CHUNK} ` }
		});

		if ((await gate(marker, res)) === 'disconnected') return;

		sse(res, 'content_block_delta', {
			type: 'content_block_delta',
			index: 0,
			delta: { type: 'text_delta', text: GATED_SECOND_CHUNK }
		});
		sse(res, 'content_block_stop', { type: 'content_block_stop', index: 0 });
		endMessage(res, 'end_turn');
		return;
	}

	if (scenario === 'hold') {
		sse(res, 'content_block_start', {
			type: 'content_block_start',
			index: 0,
			content_block: { type: 'text', text: '' }
		});
		sse(res, 'content_block_delta', {
			type: 'content_block_delta',
			index: 0,
			delta: { type: 'text_delta', text: HOLD_PARTIAL_TEXT }
		});
		// Never released, never completed: the client's abort is what ends it.
		// `gate` resolves on the socket close that abort produces, so nothing
		// is left waiting on a promise that can no longer settle.
		await gate(marker, res);
		return;
	}

	textBlock(res, [scenario === 'approval' ? APPROVAL_FOLLOW_UP_TEXT : DEFAULT_REPLY_TEXT]);
	endMessage(res, 'end_turn');
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = '';
		req.setEncoding('utf8');
		req.on('data', (chunk: string) => {
			body += chunk;
		});
		req.on('end', () => resolve(body));
		req.on('error', reject);
	});
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
	const url = new URL(req.url ?? '/', FIXTURE_ORIGIN);
	const marker = url.searchParams.get('marker') ?? '';

	if (url.pathname === '/__fixture/health' || url.pathname === '/') {
		jsonResponse(res, 200, { ok: true });
		return;
	}

	// `released: true` is the assertion that matters to the spec: it says a
	// response really was parked mid-stream at the moment the test asked for
	// the rest of it. `false` means the request never arrived or had already
	// finished, which is a failed test rather than a slow one.
	if (url.pathname === '/__fixture/release') {
		const resume = heldGates.get(marker);
		if (resume) {
			heldGates.delete(marker);
			resume();
			jsonResponse(res, 200, { released: true });
			return;
		}
		earlyReleases.add(marker);
		jsonResponse(res, 200, { released: false });
		return;
	}

	if (url.pathname === '/__fixture/requests') {
		jsonResponse(res, 200, { count: requestCounts.get(marker) ?? 0 });
		return;
	}

	if (req.method === 'POST' && url.pathname === '/v1/messages') {
		await respondToMessages(res, await readBody(req));
		return;
	}

	jsonResponse(res, 404, { error: `Unhandled ${req.method} ${url.pathname}` });
}

export function createStreamingFixture(): Server {
	return createServer((req, res) => {
		void handle(req, res).catch((cause: unknown) => {
			// A throw here would otherwise be an unhandled rejection, and an
			// unhandled rejection takes the process down under Node's default
			// policy — turning one bad request into a suite-wide outage.
			if (!res.headersSent) jsonResponse(res, 500, { error: String(cause) });
			else if (!res.writableEnded) res.end();
		});
	});
}

/**
 * Only when run as a program. The spec imports this module for the constants
 * above, and an import that also bound a port would fail in every Playwright
 * worker after the first.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	createStreamingFixture().listen(FIXTURE_PORT, '127.0.0.1', () => {
		console.log(`streaming fixture listening on ${FIXTURE_ORIGIN}`);
	});
}
