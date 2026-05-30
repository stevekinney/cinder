/// <reference lib="dom" />
import { resolve as resolvePath } from 'node:path';

import { describe, expect, test } from 'bun:test';

// Integration test: exercises the REAL `cinder/highlighters/shiki` adapter
// through CodeBlock's default-highlighter seam (no module mock). The fast unit
// suite in `code-block.test.ts` mocks this seam for determinism — and because
// Bun's `mock.module` is process-global, that mock would leak into this file
// if both ran in the same process. So we run the real seam in a CLEAN child
// process (mirroring the SSR-render harness) to prove it is actually wired to
// a working Shiki highlighter and honors the escape contract cinder's `{@html}`
// boundary depends on.

const SEAM_PATH = resolvePath(import.meta.dir, 'code-block-default-highlighter.ts');
const REPOSITORY_ROOT = resolvePath(import.meta.dir, '../../../../../');

function runSeamProbe(): { exitCode: number; stdout: string; stderr: string } {
  const script = `
    const { loadDefaultHighlighter } = await import(${JSON.stringify(SEAM_PATH)});
    const first = await loadDefaultHighlighter();
    const second = await loadDefaultHighlighter();
    const ts = await first('const x: number = 1;', 'typescript');
    const escaped = await first('<img src=x onerror=alert(1)>', 'html');
    process.stdout.write(JSON.stringify({ memoized: first === second, ts, escaped }));
  `;
  const result = Bun.spawnSync({
    cmd: ['bun', '--conditions', 'browser', '--conditions', 'svelte', '-e', script],
    cwd: REPOSITORY_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}

describe('CodeBlock default-highlighter seam (real Shiki adapter)', () => {
  test('seam is wired to a real, memoized Shiki highlighter that escapes input', () => {
    const { exitCode, stdout, stderr } = runSeamProbe();
    expect(exitCode, stderr).toBe(0);
    const probe = JSON.parse(stdout) as { memoized: boolean; ts: string; escaped: string };

    // Same instance across calls (memoized once on first load).
    expect(probe.memoized).toBe(true);

    // Real Shiki tokenizes the TypeScript into styled spans inside a <pre>.
    expect(probe.ts.startsWith('<pre')).toBe(true);
    expect(probe.ts).toContain('</pre>');
    expect(probe.ts).toMatch(/<span[^>]*style=/);

    // The bundled default escapes code text — no live tag injected. Shiki
    // emits the `<` as an HTML entity (`&lt;` or `&#x3C;`) inside its spans.
    expect(probe.escaped).not.toContain('<img src=x onerror=alert(1)>');
    expect(probe.escaped.toLowerCase()).toMatch(/&lt;|&#x3c;|&#60;/);
  }, 30_000);
});
