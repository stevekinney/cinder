import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  prepareChatCinderPeerChangeset,
  SYNTHETIC_CHANGESET_CONTENT,
  SYNTHETIC_CHANGESET_FILENAME,
  type PrepareChatCinderPeerChangesetOptions,
} from './prepare-chat-cinder-peer-changeset.ts';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function makeChangesetFixture(
  files: Record<string, string>,
  chatVersion = '0.3.0',
): Promise<PrepareChatCinderPeerChangesetOptions> {
  const changesetDirectory = await mkdtemp(join(tmpdir(), 'prepare-chat-cinder-peer-'));
  temporaryRoots.push(changesetDirectory);
  await Promise.all(
    Object.entries(files).map(([filename, content]) =>
      writeFile(join(changesetDirectory, filename), content),
    ),
  );
  const chatManifestPath = join(changesetDirectory, 'chat-package.json');
  await writeFile(
    chatManifestPath,
    `${JSON.stringify({ name: '@lostgradient/chat', version: chatVersion }, null, 2)}\n`,
  );
  return { changesetDirectory, chatManifestPath };
}

function changeset(packageName: string, releaseType: string, summary = 'Fixture change.'): string {
  return `---\n'${packageName}': ${releaseType}\n---\n\n${summary}\n`;
}

describe('prepareChatCinderPeerChangeset', () => {
  test('writes the exact synthetic changeset for a pending Cinder minor', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-minor.md': changeset('@lostgradient/cinder', 'minor'),
    });

    const result = await prepareChatCinderPeerChangeset(fixture);

    expect(result.written).toBe(true);
    expect(
      await Bun.file(join(fixture.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME)).text(),
    ).toBe(SYNTHETIC_CHANGESET_CONTENT('minor'));
  });

  test('does not write for a pending Cinder patch', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-patch.md': changeset('@lostgradient/cinder', 'patch'),
    });

    const result = await prepareChatCinderPeerChangeset(fixture);

    expect(result.written).toBe(false);
    expect(
      await Bun.file(join(fixture.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME)).exists(),
    ).toBe(false);
  });

  test('keeps Chat pre-1.0 on a minor bump when Cinder moves to 1.x', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-major.md': changeset('@lostgradient/cinder', 'major'),
    });
    const result = await prepareChatCinderPeerChangeset(fixture);
    expect(result.written).toBe(true);
    expect(
      await Bun.file(join(fixture.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME)).text(),
    ).toBe(SYNTHETIC_CHANGESET_CONTENT('minor'));
  });

  test('uses a major bump for stable Chat peer-range narrowing', async () => {
    const fixture = await makeChangesetFixture(
      {
        'cinder-minor.md': changeset('@lostgradient/cinder', 'minor'),
      },
      '1.0.0',
    );

    const result = await prepareChatCinderPeerChangeset(fixture);

    expect(result.written).toBe(true);
    expect(
      await Bun.file(join(fixture.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME)).text(),
    ).toBe(SYNTHETIC_CHANGESET_CONTENT('major'));
  });

  test('writes a minor changeset when Chat only has a pending patch', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-minor.md': changeset('@lostgradient/cinder', 'minor'),
      'chat-patch.md': changeset('@lostgradient/chat', 'patch'),
    });

    const result = await prepareChatCinderPeerChangeset(fixture);

    expect(result.written).toBe(true);
    expect(
      await Bun.file(join(fixture.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME)).text(),
    ).toBe(SYNTHETIC_CHANGESET_CONTENT('minor'));
  });

  test('does not write when Chat already has a pending minor', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-minor.md': changeset('@lostgradient/cinder', 'minor'),
      'chat-minor.md': changeset('@lostgradient/chat', 'minor'),
    });

    const result = await prepareChatCinderPeerChangeset(fixture);

    expect(result.written).toBe(false);
    expect(
      await Bun.file(join(fixture.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME)).exists(),
    ).toBe(false);
  });

  test('is idempotent and does not duplicate the synthetic changeset', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-minor.md': changeset('@lostgradient/cinder', 'minor'),
    });

    const firstResult = await prepareChatCinderPeerChangeset(fixture);
    const secondResult = await prepareChatCinderPeerChangeset(fixture);
    const filenames = await Array.fromAsync(
      new Bun.Glob('*.md').scan({ cwd: fixture.changesetDirectory }),
    );

    expect(firstResult.written).toBe(true);
    expect(secondResult.written).toBe(false);
    expect(filenames.filter((filename) => filename === SYNTHETIC_CHANGESET_FILENAME)).toHaveLength(
      1,
    );
  });
});
