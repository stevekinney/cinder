import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  prepareInternalPeerChangesets,
  SYNTHETIC_CHANGESET_FILENAME,
  syntheticChangesetContent,
  type PrepareInternalPeerChangesetsOptions,
} from './prepare-internal-peer-changesets.ts';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function makeChangesetFixture(
  files: Record<string, string>,
  versions: { chat?: string; editor?: string } = {},
): Promise<PrepareInternalPeerChangesetsOptions> {
  const changesetDirectory = await mkdtemp(join(tmpdir(), 'prepare-internal-peers-'));
  temporaryRoots.push(changesetDirectory);
  await Promise.all(
    Object.entries(files).map(([filename, content]) =>
      writeFile(join(changesetDirectory, filename), content),
    ),
  );

  const dependents = await Promise.all(
    [
      { name: '@lostgradient/chat', version: versions.chat ?? '0.3.0' },
      { name: '@lostgradient/editor', version: versions.editor ?? '0.2.0' },
    ].map(async ({ name, version }) => {
      const manifestPath = join(changesetDirectory, `${name.split('/').at(-1)}-package.json`);
      await writeFile(manifestPath, `${JSON.stringify({ name, version }, null, 2)}\n`);
      return { name, manifestPath };
    }),
  );

  return { changesetDirectory, dependents };
}

function changeset(packageName: string, releaseType: string): string {
  return `---\n'${packageName}': ${releaseType}\n---\n\nFixture change.\n`;
}

describe('prepareInternalPeerChangesets', () => {
  test('writes dependent releases for a pending Cinder minor', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-minor.md': changeset('@lostgradient/cinder', 'minor'),
    });

    const result = await prepareInternalPeerChangesets(fixture);

    expect(result.writtenReleases).toEqual(['@lostgradient/chat', '@lostgradient/editor']);
    expect(
      await Bun.file(join(fixture.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME)).text(),
    ).toBe(
      syntheticChangesetContent([
        { name: '@lostgradient/chat', releaseType: 'minor' },
        { name: '@lostgradient/editor', releaseType: 'minor' },
      ]),
    );
  });

  test('also coordinates dependents for a pending Markdown minor', async () => {
    const fixture = await makeChangesetFixture({
      'markdown-minor.md': changeset('@lostgradient/markdown', 'minor'),
    });

    const result = await prepareInternalPeerChangesets(fixture);

    expect(result.writtenReleases).toEqual(['@lostgradient/chat', '@lostgradient/editor']);
  });

  test('does not write for dependency patches', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-patch.md': changeset('@lostgradient/cinder', 'patch'),
      'markdown-patch.md': changeset('@lostgradient/markdown', 'patch'),
    });

    const result = await prepareInternalPeerChangesets(fixture);

    expect(result.writtenReleases).toEqual([]);
  });

  test('writes only the dependent whose pending bump is insufficient', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-minor.md': changeset('@lostgradient/cinder', 'minor'),
      'editor-minor.md': changeset('@lostgradient/editor', 'minor'),
      'chat-patch.md': changeset('@lostgradient/chat', 'patch'),
    });

    const result = await prepareInternalPeerChangesets(fixture);

    expect(result.writtenReleases).toEqual(['@lostgradient/chat']);
    expect(
      await Bun.file(join(fixture.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME)).text(),
    ).toBe(syntheticChangesetContent([{ name: '@lostgradient/chat', releaseType: 'minor' }]));
  });

  test('uses major releases for stable dependents', async () => {
    const fixture = await makeChangesetFixture(
      { 'cinder-minor.md': changeset('@lostgradient/cinder', 'minor') },
      { chat: '1.0.0', editor: '1.2.0' },
    );

    const result = await prepareInternalPeerChangesets(fixture);

    expect(result.writtenReleases).toEqual(['@lostgradient/chat', '@lostgradient/editor']);
    expect(
      await Bun.file(join(fixture.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME)).text(),
    ).toBe(
      syntheticChangesetContent([
        { name: '@lostgradient/chat', releaseType: 'major' },
        { name: '@lostgradient/editor', releaseType: 'major' },
      ]),
    );
  });

  test('is idempotent when the synthetic changeset already exists', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-minor.md': changeset('@lostgradient/cinder', 'minor'),
    });

    const firstResult = await prepareInternalPeerChangesets(fixture);
    const secondResult = await prepareInternalPeerChangesets(fixture);

    expect(firstResult.writtenReleases).toHaveLength(2);
    expect(secondResult.writtenReleases).toEqual([]);
  });
});
