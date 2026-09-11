import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const applicationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every streaming endpoint goes through `chatRunResponse`.
 *
 * `chat-server.test.ts` pins the stream's lifecycle — that a settled run
 * closes cleanly, that a late write is dropped rather than throwing, that an
 * abort disposes the run and removes its listener. Those assertions used to
 * be reachable only through `/api/chat`, because the logic lived in that
 * route. Extracting it into `$lib/chat-run-response` made them faster and
 * shared, and quietly severed the connection: they now exercise the helper,
 * and nothing checks that either endpoint still calls it.
 *
 * The consequence is specific. Swapping `chatRunResponse(...)` in either route
 * for a hand-rolled `new Response(stream)` would leave every cancellation,
 * close, and disposal assertion green while removing those protections from
 * the path that opens a billed provider request — and the first symptom would
 * be a run that keeps streaming, and being billed, after the client hung up.
 *
 * A static check rather than a behavioural one, deliberately: driving abort
 * semantics through both handlers again would re-import the provider, the
 * toolbox, and the session store to re-prove what the helper's own tests
 * already prove. What is missing is the WIRING, and the wiring is a fact about
 * the source. `toolbox-ownership.test.ts` guards the sibling invariant the
 * same way, for the same reason.
 */
const STREAMING_ENDPOINTS = [
	'routes/api/chat/+server.ts',
	'routes/api/server-owned/conversations/[id]/stream/+server.ts'
] as const;

describe('streaming endpoints share one stream lifecycle', () => {
	for (const endpoint of STREAMING_ENDPOINTS) {
		it(`${endpoint} responds through chatRunResponse`, () => {
			const source = readFileSync(resolve(applicationRoot, endpoint), 'utf8');

			// Imported from the shared module, not redefined locally under the
			// same name.
			expect(source).toContain("from '$lib/chat-run-response'");
			expect(source).toContain('chatRunResponse');

			// And it is what the handler RETURNS. A route that imported the
			// helper and then built its own `Response` would satisfy the checks
			// above while bypassing every lifecycle guarantee they stand for.
			expect(source).toMatch(/return\s+chatRunResponse\(/);

			// No hand-rolled streaming response beside it. `new Response(` with a
			// stream is the shape this guard exists to keep out of these two
			// files; `json(...)` for the early 400/404/503 returns is fine and
			// stays.
			expect(source).not.toContain('new Response(');

			// And the REQUEST'S OWN SIGNAL is what it hands over. Returning
			// `chatRunResponse(...)` with a signal that never aborts satisfies
			// every check above while severing the helper's request-abort path —
			// so a client that disconnects cannot stop the run, and the provider
			// keeps going and keeps billing. That is the failure these
			// lifecycle tests exist for, reachable without touching the helper.
			expect(source).toMatch(/signal:\s*request\.signal/);
		});
	}
});
