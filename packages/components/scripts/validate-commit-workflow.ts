/**
 * validate-commit-workflow.ts
 *
 * Simulates the part of the pre-commit hook that processes staged files via lint-staged
 * (Prettier, oxlint, prettier-plugin-svelte). Does NOT exercise the full husky/pre-commit.ts
 * — that script runs `bun run lint:fix`, `typecheck`, `test`, then lint-staged against the
 * live working tree; simulating all of those would mean re-running every CI step inside a
 * tmp repo. Instead we verify the step most at risk from Phase 1 config changes: that
 * .svelte + .css staged files get reformatted through the real repo's lint-staged config.
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
const repositoryRoot = resolve(scriptDirectory, '..');
// Config files (.prettierrc.json, .oxlintrc.json, bunfig.toml, tsconfig.json) live at the
// workspace root (two levels above scripts/), not inside packages/components/.
const workspaceRoot = resolve(repositoryRoot, '../..');
const simulationDirectory = join(repositoryRoot, `tmp/commit-sim-${randomUUID()}`);

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

/**
 * The real oxlintrc relies on `no-restricted-syntax` — an eslint-core rule that oxlint's
 * plugin resolver picks up via an implicit `eslint` plugin. That implicit plugin isn't
 * reliably present when oxlint is invoked from the sim's node_modules path. Strip the
 * rule so the sim validates formatting-plugin plumbing (prettier, prettier-plugin-svelte)
 * without the broader oxlint rule surface. The real repo's lint is verified separately
 * via `bun run lint`.
 */
function stripOxlintRulesForSimulation(oxlintConfigRaw: string): string {
  const parsed: unknown = JSON.parse(oxlintConfigRaw);
  if (!isObjectRecord(parsed)) {
    fail('oxlintrc is not a JSON object');
  }
  const rules = parsed['rules'];
  if (isObjectRecord(rules)) {
    delete rules['no-restricted-syntax'];
  }
  return JSON.stringify(parsed, null, 2);
}

function loadRealPackageManifestSlice(): PackageManifestSlice {
  const raw = readFileSync(join(repositoryRoot, 'package.json'), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!isObjectRecord(parsed)) fail('package.json is not an object');
  const lintStagedEntries = parsed['lint-staged'];
  const developmentDependencies = parsed['devDependencies'];
  if (!isStringArrayRecord(lintStagedEntries)) {
    fail('real package.json lint-staged is malformed');
  }
  if (!isStringRecord(developmentDependencies)) {
    fail('real package.json devDependencies is malformed');
  }
  return {
    'lint-staged': lintStagedEntries,
    devDependencies: developmentDependencies,
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
    'oxlint',
    'oxlint-tsgolint',
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

  // Mirror the real config files so oxlint + prettier see exactly what the repo ships with.
  // These live at workspaceRoot, not repositoryRoot (packages/components/).
  const prettierConfig = await readFileAsText(join(workspaceRoot, '.prettierrc.json'));
  const oxlintConfig = await readFileAsText(join(workspaceRoot, '.oxlintrc.json'));
  const bunfigConfig = await readFileAsText(join(workspaceRoot, 'bunfig.toml'));
  const typescriptConfig = await readFileAsText(join(repositoryRoot, 'tsconfig.json'));
  const typescriptBaseConfig = await readFileAsText(join(workspaceRoot, 'tsconfig.base.json'));

  await Bun.write(join(simulationDirectory, '.prettierrc.json'), prettierConfig);
  await Bun.write(
    join(simulationDirectory, '.oxlintrc.json'),
    stripOxlintRulesForSimulation(oxlintConfig),
  );
  await Bun.write(join(simulationDirectory, 'bunfig.toml'), bunfigConfig);
  // tsconfig.json extends ../../tsconfig.base.json relative to packages/components/ — rewrite
  // the extends path to ./tsconfig.base.json so it resolves inside the isolated sim dir.
  await Bun.write(join(simulationDirectory, 'tsconfig.base.json'), typescriptBaseConfig);
  await Bun.write(
    join(simulationDirectory, 'tsconfig.json'),
    typescriptConfig.replace('"../../tsconfig.base.json"', '"./tsconfig.base.json"'),
  );
  // Critical: keep node_modules + bun.lock out of `git add .`. Without this the sim stages
  // thousands of files, lint-staged walks them all, and sort-package-json / oxlint thrash on
  // upstream package.json files that don't belong to the sim.
  await Bun.write(join(simulationDirectory, '.gitignore'), 'node_modules/\nbun.lock\n');

  const realManifest = loadRealPackageManifestSlice();
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
  // Phase 1: a .svelte file (requires prettier-plugin-svelte), a .ts file under src/ (oxlint
  // + prettier), and a .css file (prettier).
  const unformattedSvelte = `<script lang="ts">let name='world'</script><p>hello {name}</p>\n`;
  const unformattedCss = `.sim-test   {color:red;  background:blue}\n`;
  // Deliberately mis-formatted with spacing, unsorted import order, and compressed semicolons.
  // No unused identifiers — those would trip oxlint and obscure the formatting signal.
  const unformattedTypescript = `import{readFile}from"node:fs/promises";import{join}from"node:path";export const   x=await readFile(join("/etc","hosts"),"utf8");\n`;
  mkdirSync(join(simulationDirectory, 'src'), { recursive: true });
  await Bun.write(join(simulationDirectory, 'src/sim.svelte'), unformattedSvelte);
  await Bun.write(join(simulationDirectory, 'src/sim.css'), unformattedCss);
  await Bun.write(join(simulationDirectory, 'src/sim.ts'), unformattedTypescript);

  await $`git add .`.cwd(simulationDirectory).quiet();

  const lintStagedResult = await $`bun exec lint-staged`.cwd(simulationDirectory).nothrow();
  if (lintStagedResult.exitCode !== 0) {
    const combinedOutput = lintStagedResult.stdout.toString() + lintStagedResult.stderr.toString();
    fail(`lint-staged failed with exit ${lintStagedResult.exitCode}:\n${combinedOutput}`);
  }

  const formattedSvelte = await readFileAsText(join(simulationDirectory, 'src/sim.svelte'));
  const formattedCss = await readFileAsText(join(simulationDirectory, 'src/sim.css'));
  const formattedTypescript = await readFileAsText(join(simulationDirectory, 'src/sim.ts'));

  if (formattedSvelte === unformattedSvelte) {
    fail(`prettier did not reformat the .svelte file — prettier-plugin-svelte not loaded?`);
  }
  if (formattedCss === unformattedCss) {
    fail(`prettier did not reformat the .css file`);
  }
  if (formattedTypescript === unformattedTypescript) {
    fail(`prettier did not reformat the .ts file — src/** glob not matching?`);
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
