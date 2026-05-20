#!/usr/bin/env bun
import { $ } from 'bun';

import { error, header, info, isContinuousIntegration, success, warning } from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

header('Pre-push: bun run validate (working tree)');
warning('Validates the current working tree, not the exact commit range being pushed.');

try {
  await $`bun run validate`;
  success('Pre-push validation passed');
  process.exit(0);
} catch {
  error(
    'Validation failed; push aborted. Use git push --no-verify only as a deliberate emergency bypass.',
  );
  process.exit(1);
}
