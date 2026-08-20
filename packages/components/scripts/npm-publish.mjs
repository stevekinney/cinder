import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const publishArguments = process.argv.slice(2);
const npmCliPath =
  process.env.CINDER_PUBLISH_NPM_CLI ??
  join(dirname(dirname(process.execPath)), 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');

if (publishArguments[0] !== 'publish') {
  throw new Error('npm-publish only accepts npm publish arguments.');
}

process.stdout.write(
  `publish-release — Node ${process.version} executing npm ${publishArguments.join(' ')}\n`,
);

// Do not spawn the `npm` executable by name: its `env node` shebang can select
// Bun's PATH-preferred Node instead of the Node runtime that owns provenance.
const result = spawnSync(process.execPath, [npmCliPath, ...publishArguments], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NPM_CONFIG_PROVENANCE: process.env.NPM_CONFIG_PROVENANCE ?? 'true',
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
