import { $, Glob } from 'bun';
import { existsSync, statSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonFile } from './lib/read-json-file.ts';
import { packForPublish } from './pack-for-publish.ts';
import { getPackFileName, resolvePackageRootArgument } from './publish-release.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = join(scriptDirectory, '..');
const tarBinaryPath = Bun.which('tar');

type PackageIdentity = {
  name: string;
  version: string;
};

/** Exact artifact path selected from the package's source manifest identity. */
export function packageTarballPath(packageRoot: string, identity: PackageIdentity): string {
  return join(packageRoot, getPackFileName(identity));
}

// Coarse anti-bloat headroom caps. The byte budgets are the primary bloat
// guards; `fileCount` is a secondary cap that scales with the component count
// (~13–14 published files per component), so it is raised as new components
// ship. Adding the connection-indicator and schedule-builder components (plus
// their sidecars) crossed the previous 5,000 cap with legitimate output.
type PackageWeightBudgets = {
  packedBytes: number;
  unpackedBytes: number;
  fileCount: number;
  largestEntrypointBytes: number;
};

const budgetsByPackage: Record<string, PackageWeightBudgets> = {
  '@lostgradient/markdown': {
    packedBytes: 500_000,
    unpackedBytes: 2_000_000,
    fileCount: 300,
    largestEntrypointBytes: 500_000,
  },
  '@lostgradient/cinder': {
    packedBytes: 8_000_000,
    unpackedBytes: 32_000_000,
    fileCount: 5_500,
    largestEntrypointBytes: 2_500_000,
  },
  '@lostgradient/chat': {
    packedBytes: 2_000_000,
    unpackedBytes: 8_000_000,
    fileCount: 500,
    largestEntrypointBytes: 1_500_000,
  },
  // Measured against the real 0.0.0 pack: 240 KB packed, ~1.7 MB unpacked,
  // 237 files, largest single file ~120 KB (dist/server/components/
  // review-editor/index.js). Headroom sized like markdown's budget above,
  // scaled up slightly for editor's three Svelte components.
  '@lostgradient/editor': {
    packedBytes: 800_000,
    unpackedBytes: 4_000_000,
    fileCount: 400,
    largestEntrypointBytes: 800_000,
  },
};

type FileSizeEntry = {
  path: string;
  bytes: number;
};

type PackageWeightReport = {
  tarballPath: string;
  packedBytes: number;
  unpackedBytes: number;
  fileCount: number;
  largestFiles: FileSizeEntry[];
  largestEntrypointDirectories: FileSizeEntry[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(2)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

async function existingTarballPath(packageRoot: string): Promise<string> {
  const identity = await readJsonFile<PackageIdentity>(join(packageRoot, 'package.json'));
  const tarballPath = packageTarballPath(packageRoot, identity);
  if (!existsSync(tarballPath)) {
    throw new Error(
      `expected validated package artifact at ${tarballPath}; run validate:consumer first`,
    );
  }
  return tarballPath;
}

async function extractTarball(tarballPath: string, inspectionDirectory: string): Promise<string> {
  if (tarBinaryPath === null) {
    throw new Error('tar is required to inspect the package artifact');
  }
  await rm(inspectionDirectory, { recursive: true, force: true });
  await mkdir(inspectionDirectory, { recursive: true });
  const result = await $`${tarBinaryPath} -xzf ${tarballPath} -C ${inspectionDirectory}`.nothrow();
  if (result.exitCode !== 0) {
    throw new Error(`tar extraction failed: ${result.stderr.toString()}`);
  }
  return join(inspectionDirectory, 'package');
}

/**
 * Attribute one packed file's bytes to the "entrypoint" it belongs to, so
 * `assertBudgets` can flag any single entrypoint that's grown too large —
 * not just the package's aggregate weight.
 *
 * Two dist layouts exist across the three published packages:
 *   - Cinder and Chat group every file for one component under
 *     `dist/components/<name>/**` (or `dist/components/experimental/<name>/**`)
 *     — one entrypoint per component, several files each (`.js`, `.svelte.js`,
 *     `.css`, `.d.ts`, ...). Everything else under `dist/` for these two
 *     packages (`dist/server/**`, the top-level vendored `dist/markdown/**`
 *     and `dist/editor/**` trees, root `dist/index.js`, ...) is
 *     deliberately NOT tracked as its own entrypoint — most of it (`dist/server`
 *     in particular) is an aggregate mirror of the entire component tree, not
 *     a bounded feature surface, so measuring it against the same
 *     single-component budget is meaningless and would just be noise.
 *   - Markdown (and any package with no `dist/components/` directory at all —
 *     it's headless, not component-based) groups files by top-level `dist/`
 *     subdirectory instead: `dist/pipeline/**`, `dist/diff/**`,
 *     `dist/rendering/**`, etc. Each subdirectory backs one or more of the
 *     package's exported subpaths (`./pipeline`, `./diff`, `./diff/line-diff`, ...),
 *     so it IS a bounded, meaningful entrypoint. Root-level files directly
 *     under `dist/` (`dist/index.js`, the package's `.` export) roll up into
 *     a single `dist` entrypoint.
 *
 * `usesComponentsLayout` is computed once per package (whether `dist/components/`
 * exists at all — see `buildReport`), not sniffed per file, so a single package
 * can't straddle both strategies file-by-file.
 */
export function recordEntrypointSize(
  entrypointSizes: Map<string, number>,
  relativePath: string,
  bytes: number,
  usesComponentsLayout: boolean,
): void {
  const parts = relativePath.split('/');
  if (parts[0] !== 'dist') return;

  if (usesComponentsLayout) {
    if (parts[1] !== 'components' || parts.length < 4) return;
    const componentName = parts[2] === 'experimental' ? parts[3] : parts[2];
    if (componentName === undefined) return;
    const key =
      parts[2] === 'experimental'
        ? `dist/components/experimental/${componentName}`
        : `dist/components/${componentName}`;
    entrypointSizes.set(key, (entrypointSizes.get(key) ?? 0) + bytes);
    return;
  }

  const key = parts.length >= 3 && parts[1] !== undefined ? `dist/${parts[1]}` : 'dist';
  entrypointSizes.set(key, (entrypointSizes.get(key) ?? 0) + bytes);
}

async function buildReport(
  tarballPath: string,
  inspectionDirectory: string,
): Promise<PackageWeightReport> {
  const extractedPackageRoot = await extractTarball(tarballPath, inspectionDirectory);
  const usesComponentsLayout = existsSync(join(extractedPackageRoot, 'dist', 'components'));
  const glob = new Glob('**/*');
  const fileSizes: FileSizeEntry[] = [];
  const entrypointSizes = new Map<string, number>();
  let unpackedBytes = 0;
  let fileCount = 0;

  for await (const filePath of glob.scan({ cwd: extractedPackageRoot, absolute: true })) {
    if (!existsSync(filePath)) continue;
    const stat = statSync(filePath);
    if (!stat.isFile()) continue;
    const packageRelativePath = relative(extractedPackageRoot, filePath);
    fileCount += 1;
    unpackedBytes += stat.size;
    fileSizes.push({ path: packageRelativePath, bytes: stat.size });
    recordEntrypointSize(entrypointSizes, packageRelativePath, stat.size, usesComponentsLayout);
  }

  fileSizes.sort((a, b) => b.bytes - a.bytes);
  const largestEntrypointDirectories = [...entrypointSizes.entries()]
    .map(([path, bytes]) => ({ path, bytes }))
    .toSorted((a, b) => b.bytes - a.bytes)
    .slice(0, 20);

  return {
    tarballPath,
    packedBytes: statSync(tarballPath).size,
    unpackedBytes,
    fileCount,
    largestFiles: fileSizes.slice(0, 20),
    largestEntrypointDirectories,
  };
}

function assertBudgets(report: PackageWeightReport, budgets: PackageWeightBudgets): void {
  const violations: string[] = [];
  if (report.packedBytes > budgets.packedBytes) {
    violations.push(
      `packed size ${formatBytes(report.packedBytes)} exceeds ${formatBytes(budgets.packedBytes)}`,
    );
  }
  if (report.unpackedBytes > budgets.unpackedBytes) {
    violations.push(
      `unpacked size ${formatBytes(report.unpackedBytes)} exceeds ${formatBytes(budgets.unpackedBytes)}`,
    );
  }
  if (report.fileCount > budgets.fileCount) {
    violations.push(`file count ${report.fileCount} exceeds ${budgets.fileCount}`);
  }
  const largestEntrypoint = report.largestEntrypointDirectories[0];
  if (largestEntrypoint && largestEntrypoint.bytes > budgets.largestEntrypointBytes) {
    violations.push(
      `${largestEntrypoint.path} is ${formatBytes(largestEntrypoint.bytes)}, exceeding ${formatBytes(
        budgets.largestEntrypointBytes,
      )}`,
    );
  }
  if (violations.length > 0) {
    throw new Error(`package weight budget failed:\n  ${violations.join('\n  ')}`);
  }
}

async function packPackage(packageRoot: string): Promise<string> {
  if (packageRoot === defaultPackageRoot) {
    const packResult = await packForPublish();
    return packResult.tarballPath;
  }

  const packResult = await $`bun run pack:publish`.cwd(packageRoot).nothrow();
  if (packResult.exitCode !== 0) {
    throw new Error(
      `pack:publish failed in ${packageRoot}:\n${packResult.stdout.toString()}\n${packResult.stderr.toString()}`,
    );
  }
  return existingTarballPath(packageRoot);
}

function printReport(report: PackageWeightReport): void {
  process.stdout.write(`package-weight — ${report.tarballPath}\n`);
  process.stdout.write(`  packed:   ${formatBytes(report.packedBytes)}\n`);
  process.stdout.write(`  unpacked: ${formatBytes(report.unpackedBytes)}\n`);
  process.stdout.write(`  files:    ${report.fileCount}\n`);
  process.stdout.write('  largest entrypoint directories:\n');
  for (const entry of report.largestEntrypointDirectories.slice(0, 10)) {
    process.stdout.write(`    ${formatBytes(entry.bytes).padStart(10)}  ${entry.path}\n`);
  }
  process.stdout.write('  largest files:\n');
  for (const entry of report.largestFiles.slice(0, 10)) {
    process.stdout.write(`    ${formatBytes(entry.bytes).padStart(10)}  ${entry.path}\n`);
  }
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  const check = arguments_.includes('--check');
  const json = arguments_.includes('--json');
  const useExistingTarball = arguments_.includes('--existing-tarball');
  const packageRoot = resolvePackageRootArgument(arguments_, {
    defaultRoot: defaultPackageRoot,
    currentWorkingDirectory: process.cwd(),
  });
  const identity = await readJsonFile<PackageIdentity>(join(packageRoot, 'package.json'));
  const budgets = budgetsByPackage[identity.name];
  if (budgets === undefined) {
    throw new Error(`no package weight budget is configured for ${identity.name}`);
  }
  const inspectionDirectory = join(packageRoot, 'tmp', 'package-weight-report');
  try {
    let tarballPath: string;
    if (useExistingTarball) {
      tarballPath = await existingTarballPath(packageRoot);
    } else {
      tarballPath = await packPackage(packageRoot);
    }
    const report = await buildReport(tarballPath, inspectionDirectory);
    if (json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printReport(report);
    }
    if (check) assertBudgets(report, budgets);
  } finally {
    await rm(inspectionDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `package-weight failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
