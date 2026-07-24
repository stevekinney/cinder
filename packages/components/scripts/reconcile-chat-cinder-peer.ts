import { join } from 'node:path';

type JsonObject = Record<string, unknown>;

export type ReconcileChatCinderPeerOptions = {
  cinderManifestPath: string;
  chatManifestPath: string;
};

export type ReconcileChatCinderPeerResult = {
  changed: boolean;
  cinderVersion: string;
  previousRange: string;
  nextRange: string;
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

function requiredCinderPeerRange(peerDependencies: JsonObject, path: string): string {
  const value = peerDependencies['@lostgradient/cinder'];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `The Chat manifest at ${path} must define a non-empty string peerDependencies entry for \`@lostgradient/cinder\``,
    );
  }
  return value;
}

/** Reconcile Chat's Cinder peer range with the version produced by Changesets. */
export async function reconcileChatCinderPeer(
  options: ReconcileChatCinderPeerOptions,
): Promise<ReconcileChatCinderPeerResult> {
  const cinderManifest = await readManifest(options.cinderManifestPath, 'Cinder');
  const chatManifest = await readManifest(options.chatManifestPath, 'Chat');
  const cinderVersion = requiredString(
    cinderManifest,
    'version',
    options.cinderManifestPath,
    'Cinder',
  );
  const chatPeerDependencies = requiredObject(
    chatManifest,
    'peerDependencies',
    options.chatManifestPath,
    'Chat',
  );
  const previousRange = requiredCinderPeerRange(chatPeerDependencies, options.chatManifestPath);
  const nextRange = `^${cinderVersion}`;

  if (Bun.semver.satisfies(cinderVersion, previousRange)) {
    return { changed: false, cinderVersion, previousRange, nextRange };
  }

  chatPeerDependencies['@lostgradient/cinder'] = nextRange;
  await Bun.write(options.chatManifestPath, `${JSON.stringify(chatManifest, null, 2)}\n`);
  return { changed: true, cinderVersion, previousRange, nextRange };
}

async function main(): Promise<void> {
  const workspaceRoot = join(import.meta.dir, '..', '..', '..');
  const result = await reconcileChatCinderPeer({
    cinderManifestPath: join(workspaceRoot, 'packages', 'components', 'package.json'),
    chatManifestPath: join(workspaceRoot, 'packages', 'chat', 'package.json'),
  });

  if (result.changed) {
    console.log(
      `reconcile-chat-cinder-peer — widened Chat's @lostgradient/cinder peer from ${result.previousRange} to ${result.nextRange} for Cinder ${result.cinderVersion}`,
    );
  } else {
    console.log(
      `reconcile-chat-cinder-peer — no change: Cinder ${result.cinderVersion} satisfies Chat peer ${result.previousRange}`,
    );
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error: unknown) {
    console.error(
      `reconcile-chat-cinder-peer failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
