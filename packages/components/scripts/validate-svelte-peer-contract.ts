import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonFile } from './lib/read-json-file.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptDirectory, '..');
const workspaceRoot = join(packageRoot, '..', '..');

export const sveltePeerContract = {
  minimum: '5.55.0',
  workspace: '~5.55.0',
  latest: '^5',
  peerRange: '>=5.55.0 <6',
} as const;

type PackageManifest = {
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type ComponentsManifest = {
  package?: {
    frameworkVersionRange?: string;
  };
};

function fail(message: string): never {
  throw new Error(message);
}

async function assertDocumentationMentionsContract(): Promise<void> {
  const readme = await Bun.file(join(workspaceRoot, 'README.md')).text();
  const agents = await Bun.file(join(packageRoot, 'AGENTS.md')).text();
  for (const [label, content] of [
    ['README.md', readme],
    ['packages/components/AGENTS.md', agents],
  ] as const) {
    if (!content.includes(sveltePeerContract.peerRange)) {
      fail(`${label} does not document the Svelte peer range ${sveltePeerContract.peerRange}`);
    }
    if (!content.includes(sveltePeerContract.minimum)) {
      fail(`${label} does not document the minimum Svelte version ${sveltePeerContract.minimum}`);
    }
  }
}

async function main(): Promise<void> {
  const manifest = await readJsonFile<PackageManifest>(join(packageRoot, 'package.json'));
  const componentsManifest = await readJsonFile<ComponentsManifest>(
    join(packageRoot, 'components.json'),
  );
  const peerRange = manifest.peerDependencies?.['svelte'];
  const devRange = manifest.devDependencies?.['svelte'];
  const frameworkVersionRange = componentsManifest.package?.frameworkVersionRange;
  if (peerRange !== sveltePeerContract.peerRange) {
    fail(
      `peerDependencies.svelte is ${peerRange ?? '<missing>'}; expected ${sveltePeerContract.peerRange}`,
    );
  }
  if (devRange !== sveltePeerContract.workspace) {
    fail(
      `devDependencies.svelte is ${devRange ?? '<missing>'}; expected ${sveltePeerContract.workspace}`,
    );
  }
  if (frameworkVersionRange !== sveltePeerContract.peerRange) {
    fail(
      `components.json package.frameworkVersionRange is ${frameworkVersionRange ?? '<missing>'}; expected ${sveltePeerContract.peerRange}`,
    );
  }
  await assertDocumentationMentionsContract();
  process.stdout.write(
    `svelte-peer-contract — OK (${sveltePeerContract.minimum}, workspace ${sveltePeerContract.workspace}, latest ${sveltePeerContract.latest}, peer ${sveltePeerContract.peerRange})\n`,
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `svelte-peer-contract failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
