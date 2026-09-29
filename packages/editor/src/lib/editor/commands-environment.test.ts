import { expect, test } from 'bun:test';

test.each([
  ['development', 'production', 'true'],
  ['production', 'development', 'false'],
])('command warnings follow the %s export condition', (condition, nodeEnvironment, expected) => {
  const result = Bun.spawnSync(
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
    { env: { ...process.env, NODE_ENV: nodeEnvironment } },
  );
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  expect(result.stdout.toString().trim()).toBe(expected);
});
