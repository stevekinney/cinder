import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolvePath(here, '..');
const repoRoot = resolvePath(packageRoot, '../..');

type PackageManifest = { packageManager?: string };

/**
 * The Bun the workspace pins, taken from the root `packageManager` field.
 *
 * Vendored from the visual-regression harness's `update-snapshots-docker.ts`
 * (COR-1196 retired that harness) rather than imported from it: this is the
 * only piece that harness that a kept, target-owned check still needs, and
 * pulling in the whole docker/snapshot module graph for one 15-line function
 * would have kept the rest of the doomed harness alive by accident.
 */
export function readPinnedBunVersion(): string {
  const raw = readFileSync(resolvePath(repoRoot, 'package.json'), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  const field =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as PackageManifest).packageManager
      : undefined;
  // Checked rather than assumed: a `packageManager` that is present but not a
  // string would make `.match` throw a TypeError, replacing the explicit
  // message below with something a reader has to decode.
  const pinned = typeof field === 'string' ? field : undefined;
  const match = pinned?.match(/^bun@(\d+\.\d+\.\d+)$/);
  if (!match?.[1]) {
    throw new Error(
      `packageManager must pin an exact Bun version (bun@x.y.z) in the workspace package.json; got ${pinned ?? 'undefined'}`,
    );
  }
  return match[1];
}

/**
 * Bun has no corepack equivalent, so nothing enforces that a contributor's
 * local Bun matches the workspace's `packageManager` pin the way CI's
 * `setup-bun` step enforces it there. That
 * gap let a change get validated locally on Bun 1.4.2 against a tree pinned
 * to Bun 1.4.0 and report a green `validate` that CI then contradicted —
 * Svelte coverage measures differently under the two Bun versions (see
 * `coverage-ratchet.json`'s `svelteMeasuredOn` note).
 *
 * This is deliberately warn-only, never a hard failure:
 *
 *   - CI already enforces the exact pin through its `setup-bun` steps, so a local mismatch is
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

if (import.meta.main) {
  const notice = localBunVersionNotice(Bun.version);
  if (notice !== undefined) console.warn(notice);
}
