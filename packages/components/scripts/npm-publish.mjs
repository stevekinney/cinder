import { spawnSync } from 'node:child_process';

const publishArguments = process.argv.slice(2);
const npmCliPath = process.env.CINDER_PUBLISH_NPM_CLI;

if (publishArguments[0] !== 'publish') {
  throw new Error('npm-publish only accepts npm publish arguments.');
}

process.stdout.write(
  `publish-release — Node ${process.version} executing npm ${publishArguments.join(' ')}\n`,
);

// Release workflows provide npm's CLI path so provenance uses the exact Node
// runtime provisioned by setup-node. Outside those workflows, preserve npm's
// platform-specific PATH resolution instead of guessing its installation
// layout.
const result = npmCliPath
  ? spawnSync(process.execPath, [npmCliPath, ...publishArguments], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NPM_CONFIG_PROVENANCE: process.env.NPM_CONFIG_PROVENANCE ?? 'true',
      },
      stdio: 'inherit',
    })
  : spawnSync('npm', publishArguments, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NPM_CONFIG_PROVENANCE: process.env.NPM_CONFIG_PROVENANCE ?? 'true',
      },
      stdio: 'inherit',
    });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
