import { describe, expect, test } from 'bun:test';

const scriptPath = new URL('./check-no-bare-console-warn.ts', import.meta.url).pathname;

describe('check-no-bare-console-warn', () => {
  test('component source contains no bare console.warn (all route through devWarn)', async () => {
    const proc = Bun.spawn(['bun', 'run', scriptPath], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    // If this fails, stderr lists every offending file:line — replace the bare
    // console.warn with devWarn(...) from utilities/dev-warn.ts.
    expect(stderr, stderr).toBe('');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('OK');
  });
});
