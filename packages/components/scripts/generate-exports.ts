/**
 * Generates subpath exports for every public component in src/components/*.svelte.
 *
 * Run with `bun run exports:generate` to update package.json (mutates the file).
 * Run with `bun run exports:check` (or `--check` flag) to verify there is no drift
 * between the file system and package.json — exits non-zero if drift is detected.
 * `bun run build` runs exports:check as its first step so the build never silently
 * ships stale exports.
 *
 * Reserved entries (`.` and `./styles`) are always preserved unchanged.
 */

import { join } from 'node:path';

import { Glob } from 'bun';

export type ExportEntry = {
  svelte: string;
  types: string;
};

type ExportsMap = Record<string, ExportEntry | Record<string, string>>;

/**
 * Compute the expected subpath export entries from a list of .svelte file paths.
 * Reserved entries (`.` and `./styles`) are excluded — callers must merge those in.
 *
 * Stable components (top-level `src/components/*.svelte`) export at
 * `./<name>`. Experimental components (`src/components/experimental/*.svelte`)
 * export at `./experimental/<name>`. The naming separation makes it visible
 * in import statements that an experimental API can churn.
 *
 * @param filePaths - Paths to .svelte component files.
 * @returns Map from subpath key (e.g. `"./button"`, `"./experimental/sheet"`) to its export entry.
 */
export function computeExports(filePaths: string[]): Record<string, ExportEntry> {
  const result: Record<string, ExportEntry> = {};

  for (const filePath of filePaths) {
    const base = filePath.split('/').pop()!;
    // Skip _internal/ helpers — they are not public API.
    if (base.startsWith('_')) continue;

    const name = base.replace(/\.svelte$/, '');
    const isExperimental = filePath.includes('/experimental/');
    const subpath = isExperimental ? `./experimental/${name}` : `./${name}`;

    if (isExperimental) {
      result[subpath] = {
        svelte: `./src/components/experimental/${name}.svelte`,
        types: `./dist/components/experimental/${name}.svelte.d.ts`,
      };
    } else {
      result[subpath] = {
        svelte: `./src/components/${name}.svelte`,
        types: `./dist/components/${name}.svelte.d.ts`,
      };
    }
  }

  return result;
}

async function scanComponentFiles(): Promise<string[]> {
  // Two globs: top-level stable components + experimental subdirectory.
  // The combined sort makes the resulting subpath order deterministic.
  const stable = new Glob('src/components/*.svelte');
  const experimental = new Glob('src/components/experimental/*.svelte');
  const files: string[] = [];
  for await (const file of stable.scan('.')) {
    files.push(file);
  }
  for await (const file of experimental.scan('.')) {
    files.push(file);
  }
  return files.toSorted();
}

async function main() {
  const checkMode = process.argv.includes('--check');
  const packageJsonPath = join(import.meta.dir, '..', 'package.json');
  const packageJson = await Bun.file(packageJsonPath).json();

  const files = await scanComponentFiles();
  const componentExports = computeExports(files);

  if (checkMode) {
    // Drift-check: compare expected exports against what's in package.json.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = packageJson.exports as ExportsMap;
    const issues: string[] = [];

    for (const [key, entry] of Object.entries(componentExports)) {
      const current = existing[key];
      if (!current) {
        issues.push(`Missing subpath export: "${key}"`);
      } else if (JSON.stringify(current) !== JSON.stringify(entry)) {
        issues.push(`Stale subpath export: "${key}"`);
      }
    }

    // Check for stale component entries in package.json that no longer match a file.
    for (const key of Object.keys(existing)) {
      if (key === '.' || key === './styles') continue;
      if (!(key in componentExports)) {
        issues.push(`Orphan subpath export (no matching .svelte file): "${key}"`);
      }
    }

    // Ensure reserved entries survived.
    if (!existing['.']) issues.push('Reserved export "." is missing');
    if (!existing['./styles']) issues.push('Reserved export "./styles" is missing');

    if (issues.length > 0) {
      console.error('exports:check — drift detected. Run `bun run exports:generate` to fix:');
      for (const issue of issues) console.error(`  • ${issue}`);
      process.exit(1);
    }

    process.stdout.write('exports:check — OK\n');
    return;
  }

  // Generate mode: build updated exports and write to package.json.
  const reserved: ExportsMap = {
    '.': packageJson.exports['.'],
    './styles': packageJson.exports['./styles'],
  };

  packageJson.exports = { ...reserved, ...componentExports };

  await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  process.stdout.write(
    `exports:generate — wrote ${Object.keys(componentExports).length} component subpaths to package.json\n`,
  );
}

main().catch((err: unknown) => {
  console.error('generate-exports failed:', err);
  process.exit(1);
});
