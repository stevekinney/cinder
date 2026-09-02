import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	findMissingStyleMarkers,
	main,
	readClientStylesheets,
	REQUIRED_STYLE_MARKERS
} from './check-client-styles.ts';

const CHAT_SIDECAR =
	'@property --cinder-chat-message-max-width{syntax:"<length>";inherits:true;initial-value:48rem}.cinder-chat .message-content-preview{max-width:var(--cinder-chat-message-max-width)}';

const temporaryDirectories: string[] = [];

async function assetsDirectory(files: Record<string, string>): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), 'check-client-styles-'));
	temporaryDirectories.push(directory);
	for (const [name, contents] of Object.entries(files))
		await writeFile(join(directory, name), contents);
	return directory;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
	);
});

describe('findMissingStyleMarkers', () => {
	test('reports every marker no stylesheet contains', () => {
		const stylesheets = new Map([['0.css', '.unrelated{}']]);
		expect(findMissingStyleMarkers(stylesheets)).toEqual(REQUIRED_STYLE_MARKERS);
	});

	test('accepts markers spread across files', () => {
		const stylesheets = new Map([
			['a.css', '.cinder-chat .message-content-preview{}'],
			['b.css', '@property --cinder-chat-message-max-width{}']
		]);
		expect(findMissingStyleMarkers(stylesheets)).toEqual([]);
	});

	test('a Svelte-scoped chat chunk without the sidecar does not satisfy the markers', () => {
		const stylesheets = new Map([
			[
				'chat.hash.css',
				'.chat-container.svelte-abc{max-width:var(--cinder-chat-message-max-width,48rem)}'
			]
		]);
		expect(findMissingStyleMarkers(stylesheets)).toHaveLength(2);
	});
});

describe('readClientStylesheets', () => {
	test('reads only .css files, sorted by name', async () => {
		const directory = await assetsDirectory({ 'b.css': 'b', 'a.css': 'a', 'c.js': 'js' });
		expect([...(await readClientStylesheets(directory)).entries()]).toEqual([
			['a.css', 'a'],
			['b.css', 'b']
		]);
	});

	test('a missing directory reads as no stylesheets', async () => {
		expect((await readClientStylesheets('/nonexistent/assets')).size).toBe(0);
	});
});

describe('main', () => {
	test('fails when nothing has been built', async () => {
		expect(await main(await assetsDirectory({}))).toBe(1);
	});

	test('fails when the chat sidecar is absent from the client output', async () => {
		const directory = await assetsDirectory({ 'chat.hash.css': '.chat-container.svelte-abc{}' });
		expect(await main(directory)).toBe(1);
	});

	test('passes when the sidecar is present', async () => {
		const directory = await assetsDirectory({ 'chat.hash.css': CHAT_SIDECAR });
		expect(await main(directory)).toBe(0);
	});
});
