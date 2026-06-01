import { $, Glob } from 'bun';
import { existsSync, statSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonFile } from './lib/read-json-file.ts';
import { packForPublish } from './pack-for-publish.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptDirectory, '..');
const inspectionDirectory = join(packageRoot, 'tmp', 'package-weight-report');
const tarBinaryPath = Bun.which('tar');

type PackageIdentity = {
  name: string;
  version: string;
};

const budgets = {
  packedBytes: 8_000_000,
  unpackedBytes: 32_000_000,
  fileCount: 4_200,
  largestEntrypointBytes: 2_500_000,
} as const;

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

function getPackFileName(identity: PackageIdentity): string {
  const packageFileNamePrefix = identity.name.replace(/^@/, '').replaceAll('/', '-');
  return `${packageFileNamePrefix}-${identity.version}.tgz`;
}

async function existingTarballPath(): Promise<string> {
  const identity = await readJsonFile<PackageIdentity>(join(packageRoot, 'package.json'));
  const tarballPath = join(packageRoot, getPackFileName(identity));
  if (!existsSync(tarballPath)) {
    throw new Error(
      `expected validated package artifact at ${tarballPath}; run validate:consumer first`,
    );
  }
  return tarballPath;
}

async function extractTarball(tarballPath: string): Promise<string> {
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

function recordEntrypointSize(
  entrypointSizes: Map<string, number>,
  relativePath: string,
  bytes: number,
): void {
  const parts = relativePath.split('/');
  if (parts[0] !== 'dist' || parts[1] !== 'components' || parts.length < 4) return;
  const componentName = parts[2] === 'experimental' ? parts[3] : parts[2];
  if (componentName === undefined) return;
  const key =
    parts[2] === 'experimental'
      ? `dist/components/experimental/${componentName}`
      : `dist/components/${componentName}`;
  entrypointSizes.set(key, (entrypointSizes.get(key) ?? 0) + bytes);
}

async function buildReport(tarballPath: string): Promise<PackageWeightReport> {
  const extractedPackageRoot = await extractTarball(tarballPath);
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
    recordEntrypointSize(entrypointSizes, packageRelativePath, stat.size);
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

function assertBudgets(report: PackageWeightReport): void {
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
  const check = process.argv.includes('--check');
  const json = process.argv.includes('--json');
  const useExistingTarball = process.argv.includes('--existing-tarball');
  let tarballPath: string;
  if (useExistingTarball) {
    tarballPath = await existingTarballPath();
  } else {
    const packedArtifact = await packForPublish();
    tarballPath = packedArtifact.tarballPath;
  }
  const report = await buildReport(tarballPath);
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printReport(report);
  }
  if (check) assertBudgets(report);
  await rm(inspectionDirectory, { recursive: true, force: true }).catch(() => {});
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `package-weight failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
