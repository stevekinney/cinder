/**
 * Writes to or reads from the server-owned storage in a SEPARATE process.
 *
 * The durability claim is that a run left in flight is there for the NEXT
 * process, and a test that constructs both storages in one process cannot
 * check it: an implementation backed by a module-level map, or a per-path
 * cached singleton, would satisfy it and still lose everything on a restart.
 * Review caught exactly that.
 *
 * So this runs as a child process. `write` puts a value and exits; `read`
 * prints what it finds. Nothing is shared between the two but the file.
 */
import { serverOwnedStorage } from '$lib/server-owned-storage';

const [mode, key, value] = process.argv.slice(2);

const { storage, release } = serverOwnedStorage();

try {
	if (mode === 'write') {
		if (key === undefined || value === undefined) throw new Error('write needs a key and a value');
		await storage.put(key, new TextEncoder().encode(value));
		process.stdout.write('written');
	} else if (mode === 'read') {
		if (key === undefined) throw new Error('read needs a key');
		const found = await storage.get(key);
		// A MISS is printed rather than thrown, so a test can tell "the process
		// ran and found nothing" from "the process failed".
		process.stdout.write(found === null ? '(absent)' : new TextDecoder().decode(found));
	} else {
		throw new Error(`unknown mode: ${String(mode)}`);
	}
} finally {
	release();
}
