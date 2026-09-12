import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DATABASE_VARIABLE, serverOwnedStorage } from '$lib/server-owned-storage';

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

function temporaryDatabasePath(): string {
	const directory = mkdtempSync(join(tmpdir(), 'chat-room-durability-'));
	directories.push(directory);
	return join(directory, 'server-owned.sqlite');
}

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

	test('a file path survives the storage being reopened', async () => {
		const path = temporaryDatabasePath();
		process.env[DATABASE_VARIABLE] = path;

		const first = serverOwnedStorage();
		expect(first.durability).toBe('on-disk');
		await first.storage.put('run/1', new TextEncoder().encode('still running'));
		first.storage[Symbol.dispose]?.();

		// A SECOND construction over the same path, which is what a restarted
		// process does. Reading back here is the whole claim: without it the
		// durability exercise has nothing to recover and the recovery endpoint
		// can only ever answer "nothing to resume".
		const second = serverOwnedStorage();
		const stored = await second.storage.get('run/1');
		second.storage[Symbol.dispose]?.();

		expect(stored).not.toBeNull();
		expect(new TextDecoder().decode(stored ?? new Uint8Array())).toBe('still running');
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
