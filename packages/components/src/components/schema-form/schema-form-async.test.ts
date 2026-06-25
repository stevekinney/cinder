import { describe, expect, test } from 'bun:test';

describe('SchemaForm async JSON Schema validation', () => {
  test('awaits async submit validation and freezes edits until it resolves', async () => {
    const { resolve } = await import('node:path');
    const fixturePath = resolve(import.meta.dir, 'schema-form-async.fixture.ts');
    const repositoryRoot = resolve(import.meta.dir, '../../../../..');

    const result = Bun.spawnSync({
      cmd: ['bun', 'test', '--conditions', 'browser', '--conditions', 'svelte', fixturePath],
      cwd: repositoryRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdout = new TextDecoder().decode(result.stdout);
    const stderr = new TextDecoder().decode(result.stderr);
    expect(result.exitCode, `${stdout}\n${stderr}`).toBe(0);
  });
});
