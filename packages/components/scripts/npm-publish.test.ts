import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

describe('npm-publish', () => {
  test('runs under Node before it delegates to npm publish', () => {
    const nodeExecutable = Bun.which('node');
    expect(nodeExecutable).toBeDefined();
    const result = spawnSync(nodeExecutable!, [join(import.meta.dir, 'npm-publish.mjs')], {
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('only accepts npm publish arguments');
  });
});
