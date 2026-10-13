/**
 * Write each workspace's manifest `peerDependencies` ranges into its `bun.lock` workspace entry.
 *
 * `changeset:version` widens internal peer ranges (`reconcile-internal-peers.ts`) after
 * Changesets bumps versions. Bun 1.4.2's `bun install --lockfile-only` updates a workspace's
 * `version` line but leaves its `peerDependencies` block stale, and the `--frozen-lockfile`
 * check that follows then re-resolves the whole graph. That fails the release and, when run
 * again, deduplicates unrelated development tooling (oxlint 1.56 → 1.86, which breaks package
 * lint). Rewriting exactly the stale peer values keeps the lockfile otherwise byte-identical, and
 * the frozen check that still runs afterwards proves the result is what Bun would accept.
 */
import { join } from 'node:path';

export type LockfilePeerUpdate = {
  workspace: string;
  dependencyName: string;
  previousRange: string;
  nextRange: string;
};

/** The text span of a `"key": { … }` object whose opening line is indented by `indent`. */
function objectSpan(text: string, key: string, indent: string, from = 0, to = text.length) {
  const opening = `\n${indent}${JSON.stringify(key)}: {`;
  const start = text.indexOf(opening, from);
  if (start === -1 || start >= to) return undefined;
  const end = text.indexOf(`\n${indent}}`, start + opening.length);
  if (end === -1 || end > to) return undefined;
  return { start, end };
}

/** A manifest's `peerDependencies` as name/range pairs, refusing anything that is not a string map. */
function peerEntries(manifest: unknown, workspace: string): Array<[string, string]> {
  if (typeof manifest !== 'object' || manifest === null) {
    throw new Error(`${workspace}/package.json is not a JSON object`);
  }
  const peers: unknown = Reflect.get(manifest, 'peerDependencies');
  if (peers === undefined) return [];
  if (typeof peers !== 'object' || peers === null) {
    throw new Error(`${workspace}/package.json peerDependencies is not an object`);
  }
  return Object.entries(peers).map(([name, range]: [string, unknown]) => {
    if (typeof range !== 'string') {
      throw new Error(`${workspace}/package.json peer ${JSON.stringify(name)} is not a string`);
    }
    return [name, range];
  });
}

/** Sync every workspace's peer ranges from its manifest into `bun.lock` under `root`. */
export async function syncLockfilePeerRanges(
  root: string,
): Promise<{ updates: LockfilePeerUpdate[] }> {
  const lockfilePath = join(root, 'bun.lock');
  let lockfile = await Bun.file(lockfilePath).text();
  const workspaces = objectSpan(lockfile, 'workspaces', '  ');
  if (workspaces === undefined) throw new Error('bun.lock has no "workspaces" object');

  const workspacePaths = [
    ...lockfile.slice(workspaces.start, workspaces.end).matchAll(/\n {4}"([^"]+)": \{/g),
  ]
    .map((match) => match[1] ?? '')
    .filter((path) => path !== '');
  const updates: LockfilePeerUpdate[] = [];

  for (const workspace of workspacePaths) {
    const manifest: unknown = await Bun.file(join(root, workspace, 'package.json')).json();
    const peers = peerEntries(manifest, workspace);
    if (peers.length === 0) continue;

    const current = objectSpan(lockfile, 'workspaces', '  ');
    const entry = current && objectSpan(lockfile, workspace, '    ', current.start, current.end);
    const block =
      entry && objectSpan(lockfile, 'peerDependencies', '      ', entry.start, entry.end);
    if (block === undefined) throw new Error(`${workspace} has no peerDependencies in bun.lock`);

    let section = lockfile.slice(block.start, block.end);
    for (const [dependencyName, nextRange] of peers) {
      const line = new RegExp(
        `(\\n {8}${JSON.stringify(dependencyName).replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}: )("[^"\\n]*")`,
      );
      const match = line.exec(section);
      if (match === null) {
        throw new Error(`${workspace} lists no ${JSON.stringify(dependencyName)} peer in bun.lock`);
      }
      const parsed: unknown = JSON.parse(match[2] ?? '""');
      if (typeof parsed !== 'string') {
        throw new Error(`${workspace} has a non-string ${JSON.stringify(dependencyName)} peer`);
      }
      const previousRange = parsed;
      if (previousRange === nextRange) continue;
      section = section.replace(line, `$1${JSON.stringify(nextRange)}`);
      updates.push({ workspace, dependencyName, previousRange, nextRange });
    }
    lockfile = lockfile.slice(0, block.start) + section + lockfile.slice(block.end);
  }

  if (updates.length > 0) await Bun.write(lockfilePath, lockfile);
  return { updates };
}

if (import.meta.main) {
  try {
    const root = join(import.meta.dir, '..', '..', '..');
    const { updates } = await syncLockfilePeerRanges(root);
    for (const update of updates) {
      console.log(
        `sync-lockfile-peer-ranges — ${update.workspace} ${update.dependencyName}: ${update.previousRange} → ${update.nextRange}`,
      );
    }
    if (updates.length === 0) console.log('sync-lockfile-peer-ranges — no change');
  } catch (error: unknown) {
    console.error(
      `sync-lockfile-peer-ranges failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
