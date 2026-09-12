import { readPinnedBunVersion } from './update-snapshots-docker.ts';

/**
 * Bun has no corepack equivalent, so nothing enforces that a contributor's
 * local Bun matches the workspace's `packageManager` pin the way CI's
 * `setup-bun` step (and `pinned-bun-version.test.ts`) enforces it there. That
 * gap let a change get validated locally on Bun 1.4.2 against a tree pinned
 * to Bun 1.4.0 and report a green `validate` that CI then contradicted —
 * Svelte coverage measures differently under the two Bun versions (see
 * `coverage-ratchet.json`'s `svelteMeasuredOn` note).
 *
 * This is deliberately warn-only, never a hard failure:
 *
 *   - CI already hard-enforces the exact pin end to end (`setup-bun` steps
 *     plus `pinned-bun-version.test.ts`), so a local mismatch is always
 *     caught before merge regardless of what happens here.
 *   - A hard failure here would instead block every local command that reads
 *     it — `validate`, `test:coverage`, anything — for any contributor whose
 *     Bun has drifted even slightly, which is a worse failure mode than a
 *     warning someone might miss: it stops all local work rather than
 *     flagging that one number needs a second look against CI.
 */
export function localBunVersionNotice(
  actualVersion: string,
  pinnedVersion: string = readPinnedBunVersion(),
): string | undefined {
  if (actualVersion === pinnedVersion) return undefined;
  return [
    `NOTE: this run is on Bun ${actualVersion}, but the workspace pins Bun ${pinnedVersion}`,
    `("packageManager" in the root package.json; CI enforces this exactly via setup-bun).`,
    'Coverage numbers—the Svelte ratchet especially—can differ by Bun version.',
    "Treat this run's numbers as informational only; CI on the pinned Bun version is authoritative.",
  ].join(' ');
}
