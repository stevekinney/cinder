import { defineConfig } from '@playwright/test';

// ROADMAP HS-3: the specs that run in WebKit and Firefox as well as Chromium.
//
// Scoped rather than blanket, per the acceptance criterion, to the two categories
// this project already knows diverge across engines:
//
//   - FOCUS / A11Y. WebKit's focus-on-click and blur-on-removal semantics differ
//     from Chromium's, and every "confirmed in a real browser" claim this repo
//     has made about focus was confirmed in exactly one engine.
//   - STREAMING / FETCH. `ReadableStream` backpressure and chunk-delivery timing
//     have known WebKit quirks. `page.svelte.e2e.ts` and `approval-flow.e2e.ts`
//     drive a real network read (`fetch` → `getReader()`); the rest listed here
//     drive in-page adapters,
//     so they exercise JS timing rather than engine fetch behavior — included
//     because the abort/interleave paths are still engine-observable, not because
//     they touch the network.
//
// Every glob must end in `.e2e.ts`: a project's `testMatch` REPLACES the root
// one rather than intersecting with it, so a bare directory glob here would pull
// in non-spec files and miss specs.
//
// Clipboard-only cases inside `conversation-list.e2e.ts` and `utilities.e2e.ts`
// create their own permission-bearing contexts and skip outside Chromium.
// Firefox maps neither clipboard permission and WebKit maps `clipboard-read`
// but not `clipboard-write`; keeping those grants out of the default fixture
// lets every engine run the remaining focus and accessibility coverage.
const CROSS_ENGINE_SHARDS = [
	[
		'**/adapter-push.e2e.ts',
		'**/assistant-metadata.e2e.ts',
		'**/chat-token-registration.e2e.ts',
		'**/composer-popover.e2e.ts',
		'**/conversation-list.e2e.ts',
		'**/diff-viewer.e2e.ts',
		'**/interleaving.e2e.ts',
		// A real fetch/ReadableStream path, which is precisely what these
		// cross-engine shards exist for — Chromium-only coverage of it would be
		// the silent reduction this list is meant to prevent.
		//
		// MOVED here from the shard below, which had drifted to 66 — past the
		// 64-context ceiling, so its WebKit worker would have stopped accepting
		// navigation partway through. Two things pushed it there and neither
		// re-measured: `multi-agent` landing on `main`, and a focus regression
		// added to `server-owned-streaming` in this branch.
		//
		// Measured, not estimated: moving these five gives 54/61/62/51/50.
		//
		// SINCE UPDATED — `server-owned-streaming` gained the reload-history
		// spec, putting the counts at 54/62/62/51/50. Two shards now sit exactly
		// at the ceiling and there is no headroom in either: the next test added
		// to `webkit-2` or `webkit-3` takes one of them to 63, past the point
		// where a WebKit worker stops accepting navigation. Whoever adds it
		// moves a spec to `webkit-5` (50) or `webkit-4` (51) rather than
		// re-measuring afterwards and discovering the shard already broke.
		'**/approval-flow.e2e.ts'
	],
	[
		// The server-owned family's browser paths: the create flow's `fetch` plus
		// reload, a `ReadableStream` streamed through the page's session
		// controller, transcript-versus-page scroll ownership, the route-reuse
		// reset, long-title overflow, a rejected turn's error envelope, and
		// duplicate-title distinguishability, and a keyboard-focus regression on
		// the list route's create button — which lives in this spec precisely
		// because focus is the most engine-divergent behaviour in the lab.
		//
		// No count is stated here any more. It went stale at three tests, again
		// at five, and again at seven — three times in one branch — so the
		// number has come out of the prose and `--list --project=webkit-N` is
		// the answer. Re-run it when this spec gains or loses a test; that is a
		// step in adding one, not a reminder.
		//
		// Its `request`-fixture siblings stay out; that fixture is a
		// Node-side HTTP client, so three engines would run identical code
		// three times.
		//
		// Placed here by measurement, not by eye — see the rebalance note beside
		// `approval-flow` in the first shard for the current counts.
		'**/server-owned-streaming.e2e.ts',
		'**/markdown-editor.e2e.ts',
		'**/message-lifecycle.e2e.ts',
		'**/review-comment-creation.e2e.ts',
		// FOCUS coverage, which is the first category this list exists for:
		// `multi-agent.e2e.ts` walks the tab order to prove the transcript's
		// disclosures are keyboard-reachable, and tab order plus focus-on-click
		// are exactly where WebKit and Chromium diverge. Chromium-only coverage
		// of it would be the silent reduction these shards prevent.
		//
		// Placed by measurement, and the first attempt got this wrong: it went
		// next to `review-imperative`, which is the 62 the ceiling note is
		// about, taking that shard to 71. Without this entry `--list` per
		// project reads 49/48/62/51/50, so its tests go to the smallest. With
		// its ten — the announcer case brought it from nine — the reading is
		// 49/58/62/51/50, comfortably under the ceiling.
		//
		// Re-running `--list` is a STEP in adding a test here, not a reminder
		// afterwards: this count has already gone stale once on this branch.
		'**/multi-agent.e2e.ts'
	],
	['**/review-comment-lifecycle.e2e.ts', '**/review-imperative.e2e.ts'],
	[
		'**/review-modes.e2e.ts',
		'**/review-ssr-and-a11y.e2e.ts',
		// Another real fetch/ReadableStream path — a provider failure has to
		// reach the banner on every engine, not only the Chromium project that
		// inherits the root matcher.
		//
		// Placed by measurement: `--list` per project read 49/48/62/44/50
		// before this entry, so its seven tests go to the smallest shard. My
		// first attempt put them in the 62 — the one the ceiling note is
		// about — which is the mistake this comment exists to stop repeating.
		'**/error-handling.e2e.ts',
		// Measured on 2026-09-12: this keeps the shard at 53 contexts
		// (webkit-1 54, webkit-2 62, webkit-3 62, webkit-4 53, webkit-5 52).
		'**/server-owned-approval-flow.e2e.ts'
	],
	[
		'**/review-views.e2e.ts',
		'**/row-reconciliation.e2e.ts',
		'**/utilities.e2e.ts',
		'**/virtualization.e2e.ts',
		'**/page.svelte.e2e.ts',
		// FOCUS, which is the first category this list exists for, and the
		// reason this spec has its own file: it asserts where focus lands when
		// the element holding it is removed, and WebKit's focus-on-removal
		// semantics differ from Chromium's. Left in `server-owned.e2e.ts` it
		// would have run in Chromium only, and a WebKit regression would have
		// left CI green.
		//
		// Placed here by measurement, not by eye. `--list` per project read
		// 54/62/62/51/50 before this entry, and `webkit-2`/`webkit-3` are at the
		// 64-context ceiling with no headroom — so its one test goes to the
		// smallest shard, taking this one to 51. Re-run `--list` when this gains
		// a test; that is a step in adding one, not a reminder afterwards.
		'**/server-owned-approval-focus.e2e.ts'
	]
] as const;

const CROSS_ENGINE = CROSS_ENGINE_SHARDS.flat();

export default defineConfig({
	// The complete suite starts three application processes and runs Chromium,
	// WebKit, and Firefox. Concurrent browser workers intermittently starve those
	// shared processes on this machine; one keeps the interaction suite deterministic
	// contention. This is capacity control, not a timeout or retry workaround.
	workers: 1,
	// With a SINGLE webServer Playwright infers `baseURL` from its port; with an
	// array it does not, and every relative `page.goto('/…')` in the suite would
	// fail. Set it explicitly to the production preview, which is what all but
	// `hydration.e2e.ts` exercise.
	//
	// Still true after adding `projects`: an array `webServer` sets the internal
	// `config.webServer` to null, which is what suppresses the inference, and
	// projects do not touch it. The root `use` merges into every project, so
	// `baseURL` reaches WebKit and Firefox without being restated.
	use: {
		baseURL: 'http://localhost:4173',
		// ROADMAP HS-4: leave a trail when something fails, so a flaky-looking
		// failure can be diagnosed instead of guessed at — the pressure that
		// produces "just bump the timeout", which this repo rules out.
		//
		// `retain-on-failure`, NOT the commonly-scaffolded `on-first-retry`:
		// `retries` is 0 here, so anything keyed to a retry never fires and would
		// be pure ceremony.
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},
	// `retries` stays at 0 deliberately in CI as well as locally. A retry that
	// turns a real intermittent failure green is the same mistake as a bumped
	// timeout, which `CLAUDE.md` treats as blocking. `retain-on-failure` produces
	// the artifact trail needed to diagnose the first failure without masking it.
	projects: [
		// LOAD-BEARING, and the least obvious line in this file. Declaring any
		// `projects` array REPLACES Playwright's implicit root project. Without this
		// entry the suite would silently stop running in Chromium altogether and
		// shrink to whatever `CROSS_ENGINE` matches — green, faster, and covering
		// far less. It carries no `testMatch` so it inherits the root one and keeps
		// running all of it.
		//
		// Plain `browserName` rather than `devices['Desktop Chrome']`: `devices`
		// also pins viewport, user agent, and device scale factor, which would
		// change this project's behavior relative to today's implicit one. Keeping
		// it byte-for-byte identical means the only thing this change introduces is
		// the two new engines.
		{ name: 'chromium', use: { browserName: 'chromium' } },
		// A long-lived WebKit process stops accepting navigation after its 64th
		// fresh context on macOS. Each project owns a fresh worker/browser process,
		// so these five exhaustive, non-overlapping shards keep the largest one at
		// 62 tests without adding retries, parallel contention, or a larger timeout.
		...CROSS_ENGINE_SHARDS.map((testMatch, index) => ({
			name: `webkit-${index + 1}`,
			use: { browserName: 'webkit' as const },
			testMatch
		})),
		{ name: 'firefox', use: { browserName: 'firefox' }, testMatch: CROSS_ENGINE }
	],
	webServer: [
		// ROADMAP HS-1/HS-2. Stands in for the ANTHROPIC API, not for `/api/chat` —
		// so the real SvelteKit endpoint, the real Operative provider stream, the
		// real ndjson re-encode, the real `toolbox.execute` signature, and the real
		// browser `ReadableStream` read are all still under test.
		//
		// It is reachable because `/api/chat` forwards `env.ANTHROPIC_BASE_URL`
		// into `createAnthropicProviderStream({ baseURL })` explicitly. That used
		// to be implicit — the raw Anthropic SDK read `ANTHROPIC_BASE_URL` from the
		// environment at construction — but Operative's provider does not, so the
		// option is application code that has to stay. Removing it points every
		// spec below at the real Anthropic API, which fails the suite only after
		// making live billed calls.
		//
		// Playwright's `Route` cannot trickle a body — `fulfill` takes a complete
		// one and `route.fetch()` returns a buffered response — so no amount of
		// mocking `/api/chat` can deliver more than one chunk. That is why
		// progressive rendering was untestable here even in principle.
		//
		// A `webServer` entry rather than a per-spec server, because
		// `page.svelte.e2e.ts` runs in three projects across parallel workers: a
		// spec-owned server would be started once per worker and every copy after
		// the first would fail to bind. One process for the whole run, with all
		// per-test state keyed by a marker the test generates.
		//
		// `reuseExistingServer: false` on every entry, written down rather than left
		// to the default it already equals (CIN-509). Playwright's default for an
		// UNSET option is `false`, which makes a held port a startup error
		// (`http://localhost:4599 is already used …`) — the docs' `!process.env.CI`
		// is a value they recommend setting, not what unset evaluates to. That
		// matters here because this repository is worked in several git worktrees
		// at once: with reuse on, a second worktree starting the suite while the
		// first is running would adopt the first worktree's fixture and preview
		// and report passes about the wrong tree, with nothing printed. Reuse also
		// buys almost nothing: `bun run build` for this lab takes about six
		// seconds, so a single-checkout rerun pays that plus preview startup.
		// `scripts/playwright-collision-guard.test.ts` occupies a port with a
		// server from "another checkout" and asserts the run refuses it, so this
		// cannot drift to `!process.env.CI` unnoticed. `--strictPort` on the dev
		// server below is not what protects it — under reuse the command never
		// runs when the port is held — this setting is.
		{ command: 'bun src/routes/streaming-fixture.ts', port: 4599, reuseExistingServer: false },
		{
			command: 'bun run build && bun run preview',
			port: 4173,
			reuseExistingServer: false,
			// Same port as the fixture entry above. `streaming-fixture.ts` exports
			// `FIXTURE_PORT` so the number has one home, but a `webServer` command is
			// a string — this is the one place it has to be spelled again.
			env: {
				// The SDK requires a non-empty key before it will send the request to
				// the local fixture; this value is never sent to Anthropic.
				ANTHROPIC_API_KEY: 'test-key',
				ANTHROPIC_BASE_URL: 'http://127.0.0.1:4599'
			}
		},
		// A dev server alongside the production preview, purely so hydration
		// mismatches are observable: Svelte strips `hydration_mismatch` from
		// production builds, so `hydration.e2e.ts` has to drive a dev build to see
		// them at all (cinder#756 hid here for exactly that reason).
		//
		// One pair of servers regardless of project count — the webServer plugins
		// are built once from the top-level config in global setup, not per project.
		{ command: 'bun run dev -- --port 5175 --strictPort', port: 5175, reuseExistingServer: false }
	],
	testMatch: '**/*.e2e.{ts,js}'
});
