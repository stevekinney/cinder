/**
 * Cross-checks each component's public variable manifest against the generated
 * token registry.
 *
 * The rule: for a component the DTCG corpus models, every variable its manifest
 * advertises must resolve to a corpus token owned by that component. A manifest
 * entry with no corpus token is a public theming API with no description, no
 * category, and no deprecation status — invisible to `docs/tokens.md` and to
 * every other guard that reads the registry.
 *
 * **Scope, stated plainly.** The corpus models component tokens for two
 * components today (`button`, `toggle`); 181 components ship a manifest. So this
 * check enforces the rule where the corpus can answer and REPORTS the rest
 * rather than pretending to cover them. That gap is CIN-472; when it closes,
 * `--strict-coverage` below becomes the default and this check covers
 * everything.
 *
 * Written this way on purpose. A cross-check that silently passed for 179
 * unmodelled components would read as coverage while guarding nothing — worse
 * than no check, because it would discourage anyone from adding the real one.
 *
 * Run with `bun run check:component-variable-registry`.
 */

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..');
const componentsSource = join(componentsRoot, 'src', 'components');
const registryPath = join(componentsRoot, 'src', 'tokens', 'registry.generated.json');

/** One field of an already-narrowed object, without asserting a shape over it. */
function readField(source: object, field: string): unknown {
  return Object.hasOwn(source, field)
    ? (Object.getOwnPropertyDescriptor(source, field)?.value as unknown)
    : undefined;
}

export type ComponentManifest = { component: string; variables: readonly string[] };

export type RegistryView = {
  /** Component name -> the CSS properties the corpus declares it owns. */
  propertiesByComponent: ReadonlyMap<string, ReadonlySet<string>>;
};

export type CrossCheckResult = {
  /** Manifest entries with no corpus token, for components the corpus models. */
  unbacked: ReadonlyArray<{ component: string; variable: string }>;
  /** Components with a non-empty manifest the corpus does not model at all. */
  unmodelled: readonly string[];
  /** Components the corpus models, whose manifests were fully checked. */
  checked: readonly string[];
};

/**
 * Pure rule, so the scoping decision above is testable without a corpus or a
 * component tree on disk.
 */
export function crossCheckManifests(
  manifests: readonly ComponentManifest[],
  registry: RegistryView,
): CrossCheckResult {
  const unbacked: Array<{ component: string; variable: string }> = [];
  const unmodelled: string[] = [];
  const checked: string[] = [];

  for (const manifest of manifests) {
    const owned = registry.propertiesByComponent.get(manifest.component);
    if (owned === undefined) {
      if (manifest.variables.length > 0) unmodelled.push(manifest.component);
      continue;
    }
    checked.push(manifest.component);
    for (const variable of manifest.variables) {
      if (!owned.has(variable)) unbacked.push({ component: manifest.component, variable });
    }
  }

  return { unbacked, unmodelled: unmodelled.sort(), checked: checked.sort() };
}

function readRegistryView(): RegistryView {
  const parsed: unknown = JSON.parse(readFileSync(registryPath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${registryPath} is not a JSON object.`);
  }
  const entriesValue = readField(parsed, 'entries');
  if (!Array.isArray(entriesValue)) {
    throw new Error(`${registryPath} has no \`entries\` array.`);
  }

  const propertiesByComponent = new Map<string, Set<string>>();
  for (const entry of entriesValue) {
    if (typeof entry !== 'object' || entry === null) continue;
    const component = readField(entry, 'component');
    const cssProperty = readField(entry, 'cssProperty');
    if (typeof component !== 'string' || typeof cssProperty !== 'string') continue;
    const owned = propertiesByComponent.get(component) ?? new Set<string>();
    owned.add(cssProperty);
    propertiesByComponent.set(component, owned);
  }
  return { propertiesByComponent };
}

async function readManifests(): Promise<ComponentManifest[]> {
  const manifests: ComponentManifest[] = [];
  for await (const relativePath of new Glob('**/*.variables.json').scan(componentsSource)) {
    const absolutePath = join(componentsSource, relativePath);
    const parsed: unknown = JSON.parse(readFileSync(absolutePath, 'utf8'));
    if (!Array.isArray(parsed)) {
      throw new Error(`${relativePath} is not a JSON array of variable names.`);
    }
    manifests.push({
      component: basename(relativePath, '.variables.json'),
      variables: parsed.filter((value): value is string => typeof value === 'string'),
    });
  }
  return manifests.sort((a, b) => a.component.localeCompare(b.component));
}

async function main(): Promise<void> {
  const strictCoverage = process.argv.includes('--strict-coverage');
  const result = crossCheckManifests(await readManifests(), readRegistryView());

  if (result.unbacked.length > 0) {
    const detail = result.unbacked
      .map(({ component, variable }) => `  ${component}: ${variable}`)
      .join('\n');
    process.stderr.write(
      `check:component-variable-registry — these manifest variables have no corpus token:\n` +
        `${detail}\n\nAdd the token to the DTCG corpus with a \`component\` extension, or ` +
        `mark the declaration \`@runtime-state\` if it is not a theming API.\n`,
    );
    process.exitCode = 1;
    return;
  }

  if (strictCoverage && result.unmodelled.length > 0) {
    process.stderr.write(
      `check:component-variable-registry — ${result.unmodelled.length} component(s) ship a ` +
        `variable manifest the corpus does not model:\n  ${result.unmodelled.join(', ')}\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `check:component-variable-registry — OK (${result.checked.length} component(s) fully ` +
      `checked against the corpus; ${result.unmodelled.length} not yet modelled — see CIN-472).\n`,
  );
}

if (import.meta.main) await main();
