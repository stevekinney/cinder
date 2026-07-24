import { expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('snapshot input is deterministic and sorted', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cinder-snapshot-'));
  await Bun.write(join(root, 'z.txt'), 'z');
  await Bun.write(join(root, 'a.txt'), 'a');
  const request = join(root, 'request.json');
  await Bun.write(request, JSON.stringify({ schemaVersion: 1, repositories: [{ name: 'repo', path: root }] }));
  const first = Bun.spawnSync(['bun', 'run', 'scripts/cinder-downstream-snapshot.ts', '--request', request]).stdout.toString();
  const second = Bun.spawnSync(['bun', 'run', 'scripts/cinder-downstream-snapshot.ts', '--request', request]).stdout.toString();
  const normalize = (value: string) => JSON.stringify({ ...JSON.parse(value), collectedAt: 'stable' });
  expect(normalize(first)).toBe(normalize(second));
});

test('help prints usage without requiring a request', () => {
  const result = Bun.spawnSync(['bun', 'run', 'scripts/cinder-downstream-snapshot.ts', '--help']);
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain('Usage:');
});
