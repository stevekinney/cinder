import { MemoryStorage } from '@lostgradient/weft/storage/memory';
import { SQLiteStorage } from '@lostgradient/weft/storage/sqlite';
import type { Storage } from '@lostgradient/weft/storage/interface';

/**
 * Names the file the server-owned family keeps its sessions and checkpoints in.
 *
 * Unset — the ordinary case, and every existing command in this lab — gives
 * `MemoryStorage`, which is what the variant has always used. Set to a path,
 * the same composition runs over SQLite on disk, and a run that was in flight
 * when the process died is still there when the next process starts.
 *
 * An OPT-IN rather than a new default, because the two are observably
 * different rather than one being strictly better. In-memory storage makes
 * every run start from nothing, which is the right behaviour for a test suite
 * and for someone reading the route family for the first time. On-disk storage
 * is what makes the recovery question answerable at all, and it also means one
 * afternoon's experiments are still in the database next week.
 */
export const DATABASE_VARIABLE = 'CHAT_ROOM_SERVER_OWNED_DATABASE';

/**
 * Which of the two the process is running, for anything that reports it.
 *
 * Named in the interface rather than inferred by the reader. "Nothing to
 * resume" after a restart is the TRUTH under in-memory storage and a
 * BUG-shaped surprise under on-disk storage, and a recovery panel that
 * reported the outcome without the backing store would leave someone unable
 * to tell which they were looking at.
 */
export type Durability = 'in-memory' | 'on-disk';

/**
 * The backing store for the server-owned family, and which kind it is.
 *
 * `SQLiteStorage` rather than `BunSQLiteStorage`: the runtime-neutral entry
 * point resolves to Bun's `bun:sqlite` adapter under Bun and to Weft's
 * `better-sqlite3`-backed one elsewhere, so this file does not decide which
 * runtime the lab runs under. Both implement the same Weft `Storage`
 * interface, which is the only thing `createRunEngine` and `textValueStore`
 * ever ask for.
 *
 * THE IMPORT IS FREE; only construction can fail. Weft loads `better-sqlite3`
 * inside the Node adapter's constructor rather than at module load, and its
 * declarations reference none of that package's types — so this module
 * imports, type-checks, and builds on a checkout that has never installed it.
 *
 * That is what lets the dependency stay uninstalled, which it must: its
 * install script exits 127 in the Playwright container CI runs the browser
 * suite in, and declaring it failed every lane for a package no CI command
 * ever constructs. `bun test` reaches the Bun adapter, which needs nothing
 * installed, so the durability tests below run either way.
 */
export function serverOwnedStorage(): {
	readonly storage: Storage;
	readonly durability: Durability;
} {
	const path = process.env[DATABASE_VARIABLE];

	// An empty string is treated as unset. A shell that exports the variable
	// from an unset variable of its own (`export X="$Y"`) produces one, and
	// opening a database at the path `''` fails in a way that has nothing to do
	// with what the operator was trying to say.
	if (path === undefined || path === '') {
		return { storage: new MemoryStorage(), durability: 'in-memory' };
	}

	// `':memory:'` is SQLite's own spelling for an ephemeral database, and the
	// adapter accepts it. Reported as `in-memory`, because it is: nothing
	// survives the process, and calling it `on-disk` would make the recovery
	// panel claim durability this database does not have.
	const durability: Durability = path === ':memory:' ? 'in-memory' : 'on-disk';

	try {
		return { storage: new SQLiteStorage(path), durability };
	} catch (cause) {
		throw new DurableStorageUnavailableError(path, cause);
	}
}

/**
 * Raised when the variable names a database this runtime cannot open.
 *
 * Under Bun it never happens — `bun:sqlite` is built in. Under Node, which is
 * what `vite preview` and `vite dev` actually run on (`bun run preview`
 * resolves `vite` through a `#!/usr/bin/env node` shebang), Weft's adapter
 * needs its `better-sqlite3` peer, and this lab deliberately does not install
 * it.
 *
 * The MESSAGE carries Weft's own sentence, which already names the install
 * command, plus where the surrounding procedure is written down and how to get
 * back to a working server without it. The `cause` is attached for a server
 * log and does not reach a client: this route family's error mapping sends a
 * sentence rather than a forwarded cause.
 */
export class DurableStorageUnavailableError extends Error {
	override readonly name = 'DurableStorageUnavailableError';

	constructor(path: string, cause: unknown) {
		const reported = cause instanceof Error ? cause.message : String(cause);
		super(
			`${DATABASE_VARIABLE} names ${path}, but the durable store could not be opened. ${reported} ` +
				'That install is listed as a step of the exercise in labs/chat-room/docs/durability-exercise.md. ' +
				`Unset ${DATABASE_VARIABLE} to run on in-memory storage instead.`,
			{ cause }
		);
	}
}
