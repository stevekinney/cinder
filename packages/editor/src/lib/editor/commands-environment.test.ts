import { expect, test } from 'bun:test';

const cases = [
  ['development', 'production', 'true'],
  ['production', 'development', 'false'],
] as const;

// The export condition is fixed per process, so each case needs its own real Bun process. They run
// here at module scope, off the per-test clock, and the tests only assert.
const results = await Promise.all(
  cases.map(async ([condition, nodeEnvironment]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        '--conditions',
        condition,
        '--eval',
        // `process.stdout.write(String(…))`, not `console.log(boolean)`: Bun colors a
        // logged boolean whenever FORCE_COLOR is inherited, which wraps "true" in
        // ANSI escapes that compare unequal to the plain expected string.
        `import { shouldLogDevelopmentWarnings } from ${JSON.stringify(new URL('./commands.ts', import.meta.url).href)}; process.stdout.write(String(shouldLogDevelopmentWarnings()));`,
      ],
      {
        env: { ...process.env, NODE_ENV: nodeEnvironment },
        stdout: 'pipe',
        stderr: 'pipe',
        // A hang detector for a child that never exits, never a performance bound.
        timeout: 120_000,
      },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, exitCode };
  }),
);

test.each(cases.map((row, index) => [...row, index] as const))(
  'command warnings follow the %s export condition',
  (_condition, _nodeEnvironment, expected, index) => {
    const result = results[index];
    expect(result?.exitCode, result?.stderr).toBe(0);
    expect(result?.stdout.trim()).toBe(expected);
  },
);
