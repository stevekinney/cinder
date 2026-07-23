import { Glob } from 'bun';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonFile } from './lib/read-json-file.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptDirectory, '..');
const workspaceRoot = join(packageRoot, '..', '..');

export const sveltePeerContract = {
  minimum: '5.56.0',
  workspace: '~5.56.0',
  // Keep the upper-edge fixture exact: broad `^5` resolution is pathological
  // in Bun when both packed public packages contribute peer constraints.
  latest: '5.56.6',
  peerRange: '>=5.56.0 <6',
  legacyPeerRange: '>=5.55.0 <6',
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
  const requiredDocumentationFiles = [
    'README.md',
    'packages/chat/README.md',
    'packages/components/AGENTS.md',
    'docs/theming.md',
  ] as const;
  for (const relativePath of requiredDocumentationFiles) {
    const content = await Bun.file(join(workspaceRoot, relativePath)).text();
    if (!content.includes(sveltePeerContract.peerRange)) {
      fail(
        `${relativePath} does not document the Svelte peer range ${sveltePeerContract.peerRange}`,
      );
    }
    if (!content.includes(sveltePeerContract.minimum)) {
      fail(
        `${relativePath} does not document the minimum Svelte version ${sveltePeerContract.minimum}`,
      );
    }
  }

  const documentationGlob = new Glob(
    '{README.md,docs/**/*.md,packages/chat/README.md,packages/components/AGENTS.md}',
  );
  for await (const relativePath of documentationGlob.scan({ cwd: workspaceRoot })) {
    const content = await Bun.file(join(workspaceRoot, relativePath)).text();
    if (content.includes(sveltePeerContract.legacyPeerRange)) {
      fail(
        `${relativePath} still documents the old Svelte peer range ${sveltePeerContract.legacyPeerRange}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const packageManifestPaths = [
    'packages/chat/package.json',
    'packages/components/package.json',
    'packages/editor/package.json',
  ] as const;
  for (const relativePath of packageManifestPaths) {
    const manifest = await readJsonFile<PackageManifest>(join(workspaceRoot, relativePath));
    const peerRange = manifest.peerDependencies?.['svelte'];
    const devRange = manifest.devDependencies?.['svelte'];
    if (peerRange !== sveltePeerContract.peerRange) {
      fail(
        `${relativePath} peerDependencies.svelte is ${peerRange ?? '<missing>'}; expected ${sveltePeerContract.peerRange}`,
      );
    }
    if (devRange !== sveltePeerContract.workspace) {
      fail(
        `${relativePath} devDependencies.svelte is ${devRange ?? '<missing>'}; expected ${sveltePeerContract.workspace}`,
      );
    }
  }

  const componentsManifest = await readJsonFile<ComponentsManifest>(
    join(packageRoot, 'components.json'),
  );
  const frameworkVersionRange = componentsManifest.package?.frameworkVersionRange;
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
