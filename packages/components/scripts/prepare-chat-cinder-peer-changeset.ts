import parseChangeset from '@changesets/parse';
import { Glob } from 'bun';
import { join } from 'node:path';

const CINDER_PACKAGE_NAME = '@lostgradient/cinder';
const CHAT_PACKAGE_NAME = '@lostgradient/chat';

export const SYNTHETIC_CHANGESET_FILENAME = 'reconcile-chat-cinder-peer.md';
export const SYNTHETIC_CHANGESET_CONTENT = (releaseType: 'minor' | 'major' = 'minor') => `---
'@lostgradient/chat': ${releaseType}
---

Widen the @lostgradient/cinder peer range to follow the Cinder release.
`;

export type PrepareChatCinderPeerChangesetOptions = {
  changesetDirectory: string;
  cinderVersion?: string;
};

export type PrepareChatCinderPeerChangesetResult = {
  written: boolean;
};

/** Add the Chat patch changeset needed when Cinder's pre-1.0 minor moves. */
export async function prepareChatCinderPeerChangeset(
  options: PrepareChatCinderPeerChangesetOptions,
): Promise<PrepareChatCinderPeerChangesetResult> {
  let cinderMinorOrMajorPending = false;
  let chatPending = false;
  let chatReleaseType: 'minor' | 'major' = 'minor';
  const changesetGlob = new Glob('*.md');

  for await (const relativePath of changesetGlob.scan({ cwd: options.changesetDirectory })) {
    if (relativePath === 'README.md') continue;

    const source = await Bun.file(join(options.changesetDirectory, relativePath)).text();
    for (const release of parseChangeset(source).releases) {
      if (release.name === CHAT_PACKAGE_NAME) chatPending = true;
      if (
        release.name === CINDER_PACKAGE_NAME &&
        (release.type === 'minor' ||
          (release.type === 'major' && Number(options.cinderVersion?.split('.')[0] ?? 0) >= 1))
      ) {
        cinderMinorOrMajorPending = true;
        if (release.type === 'major') chatReleaseType = 'major';
      }
    }
  }

  if (!cinderMinorOrMajorPending || chatPending) return { written: false };

  const syntheticChangesetPath = join(options.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME);
  if (await Bun.file(syntheticChangesetPath).exists()) return { written: false };

  await Bun.write(syntheticChangesetPath, SYNTHETIC_CHANGESET_CONTENT(chatReleaseType));
  return { written: true };
}

async function main(): Promise<void> {
  const workspaceRoot = join(import.meta.dir, '..', '..', '..');
  const result = await prepareChatCinderPeerChangeset({
    changesetDirectory: join(workspaceRoot, '.changeset'),
    cinderVersion: JSON.parse(
      await Bun.file(join(workspaceRoot, 'packages/components/package.json')).text(),
    ).version,
  });

  if (result.written) {
    console.log(
      `prepare-chat-cinder-peer-changeset — wrote .changeset/${SYNTHETIC_CHANGESET_FILENAME}`,
    );
  } else {
    console.log('prepare-chat-cinder-peer-changeset — no change');
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error: unknown) {
    console.error(
      `prepare-chat-cinder-peer-changeset failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
