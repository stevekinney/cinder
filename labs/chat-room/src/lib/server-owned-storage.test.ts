import { afterEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	DATABASE_VARIABLE,
	DurableStorageUnavailableError,
	serverOwnedStorage
} from '$lib/server-owned-storage';

/**
 * Which backing store the server-owned family gets, and whether it survives
 * the process.
 *
 * The durability half is tested by CONSTRUCTING TWICE over the same path and
 * reading back what the first one wrote, rather than by asserting the class
 * name. A test that checked `instanceof SQLiteStorage` would pass over a
 * database opened at a path nothing can be written to, which is the failure
 * this exists to catch: the whole point of the on-disk branch is that a run
 * left in flight is still there for the next process to find.
 */

const originalValue = process.env[DATABASE_VARIABLE];
const directories: string[] = [];

afterEach(() => {
	if (originalValue === undefined) delete process.env[DATABASE_VARIABLE];
	else process.env[DATABASE_VARIABLE] = originalValue;

	while (directories.length > 0) {
		const directory = directories.pop();
		if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
	}
});

/**
 * Runs the storage fixture in a child process.
 *
 * `bun` rather than an import, because the point is a boundary: a child gets
 * its own module graph, its own globals, and its own file handles, so nothing
 * but the database file can carry a value across.
 */
function spawnFixture(
	args: string[],
	database: string | undefined
): { stdout: string; stderr: string } {
	const environment = { ...process.env };
	if (database === undefined) delete environment[DATABASE_VARIABLE];
	else environment[DATABASE_VARIABLE] = database;

	const result = spawnSync('bun', ['src/lib/server-owned-storage-fixture.ts', ...args], {
		cwd: new URL('../..', import.meta.url).pathname,
		env: environment,
		encoding: 'utf8'
	});

	return { stdout: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim() };
}

function temporaryDatabasePath(): string {
	const directory = mkdtempSync(join(tmpdir(), 'chat-room-durability-'));
	directories.push(directory);
	return join(directory, 'server-owned.sqlite');
}

describe('the durable adapter stays an opt-in', () => {
	test('better-sqlite3 is not a dependency of this lab', () => {
		// A GUARD, not a preference. Declaring it failed every `playwright-lane`
		// on the branch that first added it: its install script exits 127 in the
		// Playwright container, so `bun install --frozen-lockfile` died before a
		// single test ran — for a package no CI command ever constructs.
		//
		// It stays a step of `docs/durability-exercise.md` instead. Re-adding it
		// here would break the browser suite again, and the failure arrives as a
		// dependency-install error sixteen times over rather than as anything
		// pointing at the cause.
		const manifest = JSON.parse(
			readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
		) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

		expect(Object.keys(manifest.dependencies ?? {})).not.toContain('better-sqlite3');
		expect(Object.keys(manifest.devDependencies ?? {})).not.toContain('better-sqlite3');
	});

	test('an I/O failure is not diagnosed as a missing package', () => {
		// The wrapper used to append the install instruction to every cause. A
		// path into a directory that does not exist fails for an I/O reason even
		// under Bun, where nothing needs installing — so that advice sent the
		// operator to fix the wrong thing.
		const error = new DurableStorageUnavailableError(
			'/nope/nowhere/example.sqlite',
			new Error('unable to open database file')
		);

		expect(error.message).not.toContain('durability-exercise.md');
		expect(error.message).toContain('existing directory');
		expect(error.message).toContain(DATABASE_VARIABLE);
	});

	test('the durable branch reports what to do when the peer is absent', () => {
		// Under `bun test` the runtime-neutral entry resolves to `bun:sqlite`, so
		// construction SUCCEEDS here and the error below cannot be triggered by
		// unsetting a package. What is pinned instead is that the message names
		// all three things a reader needs: the variable, the install, and the way
		// back to a working server.
		const error = new DurableStorageUnavailableError(
			'/tmp/example.sqlite',
			new Error('NodeSQLiteStorage requires the optional peer dependency "better-sqlite3".')
		);

		expect(error.message).toContain(DATABASE_VARIABLE);
		expect(error.message).toContain('durability-exercise.md');
		expect(error.message).toContain('in-memory storage');
		expect(error.message).toContain('better-sqlite3');
	});
});

describe('serverOwnedStorage', () => {
	test('is in-memory when the variable is unset', async () => {
		delete process.env[DATABASE_VARIABLE];

		const { storage, durability } = serverOwnedStorage();

		expect(durability).toBe('in-memory');
		// Usable, not merely constructed — the memory adapter is the default path
		// every existing command in this lab takes.
		await storage.put('probe', new TextEncoder().encode('value'));
		expect(await storage.get('probe')).not.toBeNull();
	});

	test('treats an empty value as unset', () => {
		// A shell that exports one unset variable from another (`export X="$Y"`)
		// produces an empty string, and opening a database at the path `''` fails
		// in a way that has nothing to do with what the operator meant.
		process.env[DATABASE_VARIABLE] = '';

		expect(serverOwnedStorage().durability).toBe('in-memory');
	});

	test("reports ':memory:' as in-memory, because it is", () => {
		// SQLite's own spelling for an ephemeral database. The adapter accepts it,
		// so the naive read of "a path was given" would have called this on-disk
		// and had the recovery panel claim durability this database lacks.
		process.env[DATABASE_VARIABLE] = ':memory:';

		expect(serverOwnedStorage().durability).toBe('in-memory');
	});

	test('releasing the in-memory adapter does NOT throw its contents away', async () => {
		// The asymmetry that matters. `MemoryStorage[Symbol.dispose]()` clears
		// its map, so a runtime teardown that called it unconditionally would
		// delete every session and checkpoint on the way out — which is exactly
		// what `server-owned-runtime.test.ts` pins against, and exactly what a
		// first attempt at releasing the SQLite connection reintroduced.
		delete process.env[DATABASE_VARIABLE];

		const { storage, release } = serverOwnedStorage();
		await storage.put('run/1', new TextEncoder().encode('still here'));

		release();

		expect(await storage.get('run/1')).not.toBeNull();
	});

	test('a file path survives an actual process boundary', async () => {
		// TWO PROCESSES, not two constructions. The first version of this test
		// built both storages here, which review correctly called hollow: an
		// implementation backed by a module-level map or a per-path cached
		// singleton would have passed it — and the different-paths test beside
		// it — while losing everything on a real restart, which is the only
		// thing the claim is about.
		const path = temporaryDatabasePath();

		const wrote = spawnFixture(['write', 'run/1', 'still running'], path);
		expect(wrote.stderr).toBe('');
		expect(wrote.stdout).toBe('written');

		const read = spawnFixture(['read', 'run/1'], path);
		expect(read.stderr).toBe('');
		expect(read.stdout).toBe('still running');
	});

	test('an in-memory store does NOT survive a process boundary', async () => {
		// The control, and the reason the test above means anything. Without it
		// a durability assertion could pass against something that always
		// returns what it was asked for.
		const wrote = spawnFixture(['write', 'run/1', 'still running'], undefined);
		expect(wrote.stdout).toBe('written');

		const read = spawnFixture(['read', 'run/1'], undefined);
		expect(read.stdout).toBe('(absent)');
	});

	test('two runtimes over different paths do not see each other', async () => {
		const first = temporaryDatabasePath();
		process.env[DATABASE_VARIABLE] = first;
		const one = serverOwnedStorage();
		await one.storage.put('shared/key', new TextEncoder().encode('one'));
		one.storage[Symbol.dispose]?.();

		const second = temporaryDatabasePath();
		process.env[DATABASE_VARIABLE] = second;
		const two = serverOwnedStorage();
		const leaked = await two.storage.get('shared/key');
		two.storage[Symbol.dispose]?.();

		expect(leaked).toBeNull();
	});
});
