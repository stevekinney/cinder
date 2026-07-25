/**
 * `@lostgradient/cinder-mcp` publishes a Node-only binary (`engines.node`, no
 * Bun engine). Every non-test file under `src/` must be safe to run under
 * plain Node — this scans for the two ways a Bun-only dependency could sneak
 * in: a `bun:*` module specifier, or a reference to the global `Bun` object.
 */
import { Glob } from 'bun';
import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

const srcDirectory = join(import.meta.dir, '..', 'src');

const BUN_IMPORT_PATTERN =
  /from\s+['"]bun(?::[^'"]*)?['"]|require\(\s*['"]bun(?::[^'"]*)?['"]\s*\)/;
const BUN_GLOBAL_PATTERN = /\bBun\./;

async function nonTestSourceFiles(): Promise<string[]> {
  const files: string[] = [];
  for await (const relative of new Glob('**/*.ts').scan({ cwd: srcDirectory })) {
    if (relative.endsWith('.test.ts') || relative.endsWith('.spec.ts')) continue;
    files.push(relative);
  }
  return files.sort();
}

describe('runtime boundary', () => {
  it('has non-test source files to check (guards against a silently-empty scan)', async () => {
    const files = await nonTestSourceFiles();
    expect(files.length).toBeGreaterThan(0);
  });

  it('never imports a bun: module specifier outside test files', async () => {
    const offenders: string[] = [];
    for (const relative of await nonTestSourceFiles()) {
      const content = await Bun.file(join(srcDirectory, relative)).text();
      if (BUN_IMPORT_PATTERN.test(content)) offenders.push(relative);
    }
    expect(offenders).toEqual([]);
  });

  it('never references the Bun global outside test files', async () => {
    const offenders: string[] = [];
    for (const relative of await nonTestSourceFiles()) {
      const content = await Bun.file(join(srcDirectory, relative)).text();
      if (BUN_GLOBAL_PATTERN.test(content)) offenders.push(relative);
    }
    expect(offenders).toEqual([]);
  });
});
