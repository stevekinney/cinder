import parseChangeset from '@changesets/parse';
import { Glob } from 'bun';
import { join } from 'node:path';
import { isPreRelease } from './check-changeset-prerelease-bumps.ts';

const CINDER_PACKAGE_NAME = '@lostgradient/cinder';
const CHAT_PACKAGE_NAME = '@lostgradient/chat';
const RELEASE_TYPE_PRIORITY = { patch: 0, minor: 1, major: 2 } as const;

type ReleaseType = keyof typeof RELEASE_TYPE_PRIORITY;

export const SYNTHETIC_CHANGESET_FILENAME = 'reconcile-chat-cinder-peer.md';
export const SYNTHETIC_CHANGESET_CONTENT = (releaseType: 'minor' | 'major') => `---
'@lostgradient/chat': ${releaseType}
---

Widen the @lostgradient/cinder peer range to follow the Cinder release.
`;

export type PrepareChatCinderPeerChangesetOptions = {
  changesetDirectory: string;
  chatManifestPath: string;
};

export type PrepareChatCinderPeerChangesetResult = {
  written: boolean;
};

/** Return the smallest Chat bump allowed for a peer-range narrowing. */
export function requiredChatPeerReconciliationBump(chatVersion: string): 'minor' | 'major' {
  return isPreRelease(chatVersion) ? 'minor' : 'major';
}

async function readChatVersion(manifestPath: string): Promise<string> {
  const manifest: unknown = await Bun.file(manifestPath).json();
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('version' in manifest) ||
    typeof manifest.version !== 'string' ||
    manifest.version.length === 0
  ) {
    throw new Error(`Chat manifest at ${manifestPath} must define a non-empty string version.`);
  }
  return manifest.version;
}

/** Add the Chat changeset needed when a pending Cinder release narrows its peer range. */
export async function prepareChatCinderPeerChangeset(
  options: PrepareChatCinderPeerChangesetOptions,
): Promise<PrepareChatCinderPeerChangesetResult> {
  let cinderMinorOrMajorPending = false;
  let highestChatReleaseType: ReleaseType | null = null;
  const changesetGlob = new Glob('*.md');

  for await (const relativePath of changesetGlob.scan({ cwd: options.changesetDirectory })) {
    if (relativePath === 'README.md') continue;

    const source = await Bun.file(join(options.changesetDirectory, relativePath)).text();
    for (const release of parseChangeset(source).releases) {
      if (
        release.name === CHAT_PACKAGE_NAME &&
        (release.type === 'patch' || release.type === 'minor' || release.type === 'major')
      ) {
        const releaseType = release.type;
        if (
          highestChatReleaseType === null ||
          RELEASE_TYPE_PRIORITY[releaseType] > RELEASE_TYPE_PRIORITY[highestChatReleaseType]
        ) {
          highestChatReleaseType = releaseType;
        }
      }
      if (
        release.name === CINDER_PACKAGE_NAME &&
        (release.type === 'minor' || release.type === 'major')
      ) {
        cinderMinorOrMajorPending = true;
      }
    }
  }

  const requiredBump = requiredChatPeerReconciliationBump(
    await readChatVersion(options.chatManifestPath),
  );
  const chatPendingSatisfiesRequiredBump =
    highestChatReleaseType !== null &&
    RELEASE_TYPE_PRIORITY[highestChatReleaseType] >= RELEASE_TYPE_PRIORITY[requiredBump];

  if (!cinderMinorOrMajorPending || chatPendingSatisfiesRequiredBump) return { written: false };

  const syntheticChangesetPath = join(options.changesetDirectory, SYNTHETIC_CHANGESET_FILENAME);
  if (await Bun.file(syntheticChangesetPath).exists()) return { written: false };

  await Bun.write(syntheticChangesetPath, SYNTHETIC_CHANGESET_CONTENT(requiredBump));
  return { written: true };
}

async function main(): Promise<void> {
  const workspaceRoot = join(import.meta.dir, '..', '..', '..');
  const result = await prepareChatCinderPeerChangeset({
    changesetDirectory: join(workspaceRoot, '.changeset'),
    chatManifestPath: join(workspaceRoot, 'packages', 'chat', 'package.json'),
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
