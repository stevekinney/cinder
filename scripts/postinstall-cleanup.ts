#!/usr/bin/env bun
import path from 'node:path';

import { $ } from 'bun';
import chalk from 'chalk';

// Use import.meta.dir for reliable path resolution during bun create
const scriptsDir = import.meta.dir;
const projectRoot = path.dirname(scriptsDir);
const setupDir = path.join(scriptsDir, 'setup');
const pkgPath = path.join(projectRoot, 'package.json');

// 1) Remove scripts/setup directory
try {
  await $`rm -rf ${setupDir}`;
  console.log(chalk.green('Removed scripts/setup directory.'));
} catch (err) {
  console.error(chalk.red('Failed to remove scripts/setup:'), err);
  // Do not exit; continue to package.json cleanup
}

// 2) Remove "bun-create" entry from package.json
try {
  const raw = await Bun.file(pkgPath).text();
  const pkg = JSON.parse(raw);
  if (pkg['bun-create']) {
    delete pkg['bun-create'];
    await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(chalk.green('Removed "bun-create" entry from package.json.'));
  } else {
    console.log(chalk.gray('No "bun-create" entry present in package.json.'));
  }
} catch (err) {
  console.error(chalk.red('Failed to update package.json:'), err);
  process.exit(1);
}

// 3) Remove this script itself
const selfPath = path.join(scriptsDir, 'postinstall-cleanup.ts');
try {
  await $`rm -f ${selfPath}`;
  console.log(chalk.green('Removed postinstall-cleanup.ts.'));
} catch {
  // Ignore - may already be removed or running from different location
}
