import { afterEach, describe, expect, test } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';

import playwrightConfig from '../playwright.config.ts';

/**
 * Proves the CIN-509 guard the way the issue asks: occupy a `webServer` port
 * with a server that belongs to "another checkout", run the suite, and assert
 * it refuses loudly instead of silently adopting the server.
 *
 * Two layers, because Playwright starts `webServer` entries in order and only
 * reaches a later entry's port after the earlier ones are up — a held dev port
 * (5175) is only checked after the preview has been built and started, which
 * is seconds of work that has nothing to do with the property under test:
 *
 * 1. The MECHANISM is proven live against the first entry (the fixture on
 *    4599): a fake foreign server holds the port, Playwright is spawned with
 *    `CI` cleared, and the run must refuse at startup naming the port.
 * 2. Every entry's `reuseExistingServer: false` is pinned by reading the config
 *    itself, so one entry drifting to the docs' recommended `!process.env.CI`
 *    (which would reopen the bug for that server alone) fails here.
 *
 * No timeouts, by design. The child is spawned asynchronously so the fake can
 * serve requests, and the fake ends the run deterministically: the only way it
 * ever receives an HTTP request is if Playwright adopted it and started running
 * specs — the drifted-config failure this test exists to catch — so the first
 * request kills the child and the assertions read the result. On the correct
 * config Playwright refuses before making any request and the run ends on its
 * own in about a second.
 */
const LAB_ROOT = join(import.meta.dir, '..');

/** The `webServer` entries as configured, in start order. */
const WEB_SERVERS = Array.isArray(playwrightConfig.webServer)
	? playwrightConfig.webServer
	: playwrightConfig.webServer
		? [playwrightConfig.webServer]
		: [];
const FIRST_PORT = WEB_SERVERS[0]?.port;

function listenOrExplain(server: Server, port: number): Promise<void> {
	return new Promise((resolve, reject) => {
		server.once('error', (error: NodeJS.ErrnoException) => {
			reject(
				error.code === 'EADDRINUSE'
					? new Error(
							`port ${port} is already held — by another checkout's server, or a stray one; this test needs it free to stand in as the foreign server`
						)
					: error
			);
		});
		server.listen(port, '127.0.0.1', () => resolve());
	});
}

describe('chat-room Playwright refuses a web server it did not start', () => {
	let fake: Server | undefined;
	let child: ReturnType<typeof Bun.spawn> | undefined;

	afterEach(async () => {
		if (child) {
			child.kill();
			await child.exited;
			child = undefined;
		}
		if (fake) {
			const server = fake;
			fake = undefined;
			// Only a listening server can be closed; when `listenOrExplain()` failed the
			// real error must surface rather than an ERR_SERVER_NOT_RUNNING from here.
			if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});

	test('every webServer entry sets reuseExistingServer to false', () => {
		expect(WEB_SERVERS.map((entry) => entry.port)).toEqual([4599, 4173, 5175]);
		for (const entry of WEB_SERVERS) {
			expect(entry.reuseExistingServer, `port ${entry.port}: ${entry.command}`).toBe(false);
		}
	});

	test('a held port fails the run at startup and names the port', async () => {
		expect(FIRST_PORT).toBeDefined();
		if (FIRST_PORT === undefined) return;
		let adopted = false;

		fake = createServer((_request, response) => {
			// Playwright only talks HTTP to this port if it adopted the fake and
			// began running specs against it. End the run right here.
			adopted = true;
			response.writeHead(200, { 'content-type': 'text/html' });
			response.end('<!doctype html><title>another checkout</title>');
			child?.kill();
		});
		await listenOrExplain(fake, FIRST_PORT);

		const environment = { ...process.env };
		delete environment['CI'];
		child = Bun.spawn(
			['bunx', 'playwright', 'test', '--project=chromium', 'src/routes/page.svelte.e2e.ts'],
			{ cwd: LAB_ROOT, env: environment, stdout: 'pipe', stderr: 'pipe' }
		);
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited
		]);
		const output = `${stdout}\n${stderr}`;

		expect(
			adopted,
			`Playwright adopted the fake server on port ${FIRST_PORT} and ran specs against it:\n${output}`
		).toBe(false);
		expect(exitCode, output).not.toBe(0);
		expect(output).toContain(`http://localhost:${FIRST_PORT} is already used`);
		expect(output).not.toMatch(/\d+ passed/);
	});
});
