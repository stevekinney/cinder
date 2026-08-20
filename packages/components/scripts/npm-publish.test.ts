import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { resolveNpmPublishCommand } from './npm-publish.mjs';

describe('npm-publish', () => {
  test('runs the workflow-provisioned npm CLI with the same Node runtime', () => {
    expect(
      resolveNpmPublishCommand({
        nodeExecutable: '/opt/node/bin/node',
        npmCliPath: '/opt/node/lib/node_modules/npm/bin/npm-cli.js',
        publishArguments: ['publish', 'package.tgz'],
      }),
    ).toEqual({
      command: '/opt/node/bin/node',
      arguments: ['/opt/node/lib/node_modules/npm/bin/npm-cli.js', 'publish', 'package.tgz'],
    });
  });

  test('uses the platform npm executable outside release workflows', () => {
    expect(
      resolveNpmPublishCommand({
        nodeExecutable: '/opt/node/bin/node',
        npmCliPath: undefined,
        publishArguments: ['publish', 'package.tgz', '--dry-run'],
      }),
    ).toEqual({
      command: 'npm',
      arguments: ['publish', 'package.tgz', '--dry-run'],
    });
  });

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
