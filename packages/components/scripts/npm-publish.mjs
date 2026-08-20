import { spawnSync } from 'node:child_process';

const publishArguments = process.argv.slice(2);

if (publishArguments[0] !== 'publish') {
  throw new Error('npm-publish only accepts npm publish arguments.');
}

process.stdout.write(
  `publish-release — Node ${process.version} executing npm ${publishArguments.join(' ')}\n`,
);

const result = spawnSync('npm', publishArguments, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NPM_CONFIG_PROVENANCE: process.env.NPM_CONFIG_PROVENANCE ?? 'true',
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
