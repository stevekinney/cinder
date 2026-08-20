import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function resolveNpmPublishCommand({ nodeExecutable, npmCliPath, publishArguments }) {
  return npmCliPath
    ? { command: nodeExecutable, arguments: [npmCliPath, ...publishArguments] }
    : { command: 'npm', arguments: publishArguments };
}

function main() {
  const publishArguments = process.argv.slice(2);
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
  const invocation = resolveNpmPublishCommand({
    nodeExecutable: process.execPath,
    npmCliPath: process.env.CINDER_PUBLISH_NPM_CLI,
    publishArguments,
  });
  const result = spawnSync(invocation.command, invocation.arguments, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NPM_CONFIG_PROVENANCE: process.env.NPM_CONFIG_PROVENANCE ?? 'true',
    },
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
