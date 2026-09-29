import { expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadManifest, manifestDigest } from './manifest.ts';

test('loads a manifest from an application-owned path', async () => {
  const directory = join(tmpdir(), `corvidae-manifest-${crypto.randomUUID()}`);
  const path = join(directory, 'manifest.json');
  const entries = [{ name: 'Button', slug: 'button', route: '/page/button' }];
  await mkdir(directory, { recursive: true });
  await writeFile(path, JSON.stringify({ digest: 'a'.repeat(64), entries }));

  try {
    expect(loadManifest(path)).toEqual(entries);
    expect(manifestDigest(path)).toBe('a'.repeat(64));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('requires an explicit application manifest path', () => {
  expect(() => loadManifest('')).toThrow('browser fixture manifest path is required');
});
