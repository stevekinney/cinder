#!/usr/bin/env bun
import { $ } from 'bun';

import {
  error,
  header,
  info,
  isContinuousIntegration,
  REPO_ROOT,
  success,
  warning,
} from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

header('Pre-push: bun run validate (working tree)');
warning('Validates the current working tree, not the exact commit range being pushed.');

try {
  await $`bun run validate`.cwd(REPO_ROOT);
  success('Pre-push validation passed');
  process.exit(0);
} catch {
  error('Validation failed; push aborted.');
  error('This hook validates the working tree — uncommitted changes count.');
  error('Run `bun run validate` locally, fix the failures, and push again.');
  process.exit(1);
}
