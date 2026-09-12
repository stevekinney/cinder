/**
 * A process that already has SIGNAL LISTENERS from an older protocol.
 *
 * This is the upgrade boundary `server-owned-signal-fixture.ts` cannot reach:
 * that one starts cold, so the listeners it exercises are always the ones this
 * evaluation installed. Here the listeners exist BEFORE the module is imported,
 * exactly as they do in a dev server when a reload installs a version whose
 * listener reads a different slot.
 *
 * `SIGNALS_SLOT` makes registration idempotent, so without a protocol check the
 * module would see "already registered", install nothing, and leave the old
 * listeners in charge — reading a slot nothing writes any more, with the new
 * implementation unreachable until a full restart.
 *
 * Writes two markers so the test can tell WHICH listener ran:
 *   STALE_MARKER    — the old listener fired (the regression)
 *   TEARDOWN_MARKER — the new handler disposed the runtime (the fix)
 *
 * Run as a child process, never imported by a route.
 */
import { writeFileSync } from 'node:fs';

const SIGNALS_SLOT = Symbol.for('cinder.chat-room.server-owned.signals');
const LISTENERS_SLOT = Symbol.for('cinder.chat-room.server-owned.signal-listeners');

const staleMarker = process.env['STALE_MARKER'] ?? '';
const teardownMarker = process.env['TEARDOWN_MARKER'] ?? '';

const host = globalThis as Record<symbol, unknown>;

// Protocol 1: what the previous version installed. The listener does not
// consult the handler slot at all — that is the whole point of it being stale.
const entries: Array<[NodeJS.Signals, NodeJS.SignalsListener]> = [];
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
	const listener: NodeJS.SignalsListener = () => {
		writeFileSync(staleMarker, 'stale listener ran');
		process.exit(0);
	};
	process.on(signal, listener);
	entries.push([signal, listener]);
}

host[SIGNALS_SLOT] = true;
host[LISTENERS_SLOT] = { protocol: 1, entries };

// Imported AFTER the stale listeners are in place, which is why this is a
// dynamic import: a static one hoists above the setup above.
const { serverOwnedRuntime } = await import('./server-owned-runtime.ts');

const runtime = serverOwnedRuntime();
runtime.onDispose(async () => {
	// Crosses an await before writing, so the marker proves the handler WAITED
	// for disposal rather than merely starting it.
	await new Promise((resolve) => setTimeout(resolve, 0));
	writeFileSync(teardownMarker, 'disposed');
});

const keepAlive = setInterval(() => {}, 1000);
console.log('ready');
void keepAlive;
