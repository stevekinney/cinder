import { spawnSync } from 'node:child_process';

const SNAPSHOT_DIRECTORY = 'packages/testing/snapshots/';
const PROVENANCE_PATH = `${SNAPSHOT_DIRECTORY}provenance.json`;

export function extractPorcelainPath(line: string): string[] {
  const trimmed = line.slice(3).trim();
  if (trimmed.includes(' -> ')) {
    return trimmed.split(' -> ').map((path) => path.replace(/^"|"$/g, ''));
  }
  return [trimmed.replace(/^"|"$/g, '')];
}

export function isMeaningfulSnapshotPath(path: string): boolean {
  return path.startsWith(SNAPSHOT_DIRECTORY) && path !== PROVENANCE_PATH && path.endsWith('.png');
}

export function hasMeaningfulSnapshotChanges(porcelain: string): boolean {
  return porcelain
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .some((line) => extractPorcelainPath(line).some(isMeaningfulSnapshotPath));
}

function readSnapshotStatus(): string {
  const result = spawnSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all', '--', 'packages/testing/snapshots'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`failed to inspect snapshot changes: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

if (import.meta.main) {
  try {
    const status = readSnapshotStatus();
    process.exit(hasMeaningfulSnapshotChanges(status) ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
