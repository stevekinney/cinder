/**
 * Pre-1.0 changeset bump-level guard.
 *
 * While `@lostgradient/cinder` is pre-release (version `< 1.0.0`), the project
 * policy is that breaking changes ship as MINOR bumps, not MAJOR — a `0.x` line
 * signals "no stability promise yet", so every release stays on `0.y.z`. A stray
 * `major` changeset silently rolls the package to `1.0.0`: `changeset version`
 * applies it without prompting, and the release workflow then opens a "Version
 * Packages" PR proposing `1.0.0` — a stability commitment nobody approved.
 *
 * This guard reads the package version and every changeset under the repo-root
 * `.changeset/` directory and fails if any changeset requests a `major` bump for
 * `@lostgradient/cinder` while the version is still `< 1.0.0`. It runs inside
 * `bun run validate`, which the release workflow executes BEFORE the changesets
 * action — so a mislabeled changeset turns CI red on the branch that introduced
 * it instead of surfacing as a surprise major-version PR on `main`.
 *
 * Once the package legitimately reaches `1.0.0`, `major` bumps are allowed and
 * this guard becomes a no-op automatically (the version gate stops applying).
 */

import { Glob } from 'bun';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(componentsRoot, '..', '..');

const PACKAGE_NAME = '@lostgradient/cinder';

export type ChangesetBumpViolation = {
  /** Changeset file path, relative to the repository root. */
  filePath: string;
  /** The disallowed bump level found for the package (always `major` here). */
  bump: string;
};

/**
 * Parse the bump level a changeset requests for a given package. Changesets are
 * Markdown files whose YAML-ish frontmatter maps quoted package names to bump
 * levels, e.g. `'@lostgradient/cinder': major`. Returns the level string, or
 * `null` if the changeset does not mention the package.
 */
export function bumpLevelForPackage(source: string, packageName: string): string | null {
  // Match `'<pkg>': <level>` or `"<pkg>": <level>` (quotes optional), tolerant of
  // surrounding whitespace. Only the frontmatter uses this shape, so scanning the
  // whole file is safe and survives Prettier reformatting of the prose body.
  const pattern = new RegExp(
    `["']?${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*:\\s*(major|minor|patch)`,
  );
  const match = source.match(pattern);
  return match?.[1] ?? null;
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
  const packageName = options.packageName ?? PACKAGE_NAME;
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

/** Read and validate the `version` field from a parsed package.json value. */
function readVersion(packageJson: unknown): string {
  if (
    typeof packageJson === 'object' &&
    packageJson !== null &&
    'version' in packageJson &&
    typeof packageJson.version === 'string'
  ) {
    return packageJson.version;
  }
  throw new Error('packages/components/package.json has no string "version" field.');
}

async function main(): Promise<void> {
  const packageJson: unknown = await Bun.file(resolve(componentsRoot, 'package.json')).json();
  const version = readVersion(packageJson);
  const violations = await checkChangesetPrereleaseBumps({
    changesetDirectory: resolve(repositoryRoot, '.changeset'),
    version,
    relativeTo: repositoryRoot,
  });

  if (violations.length === 0) {
    process.stdout.write(
      `check-changeset-prerelease-bumps — OK (no major changesets while ${PACKAGE_NAME} is at ${version}).\n`,
    );
    return;
  }

  process.stderr.write(
    `check-changeset-prerelease-bumps — major changeset(s) found while ${PACKAGE_NAME} is pre-1.0 (${version}).\n` +
      'Pre-1.0 policy: breaking changes ship as a MINOR bump, not MAJOR. A major bump would\n' +
      'roll the package to 1.0.0 and make the release workflow open an unapproved version PR.\n' +
      "Change these changesets' bump level to `minor` (or `patch`):\n\n",
  );
  for (const violation of violations) {
    process.stderr.write(`  ${violation.filePath}\n`);
  }
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-changeset-prerelease-bumps failed:', error);
    process.exit(1);
  });
}
