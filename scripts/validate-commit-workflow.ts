import { $ } from 'bun';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const TMP = join(ROOT, `tmp/commit-sim-${Date.now()}`);

function die(message: string): never {
  process.stderr.write(`[validate-commit-workflow] ${message}\n`);
  process.exit(1);
}

async function fileText(path: string): Promise<string> {
  return Bun.file(path).text();
}

process.stdout.write(`[validate-commit-workflow] seeding isolated repo at ${TMP}\n`);
mkdirSync(TMP, { recursive: true });

try {
  await $`git init --initial-branch=main`.cwd(TMP).quiet();
  await $`git config user.email sim@local`.cwd(TMP).quiet();
  await $`git config user.name commit-sim`.cwd(TMP).quiet();

  const prettierrc = await fileText(join(ROOT, '.prettierrc.json'));
  const oxlintrc = await fileText(join(ROOT, '.oxlintrc.json'));
  const bunfig = await fileText(join(ROOT, 'bunfig.toml'));

  await Bun.write(join(TMP, '.prettierrc.json'), prettierrc);
  await Bun.write(join(TMP, '.oxlintrc.json'), oxlintrc);
  await Bun.write(join(TMP, 'bunfig.toml'), bunfig);

  const simPackageJson = {
    name: 'commit-sim',
    private: true,
    type: 'module',
    scripts: {},
    'lint-staged': {
      'src/**/*.{ts,tsx}': ['prettier --write'],
      '**/*.svelte': ['prettier --write'],
      '**/*.{css,json,md}': ['prettier --write'],
    },
    devDependencies: {
      prettier: '^3.8.1',
      'prettier-plugin-organize-imports': '^4.3.0',
      'prettier-plugin-svelte': '^3.3.2',
      oxlint: '^1.56.0',
      svelte: '~5.55.0',
      'lint-staged': '^16.4.0',
    },
  };
  await Bun.write(join(TMP, 'package.json'), JSON.stringify(simPackageJson, null, 2));

  const install = await $`bun install`.cwd(TMP).nothrow().quiet();
  if (install.exitCode !== 0) die(`bun install failed in isolated repo`);

  const messySvelte = `<script lang="ts">let name='world'</script><p>hello {name}</p>\n`;
  const messyCss = `.sim-test   {color:red;  background:blue}\n`;
  mkdirSync(join(TMP, 'src'), { recursive: true });
  await Bun.write(join(TMP, 'src/sim.svelte'), messySvelte);
  await Bun.write(join(TMP, 'src/sim.css'), messyCss);

  await $`git add .`.cwd(TMP).quiet();

  const staged = await $`bun exec lint-staged`.cwd(TMP).nothrow();
  if (staged.exitCode !== 0) {
    const output = staged.stdout.toString() + staged.stderr.toString();
    die(`lint-staged failed with exit ${staged.exitCode}:\n${output}`);
  }

  const formattedSvelte = await fileText(join(TMP, 'src/sim.svelte'));
  const formattedCss = await fileText(join(TMP, 'src/sim.css'));

  if (formattedSvelte === messySvelte) {
    die(`prettier did not reformat the .svelte file — plugin not loaded?`);
  }
  if (formattedCss === messyCss) {
    die(`prettier did not reformat the .css file`);
  }
  if (!formattedSvelte.includes(`'world'`) && !formattedSvelte.includes(`"world"`)) {
    die(`.svelte file has unexpected content after format:\n${formattedSvelte}`);
  }

  process.stdout.write('[validate-commit-workflow] lint-staged formatted .svelte + .css. PASS.\n');
} finally {
  rmSync(TMP, { recursive: true, force: true });
}
