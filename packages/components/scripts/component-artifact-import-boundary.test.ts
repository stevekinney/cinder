import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

const scriptsDirectory = import.meta.dir;

async function readScript(filename: string): Promise<string> {
  return await Bun.file(join(scriptsDirectory, filename)).text();
}

describe('component artifact import boundaries', () => {
  it('keeps discovery independent from artifact orchestration modules', async () => {
    const source = await readScript('discover-component-directories.ts');

    expect(source).not.toContain('./generate-component-artifacts.ts');
    expect(source).not.toContain('./component-artifact-operations.ts');
    expect(source).not.toContain('./generate-component-schema.ts');
    expect(source).not.toContain('./generate-component-variables.ts');
    expect(source).not.toContain('./generate-component-examples.ts');
    expect(source).not.toContain('./generate-manifest.ts');
  });

  it('does not re-export lightweight discovery from the heavy CLI entrypoint', async () => {
    const source = await readScript('generate-component-artifacts.ts');

    expect(source).not.toMatch(
      /export\s+(?:\*\s+from\s+['"].*discover-component-directories|(?:type\s+)?\{[^}]*discoverComponentDirectories)/s,
    );
    expect(source).not.toMatch(
      /export\s+(?:\*\s+from\s+['"].*component-artifact-operations|(?:async\s+function|(?:type\s+)?\{[^}]*checkComponentArtifacts))/s,
    );
  });
});
