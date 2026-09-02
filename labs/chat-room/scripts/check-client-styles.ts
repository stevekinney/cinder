#!/usr/bin/env bun
/**
 * Fails when a workspace package's global stylesheet is missing from the
 * production CLIENT output.
 *
 * `@lostgradient/chat` ships `chat.css` as a sidecar that its component barrel
 * imports for its side effect. A bundler that honours only the package's
 * `sideEffects` glob for `.css` files may still drop the barrel itself as a
 * side-effect-free re-export module — taking the stylesheet import with it —
 * while the dev server, which never tree-shakes, keeps serving it. The server
 * build chunks differently and kept the sidecar, and every Svelte-scoped rule
 * carries a `var(--token, fallback)` default, so the transcript looked close
 * enough that nothing in the ordinary suite noticed (CIN-514). Each marker
 * below is a rule that only the sidecar defines, so a client build that lacks
 * it is a client build that lost the file.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export type StyleMarker = { marker: string; source: string };

export const REQUIRED_STYLE_MARKERS: readonly StyleMarker[] = [
	{ marker: '.cinder-chat .message-content-preview', source: '@lostgradient/chat chat.css' },
	{ marker: '@property --cinder-chat-message-max-width', source: '@lostgradient/chat chat.css' }
];

export const CLIENT_ASSETS_DIRECTORY = '.svelte-kit/output/client/_app/immutable/assets';

/** Reads every `.css` file in the client asset directory into one string per file. */
export async function readClientStylesheets(assetsDirectory: string): Promise<Map<string, string>> {
	const stylesheets = new Map<string, string>();
	let entries: string[];
	try {
		entries = await readdir(assetsDirectory);
	} catch {
		return stylesheets;
	}
	for (const entry of entries.toSorted()) {
		if (!entry.endsWith('.css')) continue;
		stylesheets.set(entry, await Bun.file(join(assetsDirectory, entry)).text());
	}
	return stylesheets;
}

/** Returns every required marker that no client stylesheet contains. */
export function findMissingStyleMarkers(
	stylesheets: ReadonlyMap<string, string>,
	markers: readonly StyleMarker[] = REQUIRED_STYLE_MARKERS
): StyleMarker[] {
	const contents = [...stylesheets.values()];
	return markers.filter(({ marker }) => !contents.some((css) => css.includes(marker)));
}

export async function main(assetsDirectory: string = CLIENT_ASSETS_DIRECTORY): Promise<number> {
	const stylesheets = await readClientStylesheets(assetsDirectory);
	if (stylesheets.size === 0) {
		console.error(
			`No client stylesheets found under ${assetsDirectory}. Run \`bun run build\` first.`
		);
		return 1;
	}
	const missing = findMissingStyleMarkers(stylesheets);
	if (missing.length === 0) {
		console.log(
			`Client output carries every required stylesheet (${REQUIRED_STYLE_MARKERS.length} markers across ${stylesheets.size} files).`
		);
		return 0;
	}
	for (const { marker, source } of missing)
		console.error(`Missing from client output: ${marker} (expected from ${source})`);
	console.error(
		'A workspace stylesheet was dropped from the production client bundle. See CIN-514 for the mechanism.'
	);
	return 1;
}

if (import.meta.main) process.exit(await main());
