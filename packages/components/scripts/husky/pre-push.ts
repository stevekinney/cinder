#!/usr/bin/env bun
import {
  error,
  header,
  info,
  installHookProcessCleanup,
  isContinuousIntegration,
  REPO_ROOT,
  runHookCommand,
  success,
  warning,
  withGateLock,
} from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

installHookProcessCleanup();

header('Pre-push: lint + typecheck + test (working tree)');
warning('Validates the current working tree, not the exact commit range being pushed.');

let ok = false;
try {
  ok = await withGateLock(async () => {
    // Run lint, typecheck, and test — the three workspace-wide correctness gates.
    // `bun run validate` is intentionally excluded: it builds consumer fixtures
    // (sveltekit-consumer, node-consumer) that require release-ready builds and
    // may fail due to fixture-specific dependency constraints unrelated to code
    // changes. Those checks belong in CI, not the pre-push gate.
    let passed = true;
    for (const script of ['lint', 'typecheck', 'test'] as const) {
      info(`Running ${script}…`);
      const result = await runHookCommand('bun', ['run', script], {
        cwd: REPO_ROOT,
        stderr: 'inherit',
        stdout: 'inherit',
      });
      if (result.exitCode === 0) {
        success(`${script} passed`);
      } else {
        error(`${script} failed`);
        passed = false;
      }
    }
    return passed;
  });
} catch (caught) {
  error(caught instanceof Error ? caught.message : String(caught));
  process.exit(1);
}

if (!ok) {
  error('Pre-push validation failed.');
  error('This hook validates the working tree — uncommitted changes count.');
  error(
    'Run `bun run lint && bun run typecheck && bun run test`, fix the failures, and push again.',
  );
  process.exit(1);
}

success('Pre-push validation passed');
process.exit(0);
