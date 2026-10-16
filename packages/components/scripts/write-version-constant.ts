/**
 * Rewrites the `VERSION` that `@lostgradient/cinder` exports to its `package.json` version.
 *
 * The corvidae mirror sync writes the constant at the version the target carries when it runs,
 * but `changeset version` bumps the manifest afterwards and knows nothing of the constant, so
 * 0.28.0 shipped `VERSION = '0.27.1'`. `changeset:version` runs this after it resets
 * `packages/components/src` (a reset before it would revert the write), so the Version Packages
 * pull request carries the bumped constant and `mirror-verify.yaml`'s version-constant step
 * passes on it without a mirror sync in between.
 *
 * The path is kept here rather than imported from `scripts/tokens/base-corpus-metadata.ts`:
 * that module is emitted by the mirror and may change shape, and this one is the target's own.
 */

import { join } from 'node:path';

export class VersionConstantError extends Error {}

/** Relative to `packages/components`; the path corvidae's `versionConstants` declares. */
export const versionConstantPath = join('src', 'tokens', 'runtime', 'package-version.generated.ts');

/**
 * The one shape the mirror accepts: any leading comment, then the export, then one newline and
 * nothing else. Mirrors `versionConstantShape` in corvidae's `scripts/mirror/source.ts` and the
 * check `versionConstantScript` runs in `mirror-verify.yaml`.
 */
export const versionConstantShape = /^([\s\S]*?)export const VERSION = '([^']*)';\n$/;

const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** The generated module with its `VERSION` literal set to `version`; every other byte is kept. */
export function updateVersionSource(source: string, version: string): string {
  if (!semverPattern.test(version)) {
    throw new VersionConstantError(`Cannot write VERSION: "${version}" is not a semver version.`);
  }
  const match = versionConstantShape.exec(source);
  if (match === null || source.split('export const VERSION').length !== 2) {
    throw new VersionConstantError(
      `${versionConstantPath} must end with exactly one \`export const VERSION = '…';\` after an optional comment.`,
    );
  }
  return `${match[1]}export const VERSION = '${version}';\n`;
}

/** Make the exported `VERSION` equal `package.json`'s `version` in `packageRoot`. */
export async function writeVersionConstant(
  packageRoot: string,
): Promise<{ version: string; changed: boolean }> {
  const manifest: unknown = await Bun.file(join(packageRoot, 'package.json')).json();
  const version =
    typeof manifest === 'object' && manifest !== null && 'version' in manifest
      ? manifest.version
      : undefined;
  if (typeof version !== 'string' || version === '') {
    throw new VersionConstantError('package.json is missing a version field.');
  }
  const path = join(packageRoot, versionConstantPath);
  const before = await Bun.file(path).text();
  const after = updateVersionSource(before, version);
  if (after !== before) await Bun.write(path, after);
  return { version, changed: after !== before };
}

if (import.meta.main) {
  try {
    // packages/components/scripts/write-version-constant.ts → packages/components, whatever the
    // working directory.
    const { version, changed } = await writeVersionConstant(join(import.meta.dir, '..'));
    console.log(
      changed ? `Set VERSION to ${version}` : `VERSION already ${version}; nothing to write`,
    );
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
