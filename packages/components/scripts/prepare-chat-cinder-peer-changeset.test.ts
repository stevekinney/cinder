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
): Promise<PrepareChatCinderPeerChangesetOptions> {
  const changesetDirectory = await mkdtemp(join(tmpdir(), 'prepare-chat-cinder-peer-'));
  temporaryRoots.push(changesetDirectory);
  await Promise.all(
    Object.entries(files).map(([filename, content]) =>
      writeFile(join(changesetDirectory, filename), content),
    ),
  );
  return { changesetDirectory };
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
    ).toBe(SYNTHETIC_CHANGESET_CONTENT());
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

  test('writes for a stable Cinder major', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-major.md': changeset('@lostgradient/cinder', 'major'),
    });
    const result = await prepareChatCinderPeerChangeset({ ...fixture, cinderVersion: '1.2.0' });
    expect(result.written).toBe(true);
    expect(
      await Bun.file(join(fixture.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME)).text(),
    ).toBe(SYNTHETIC_CHANGESET_CONTENT('major'));
  });

  test('does not write when Chat already has a pending changeset', async () => {
    const fixture = await makeChangesetFixture({
      'cinder-minor.md': changeset('@lostgradient/cinder', 'minor'),
      'chat-patch.md': changeset('@lostgradient/chat', 'patch'),
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
