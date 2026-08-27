import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The generated registry, the only artifact that knows every shipped token path. */
const REGISTRY_PATH = join(import.meta.dir, '..', 'src', 'tokens', 'registry.generated.json');

/** One field of an already-narrowed object, without asserting a shape over it. */
function readOwnField(source: object, field: string): unknown {
  return Object.hasOwn(source, field)
    ? (Object.getOwnPropertyDescriptor(source, field)?.value as unknown)
    : undefined;
}

/**
 * The top-level token namespaces the corpus actually declares.
 *
 * Every package that publishes a `components.json` needs this array, and each
 * one used to hand-list it. All three copies drifted the same way: they named
 * `color`, which CIN-33 deleted, and omitted namespaces the corpus had gained
 * since. Deriving it from the registry keeps a manifest from disagreeing with
 * the tokens it describes; sharing one implementation keeps the three
 * manifests from disagreeing with each other.
 */
export function readTokenNamespaces(): string[] {
  const parsed: unknown = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${REGISTRY_PATH} is not a JSON object.`);
  }
  const entries = readOwnField(parsed, 'entries');
  if (!Array.isArray(entries)) {
    throw new Error(`${REGISTRY_PATH} has no \`entries\` array.`);
  }
  const namespaces = new Set<string>();
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const path = readOwnField(entry, 'path');
    if (typeof path !== 'string' || path === '') continue;
    const [namespace] = path.split('.');
    if (namespace !== undefined) namespaces.add(namespace);
  }
  return [...namespaces].sort();
}
