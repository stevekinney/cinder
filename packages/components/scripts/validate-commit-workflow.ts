/**
 * validate-commit-workflow.ts
 *
 * Simulates the part of the pre-commit hook that processes staged files via lint-staged
 * (Prettier, prettier-plugin-svelte, and sort-package-json). Does NOT exercise the full
 * husky/pre-commit.ts — that script also checks lockfile staging against the live working
 * tree; simulating that would mean mutating a developer's index. Instead we verify the staged
 * formatting pipeline against the real repo's lint-staged config.
 *
 * The real repo's lint-staged globs + devDep slice are copied into an isolated tmp git repo
 * so a developer's live index is never touched.
 */
import { $ } from 'bun';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isObjectRecord } from './validation-utilities.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
// Workspace root is two levels above packages/components/scripts/.
const workspaceRoot = resolve(packageRoot, '../..');
const simulationDirectory = join(packageRoot, `tmp/commit-sim-${randomUUID()}`);

function fail(message: string): never {
  process.stderr.write(`[validate-commit-workflow] ${message}\n`);
  process.exit(1);
}

async function readFileAsText(path: string): Promise<string> {
  return Bun.file(path).text();
}

type PackageManifestSlice = {
  'lint-staged': Record<string, string[]>;
  devDependencies: Record<string, string>;
};

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every((entry) => typeof entry === 'string');
}

function isStringArrayRecord(value: unknown): value is Record<string, string[]> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every(
    (entry) => Array.isArray(entry) && entry.every((item) => typeof item === 'string'),
  );
}

function loadRealPackageManifestSlice(): PackageManifestSlice {
  // Read lint-staged from workspace root — that's what the actual pre-commit hook uses
  // (bun exec lint-staged runs from repo root, reading root package.json).
  const rootRaw = readFileSync(join(workspaceRoot, 'package.json'), 'utf8');
  const rootParsed: unknown = JSON.parse(rootRaw);
  if (!isObjectRecord(rootParsed)) fail('workspace root package.json is not an object');
  const lintStagedEntries = rootParsed['lint-staged'];
  if (!isStringArrayRecord(lintStagedEntries)) {
    fail('workspace root package.json lint-staged is malformed');
  }

  // devDependencies for the sim come from workspace root (where the formatters live).
  const rootDevDeps = rootParsed['devDependencies'];
  // Also pull in component-package devDeps for package-local formatting plugins.
  const pkgRaw = readFileSync(join(packageRoot, 'package.json'), 'utf8');
  const pkgParsed: unknown = JSON.parse(pkgRaw);
  if (!isObjectRecord(pkgParsed)) fail('packages/components/package.json is not an object');
  const pkgDevDeps = pkgParsed['devDependencies'];
  const mergedDevDeps = {
    ...(isStringRecord(pkgDevDeps) ? pkgDevDeps : {}),
    ...(isStringRecord(rootDevDeps) ? rootDevDeps : {}),
  };

  return {
    'lint-staged': lintStagedEntries,
    devDependencies: mergedDevDeps,
  };
}

/** Pick only the devDeps lint-staged actually needs so `bun install` in the tmp repo stays fast. */
function pruneDevelopmentDependencies(
  developmentDependencies: Record<string, string>,
): Record<string, string> {
  const requiredPackageNames = [
    'prettier',
    'prettier-plugin-organize-imports',
    'prettier-plugin-svelte',
    'lint-staged',
    'sort-package-json',
    'svelte',
    'typescript',
  ];
  const pruned: Record<string, string> = {};
  for (const packageName of requiredPackageNames) {
    const versionSpecifier = developmentDependencies[packageName];
    if (versionSpecifier !== undefined) {
      pruned[packageName] = versionSpecifier;
    }
  }
  return pruned;
}

process.stdout.write(
  `[validate-commit-workflow] seeding isolated repo at ${simulationDirectory}\n`,
);
mkdirSync(simulationDirectory, { recursive: true });

try {
  await $`git init --initial-branch=main`.cwd(simulationDirectory).quiet();
  await $`git config user.email sim@local`.cwd(simulationDirectory).quiet();
  await $`git config user.name commit-sim`.cwd(simulationDirectory).quiet();

  // Mirror the real formatter configuration so the simulation sees exactly what the repo ships.
  const prettierConfig = await readFileAsText(join(workspaceRoot, '.prettierrc.json'));

  await Bun.write(join(simulationDirectory, '.prettierrc.json'), prettierConfig);
  // Critical: keep node_modules + bun.lock out of `git add .`. Without this the sim stages
  // thousands of files, lint-staged walks them all, and formatters thrash on
  // upstream package.json files that don't belong to the sim.
  await Bun.write(join(simulationDirectory, '.gitignore'), 'node_modules/\nbun.lock\n');

  const realManifest = loadRealPackageManifestSlice();

  // Workspace root lint-staged uses globs like `packages/components/src/**/*.{ts,...}`.
  // Create sim files at matching paths so the globs actually fire.
  const simulationPackageManifest = {
    name: 'commit-sim',
    private: true,
    type: 'module',
    'lint-staged': realManifest['lint-staged'],
    devDependencies: pruneDevelopmentDependencies(realManifest.devDependencies),
  };
  await Bun.write(
    join(simulationDirectory, 'package.json'),
    JSON.stringify(simulationPackageManifest, null, 2),
  );

  const installResult = await $`bun install`.cwd(simulationDirectory).nothrow().quiet();
  if (installResult.exitCode !== 0) fail(`bun install failed in isolated repo`);

  // Deliberately mis-formatted files that exercise every lint-staged glob relevant to
  // the workspace: a .svelte file (requires prettier-plugin-svelte), a .ts file under
  // packages/components/src/, and a .css file (all through prettier).
  // The paths must match the workspace-root lint-staged globs exactly.
  const unformattedSvelte = `<script lang="ts">let name='world'</script><p>hello {name}</p>\n`;
  const unformattedCss = `.sim-test   {color:red;  background:blue}\n`;
  // Deliberately mis-formatted with spacing, unsorted import order, and compressed semicolons.
  const unformattedTypescript = `import{readFile}from"node:fs/promises";import{join}from"node:path";export const   x=await readFile(join("/etc","hosts"),"utf8");\n`;
  // Match the workspace-root lint-staged glob: packages/components/src/**/*.{ts,...}
  mkdirSync(join(simulationDirectory, 'packages/components/src'), { recursive: true });
  await Bun.write(
    join(simulationDirectory, 'packages/components/src/sim.svelte'),
    unformattedSvelte,
  );
  await Bun.write(join(simulationDirectory, 'packages/components/src/sim.css'), unformattedCss);
  await Bun.write(
    join(simulationDirectory, 'packages/components/src/sim.ts'),
    unformattedTypescript,
  );

  await $`git add .`.cwd(simulationDirectory).quiet();

  const lintStagedResult = await $`bun exec lint-staged`.cwd(simulationDirectory).nothrow();
  if (lintStagedResult.exitCode !== 0) {
    const combinedOutput = lintStagedResult.stdout.toString() + lintStagedResult.stderr.toString();
    fail(`lint-staged failed with exit ${lintStagedResult.exitCode}:\n${combinedOutput}`);
  }

  const formattedSvelte = await readFileAsText(
    join(simulationDirectory, 'packages/components/src/sim.svelte'),
  );
  const formattedCss = await readFileAsText(
    join(simulationDirectory, 'packages/components/src/sim.css'),
  );
  const formattedTypescript = await readFileAsText(
    join(simulationDirectory, 'packages/components/src/sim.ts'),
  );

  if (formattedSvelte === unformattedSvelte) {
    fail(`prettier did not reformat the .svelte file — prettier-plugin-svelte not loaded?`);
  }
  if (formattedCss === unformattedCss) {
    fail(`prettier did not reformat the .css file`);
  }
  if (formattedTypescript === unformattedTypescript) {
    fail(`prettier did not reformat the .ts file — packages/components/src/** glob not matching?`);
  }
  if (!formattedSvelte.includes(`'world'`) && !formattedSvelte.includes(`"world"`)) {
    fail(`.svelte file has unexpected content after format:\n${formattedSvelte}`);
  }

  process.stdout.write(
    '[validate-commit-workflow] lint-staged formatted .svelte + .css + .ts. PASS.\n',
  );
} finally {
  rmSync(simulationDirectory, { recursive: true, force: true });
}
