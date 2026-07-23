/**
 * Pre-1.0 changeset bump-level guard.
 *
 * While a public package is pre-release (version `< 1.0.0`), the project policy
 * is that breaking changes ship as MINOR bumps, not MAJOR — a `0.x` line signals
 * "no stability promise yet", so every release stays on `0.y.z`. A stray `major`
 * changeset silently rolls the package to `1.0.0`: `changeset version` applies it
 * without prompting, and the release workflow then opens a "Version Packages"
 * pull request proposing `1.0.0` — a stability commitment nobody approved.
 *
 * This guard reads every public package version and every changeset under the
 * repository-root `.changeset/` directory and fails if any changeset requests a
 * `major` bump for a package that is still `< 1.0.0`. It runs inside
 * `bun run validate`, which the release workflow executes BEFORE the changesets
 * action — so a mislabeled changeset turns CI red on the branch that introduced
 * it instead of surfacing as a surprise major-version PR on `main`.
 *
 * Once the package legitimately reaches `1.0.0`, `major` bumps are allowed and
 * this guard becomes a no-op automatically (the version gate stops applying).
 */

import parseChangeset from '@changesets/parse';
import { Glob } from 'bun';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(componentsRoot, '..', '..');

const DEFAULT_PACKAGE_NAME = '@lostgradient/cinder';
const PUBLIC_PACKAGE_DIRECTORIES = [
  'packages/components',
  'packages/chat',
  'packages/markdown',
  'packages/editor',
] as const;

export type ChangesetBumpViolation = {
  /** Changeset file path, relative to the repository root. */
  filePath: string;
  /** The disallowed bump level found for the package (always `major` here). */
  bump: string;
};

export type PublicPackageBumpViolation = ChangesetBumpViolation & {
  packageName: string;
  version: string;
};

export type PublicPackageIdentity = {
  packageName: string;
  version: string;
};

/**
 * The bump level a changeset requests for `packageName`, or `null` if the
 * changeset does not mention it.
 *
 * Parsing is delegated to `@changesets/parse` — the exact parser Changesets uses
 * — so the guard can never disagree with how Changesets actually interprets the
 * frontmatter. That covers quoted scalars, comments, and multiline/block YAML
 * forms uniformly, and (like Changesets) throws on genuinely malformed frontmatter
 * such as duplicate keys or an invalid version type, surfacing the bad changeset
 * rather than silently misreading it.
 */
export function bumpLevelForPackage(source: string, packageName: string): string | null {
  const { releases } = parseChangeset(source);
  const release = releases.find((entry) => entry.name === packageName);
  return release ? release.type : null;
}

/** True when a semver version string is `< 1.0.0` (i.e. still in the `0.y.z` line). */
export function isPreRelease(version: string): boolean {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  if (Number.isNaN(major)) {
    throw new Error(`Unparseable package version: ${JSON.stringify(version)}`);
  }
  return major < 1;
}

/**
 * Scan `changesetDirectory` for changesets requesting a `major` bump of
 * `packageName`. Returns violations only when `version` is pre-1.0; at `>= 1.0.0`
 * every changeset is allowed and the result is always empty.
 */
export async function checkChangesetPrereleaseBumps(options: {
  changesetDirectory: string;
  version: string;
  packageName?: string;
  /** Root used to render `filePath` relative to the repository. Defaults to cwd. */
  relativeTo?: string;
}): Promise<ChangesetBumpViolation[]> {
  const { changesetDirectory, version } = options;
  const packageName = options.packageName ?? DEFAULT_PACKAGE_NAME;
  const relativeTo = options.relativeTo ?? process.cwd();

  if (!isPreRelease(version)) return [];

  const violations: ChangesetBumpViolation[] = [];
  const glob = new Glob('*.md');

  for await (const entry of glob.scan({ cwd: changesetDirectory })) {
    if (entry === 'README.md') continue;
    const absolutePath = resolve(changesetDirectory, entry);
    const source = await Bun.file(absolutePath).text();
    if (bumpLevelForPackage(source, packageName) === 'major') {
      violations.push({ filePath: relative(relativeTo, absolutePath), bump: 'major' });
    }
  }

  return violations;
}

/** Check every public package against the same pre-1.0 bump policy. */
export async function checkPublicPackagesPrereleaseBumps(options: {
  changesetDirectory: string;
  packages: readonly PublicPackageIdentity[];
  relativeTo?: string;
}): Promise<PublicPackageBumpViolation[]> {
  const violations = await Promise.all(
    options.packages.map(async ({ packageName, version }) => {
      const packageViolations = await checkChangesetPrereleaseBumps({
        changesetDirectory: options.changesetDirectory,
        version,
        packageName,
        ...(options.relativeTo === undefined ? {} : { relativeTo: options.relativeTo }),
      });
      return packageViolations.map((violation) => ({
        ...violation,
        packageName,
        version,
      }));
    }),
  );
  return violations.flat();
}

/** Read and validate the `version` field from a parsed package.json value. */
function readPackageIdentity(packageJson: unknown, manifestPath: string): PublicPackageIdentity {
  if (
    typeof packageJson === 'object' &&
    packageJson !== null &&
    'name' in packageJson &&
    typeof packageJson.name === 'string' &&
    'version' in packageJson &&
    typeof packageJson.version === 'string'
  ) {
    return { packageName: packageJson.name, version: packageJson.version };
  }
  throw new Error(`${manifestPath} must have string "name" and "version" fields.`);
}

async function main(): Promise<void> {
  const packages = await Promise.all(
    PUBLIC_PACKAGE_DIRECTORIES.map(async (packageDirectory) => {
      const manifestPath = resolve(repositoryRoot, packageDirectory, 'package.json');
      const packageJson: unknown = await Bun.file(manifestPath).json();
      return readPackageIdentity(packageJson, manifestPath);
    }),
  );
  const violations = await checkPublicPackagesPrereleaseBumps({
    changesetDirectory: resolve(repositoryRoot, '.changeset'),
    packages,
    relativeTo: repositoryRoot,
  });

  if (violations.length === 0) {
    const packageSummary = packages
      .map(({ packageName, version }) => `${packageName}@${version}`)
      .join(', ');
    process.stdout.write(
      `check-changeset-prerelease-bumps — OK (no disallowed major changesets; ${packageSummary}).\n`,
    );
    return;
  }

  process.stderr.write(
    'check-changeset-prerelease-bumps — major changeset(s) found for pre-1.0 public packages.\n' +
      'Pre-1.0 policy: breaking changes ship as a MINOR bump, not MAJOR. A major bump would\n' +
      'roll the package to 1.0.0 and make the release workflow open an unapproved version PR.\n' +
      "Change these changesets' bump level to `minor` (or `patch`):\n\n",
  );
  for (const violation of violations) {
    process.stderr.write(
      `  ${violation.filePath}: ${violation.packageName}@${violation.version}\n`,
    );
  }
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-changeset-prerelease-bumps failed:', error);
    process.exit(1);
  });
}
