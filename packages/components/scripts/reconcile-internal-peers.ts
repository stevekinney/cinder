import { join } from 'node:path';

type JsonObject = Record<string, unknown>;

export type InternalPackageManifest = {
  label: string;
  manifestPath: string;
};

export type ReconcileInternalPeersOptions = {
  dependencies: InternalPackageManifest[];
  dependents: InternalPackageManifest[];
};

export type InternalPeerUpdate = {
  dependentName: string;
  dependencyName: string;
  previousRange: string;
  nextRange: string;
};

export type ReconcileInternalPeersResult = {
  updates: InternalPeerUpdate[];
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readManifest(path: string, packageLabel: string): Promise<JsonObject> {
  let source: string;
  try {
    source = await Bun.file(path).text();
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${packageLabel} manifest at ${path}: ${reason}`, {
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`The ${packageLabel} manifest at ${path} is not valid JSON: ${reason}`, {
      cause: error,
    });
  }

  if (!isJsonObject(parsed)) {
    throw new Error(`The ${packageLabel} manifest at ${path} must be a JSON object`);
  }

  return parsed;
}

function requiredString(
  manifest: JsonObject,
  field: string,
  path: string,
  packageLabel: string,
): string {
  const value = manifest[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `The ${packageLabel} manifest at ${path} must define a non-empty string \`${field}\``,
    );
  }
  return value;
}

function requiredObject(
  manifest: JsonObject,
  field: string,
  path: string,
  packageLabel: string,
): JsonObject {
  const value = manifest[field];
  if (!isJsonObject(value)) {
    throw new Error(
      `The ${packageLabel} manifest at ${path} must define a JSON object \`${field}\``,
    );
  }
  return value;
}

function requiredPeerRange(
  peerDependencies: JsonObject,
  dependencyName: string,
  path: string,
  packageLabel: string,
): string {
  const value = peerDependencies[dependencyName];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `The ${packageLabel} manifest at ${path} must define a non-empty string peerDependencies entry for \`${dependencyName}\``,
    );
  }
  return value;
}

/** Reconcile internal peer ranges with the versions produced by Changesets. */
export async function reconcileInternalPeers(
  options: ReconcileInternalPeersOptions,
): Promise<ReconcileInternalPeersResult> {
  const dependencies = await Promise.all(
    options.dependencies.map(async ({ label, manifestPath }) => {
      const manifest = await readManifest(manifestPath, label);
      return {
        name: requiredString(manifest, 'name', manifestPath, label),
        version: requiredString(manifest, 'version', manifestPath, label),
      };
    }),
  );
  const updates: InternalPeerUpdate[] = [];

  for (const { label, manifestPath } of options.dependents) {
    const manifest = await readManifest(manifestPath, label);
    const dependentName = requiredString(manifest, 'name', manifestPath, label);
    const peerDependencies = requiredObject(manifest, 'peerDependencies', manifestPath, label);

    for (const dependency of dependencies) {
      const previousRange = requiredPeerRange(
        peerDependencies,
        dependency.name,
        manifestPath,
        label,
      );
      if (Bun.semver.satisfies(dependency.version, previousRange)) continue;

      const nextRange = `^${dependency.version}`;
      peerDependencies[dependency.name] = nextRange;
      updates.push({ dependentName, dependencyName: dependency.name, previousRange, nextRange });
    }

    if (updates.some((update) => update.dependentName === dependentName)) {
      await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
  }

  return { updates };
}

async function main(): Promise<void> {
  const workspaceRoot = join(import.meta.dir, '..', '..', '..');
  const result = await reconcileInternalPeers({
    dependencies: [
      {
        label: 'Cinder',
        manifestPath: join(workspaceRoot, 'packages', 'components', 'package.json'),
      },
      {
        label: 'Markdown',
        manifestPath: join(workspaceRoot, 'packages', 'markdown', 'package.json'),
      },
    ],
    dependents: [
      {
        label: 'Chat',
        manifestPath: join(workspaceRoot, 'packages', 'chat', 'package.json'),
      },
      {
        label: 'Editor',
        manifestPath: join(workspaceRoot, 'packages', 'editor', 'package.json'),
      },
    ],
  });

  if (result.updates.length > 0) {
    for (const update of result.updates) {
      console.log(
        `reconcile-internal-peers — widened ${update.dependentName}'s ${update.dependencyName} peer from ${update.previousRange} to ${update.nextRange}`,
      );
    }
  } else {
    console.log('reconcile-internal-peers — no change');
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error: unknown) {
    console.error(
      `reconcile-internal-peers failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
