export type PackageExportTarget = Readonly<{
  types: string;
  bun: string;
  import: string;
  default: string;
}>;

export type PackageExports = Readonly<Record<string, PackageExportTarget>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readExportTarget(
  target: Record<string, unknown>,
  exportSpecifier: string,
  condition: keyof PackageExportTarget,
): string {
  const value = target[condition];
  if (typeof value !== 'string') {
    throw new Error(
      `package.json export "${exportSpecifier}" must define a string "${condition}".`,
    );
  }

  return value;
}

function packageRelativePathToAbsolute(packageRoot: string, packageRelativePath: string): string {
  if (!packageRelativePath.startsWith('./')) {
    throw new Error(`Package export target must be package-relative: ${packageRelativePath}`);
  }

  return `${packageRoot}/${packageRelativePath.slice(2)}`;
}

function declarationOutputFor(importTarget: string): string {
  if (!importTarget.endsWith('.js')) {
    throw new Error(`Package import target must point at a JavaScript file: ${importTarget}`);
  }

  return importTarget.replace(/\.js$/, '.d.ts');
}

/**
 * Parse the package export map into the normalized shape required by the build script.
 */
export function parsePackageExports(packageJson: unknown): PackageExports {
  if (!isRecord(packageJson)) {
    throw new Error('package.json must be a JSON object.');
  }

  const exportsField = packageJson['exports'];
  if (!isRecord(exportsField)) {
    throw new Error('package.json must define an object exports map.');
  }

  return Object.fromEntries(
    Object.entries(exportsField).map(([exportSpecifier, target]) => {
      if (!isRecord(target)) {
        throw new Error(`package.json export "${exportSpecifier}" must be an object.`);
      }

      return [
        exportSpecifier,
        {
          types: readExportTarget(target, exportSpecifier, 'types'),
          bun: readExportTarget(target, exportSpecifier, 'bun'),
          import: readExportTarget(target, exportSpecifier, 'import'),
          default: readExportTarget(target, exportSpecifier, 'default'),
        },
      ];
    }),
  );
}

/**
 * Read and parse the package export map from package.json.
 */
export async function readPackageExports(
  packageJsonPath = 'package.json',
): Promise<PackageExports> {
  return parsePackageExports(await Bun.file(packageJsonPath).json());
}

/**
 * Return source entrypoints that Bun.build must compile for every exported subpath.
 */
export function getBuildEntrypoints(packageRoot: string, packageExports: PackageExports): string[] {
  return Object.values(packageExports).map((target) =>
    packageRelativePathToAbsolute(packageRoot, target.bun),
  );
}

/**
 * Return JavaScript and declaration outputs that must exist after the package build.
 */
export function getExpectedBuildOutputs(
  packageRoot: string,
  packageExports: PackageExports,
): string[] {
  return Object.values(packageExports).flatMap((target) => [
    packageRelativePathToAbsolute(packageRoot, target.import),
    packageRelativePathToAbsolute(packageRoot, declarationOutputFor(target.import)),
  ]);
}
