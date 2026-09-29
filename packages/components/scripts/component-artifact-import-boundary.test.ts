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

  it('keeps read-only checks separate from artifact generation', async () => {
    const source = await readScript('generate-component-artifacts.ts');
    const checkStart = source.indexOf('async function runCheckMode()');
    const generateStart = source.indexOf('async function runGenerateMode(');
    const mainStart = source.indexOf('async function main()');
    expect(checkStart).toBeGreaterThan(-1);
    expect(generateStart).toBeGreaterThan(checkStart);
    expect(mainStart).toBeGreaterThan(generateStart);
    const checkMode = source.slice(checkStart, generateStart);
    const generateMode = source.slice(generateStart, mainStart);
    expect(checkMode).not.toContain('writeArtifacts(');
    expect(generateMode).toContain('writeArtifacts(');
    expect(source.slice(mainStart)).toContain(
      "if (args.includes('--check')) return runCheckMode();",
    );
  });
});

describe('checkComponentArtifacts processing order', () => {
  it('processes components sequentially, never concurrently', async () => {
    // Regression guard for a false-positive `components:check` drift report.
    // `generateSchemaForComponent` type-checks each component's props type
    // against a shared, module-cached `ts-morph` `Project` (see
    // `generate-component-schema.ts`'s `getProject()`), reused across calls
    // to avoid reparsing common dependencies like `svelte/elements`. When
    // `checkComponentArtifacts` dispatched components through
    // `mapWithConcurrencyLimit` (concurrency 12), the resulting interleaved
    // `Project` mutations made TypeScript's checker enumerate at least one
    // component's intersection-type members (`input`, whose `id` is both
    // inherited from `HTMLInputAttributes` and redeclared as required) in a
    // non-deterministic order — producing a `stale` verdict in CI for a tree
    // with zero real drift, reproducible only under CI-like load, never
    // locally with `components:generate` (always sequential). A plain
    // sequential loop makes the shared-`Project` processing order fixed and
    // matches `generate` mode exactly, eliminating the race. See
    // `checkComponentArtifacts` in `component-artifact-operations.ts`.
    const source = await readScript('component-artifact-operations.ts');

    expect(source).not.toContain('mapWithConcurrencyLimit');
    expect(source).toMatch(
      /export async function checkComponentArtifacts[\s\S]*?for \(const component of components\) \{/,
    );
  });
});
