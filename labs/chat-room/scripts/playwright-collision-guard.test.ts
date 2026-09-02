import { afterEach, describe, expect, test } from 'bun:test';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';

/**
 * Proves the CIN-509 guard the way the issue asks: occupy a `webServer` port
 * with a server that belongs to "another checkout", run the suite, and assert
 * it refuses loudly instead of silently adopting the server.
 *
 * The fake sits on the preview port (4173), the one every meaningful spec
 * exercises and one of the two entries without `--strictPort`. `CI` is
 * cleared in the child environment so the result does not depend on it: the
 * refusal comes from `reuseExistingServer: false` in `playwright.config.ts`,
 * and this test is what stops that from drifting to the docs' recommended
 * `!process.env.CI`, which is exactly the setting that would create the bug.
 */
const LAB_ROOT = join(import.meta.dir, '..');
const PREVIEW_PORT = 4173;

async function portIsFree(port: number): Promise<boolean> {
	try {
		await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(500) });
		return false;
	} catch {
		return true;
	}
}

describe('chat-room Playwright refuses a web server it did not start', () => {
	let fake: Server | undefined;

	afterEach(async () => {
		if (fake) {
			await new Promise<void>((resolve) => fake?.close(() => resolve()));
			fake = undefined;
		}
	});

	test('a held preview port fails the run at startup and names the port', async () => {
		expect(
			await portIsFree(PREVIEW_PORT),
			`port ${PREVIEW_PORT} must be free to run this test`
		).toBe(true);

		fake = createServer((_request, response) => {
			response.writeHead(200, { 'content-type': 'text/html' });
			response.end("<!doctype html><title>another checkout's preview</title>");
		});
		await new Promise<void>((resolve) => fake?.listen(PREVIEW_PORT, '127.0.0.1', () => resolve()));

		const environment = { ...process.env };
		delete environment['CI'];
		const run = Bun.spawnSync(
			['bunx', 'playwright', 'test', '--project=chromium', 'src/routes/page.svelte.e2e.ts'],
			// Bounded: the refusal arrives in about a second. If the setting ever
			// drifts to reuse, Playwright would adopt the fake and start running specs
			// against it; SIGTERM after the timeout lets it tear its own servers down.
			{ cwd: LAB_ROOT, env: environment, stdout: 'pipe', stderr: 'pipe', timeout: 60_000 }
		);
		const output = `${run.stdout.toString()}\n${run.stderr.toString()}`;

		expect(run.exitCode, output).not.toBe(0);
		expect(output).toContain(`http://localhost:${PREVIEW_PORT} is already used`);
		// And it never got as far as running a spec against the fake.
		expect(output).not.toMatch(/\d+ passed/);
	}, 120_000);
});
