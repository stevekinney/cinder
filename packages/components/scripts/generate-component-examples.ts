/**
 * Generates per-component `{id}.examples.json` artifacts from playground
 * `.example.svelte` source files.
 *
 * Each example must satisfy the authoring contract:
 *   - A `<script lang="ts" module>` block with `export const title` and
 *     `export const description` as string literals.
 *   - Imports only from `cinder`, `cinder/<subpath>`, or packages listed in
 *     `example-allowed-packages.ts`. Relative paths, `$lib`, and any other
 *     specifier are hard errors.
 *   - No `<style>` block.
 *
 * Non-conforming examples may carry a top-of-file exclusion marker:
 *   `// @cinder-example-exclude: <reason>`
 * where `<reason>` must be in `allowedExampleExclusionReasons` (manifest.meta.ts).
 *
 * Outputs:
 *   - `src/components/{id}/{id}.examples.json` (one per component with published examples)
 *   - `examples-exclusions.json` (audit artifact; checked in, NOT shipped in tarball)
 *
 * Run: bun run scripts/generate-component-examples.ts
 * Check: bun run scripts/generate-component-examples.ts --check
 *
 * TODO: Phase 3 follow-up — `packages/components/fixtures/examples-consumer/`
 * A SvelteKit fixture that compiles every published example and runs SSR.
 * See plan §Phase 3 "Compile gate". Deferred until the generator and examples
 * are landing successfully with correct import specifiers.
 *
 * TODO: Phase 3 follow-up — `packages/components/fixtures/typescript-consumer/`
 * A TypeScript-only fixture (`.ts` + `.svelte`) that imports `cinder/manifest`,
 * `cinder/{name}/examples`, and `cinder/{name}/constraints`, validated with
 * `tsc --noEmit` and `svelte-check`.
 *
 * TODO: Phase 3 follow-up — `packages/components/fixtures/manifest-consumer/`
 * A Node ESM fixture that installs the packed tarball and resolves every
 * `artifacts.<key>` subpath listed in the manifest.
 */

import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { allowedExampleExclusionReasons } from '../src/manifest.meta.ts';
import { ALLOWED_EXAMPLE_PACKAGES } from './example-allowed-packages.ts';
import { discoverDirectoryComponents } from './generate-exports.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single serialized example, ready for `{id}.examples.json`. */
export type Example = {
  /** Basename of the `.example.svelte` file without the extension. */
  id: string;
  /** From `export const title` in `<script lang="ts" module>`. */
  title: string;
  /** From `export const description` in `<script lang="ts" module>`. */
  description: string;
  /**
   * Full source of the `.example.svelte` file, verbatim, with the module
   * block stripped if and only if it contains ONLY the metadata exports
   * (`title`, `description`, and optionally `component`).
   */
  code: string;
};

/** The per-component JSON artifact shape. */
export type ExampleSet = {
  /** Relative path resolving to `packages/components/src/schemas/examples.schema.json`. */
  $schema: string;
  /** Kebab-case component id. */
  component: string;
  /**
   * Import path for the component. `cinder/<id>` for stable, or
   * `cinder/experimental/<id>` for experimental.
   */
  import: string;
  examples: Example[];
};

/** A tracked exclusion — recorded in `examples-exclusions.json`. */
export type ExampleExclusion = {
  /** Kebab-case component id. */
  componentId: string;
  /** Path to the `.example.svelte` file, relative to the package root. */
  file: string;
  /** The `@cinder-example-exclude` reason string. */
  reason: string;
};

/** A hard extraction failure (bad imports, missing metadata, etc.). */
export type ExtractExampleError = {
  /** Kebab-case component id. */
  componentId: string;
  /** Path to the `.example.svelte` file, relative to the package root. */
  file: string;
  /** Human-readable description including the offending text when relevant. */
  reason: string;
};

/** The overall result produced by `generateAllExamples()`. */
export type GenerateExamplesResult = {
  /** One entry per component that has at least one published example. */
  exampleSets: ExampleSet[];
  /** Tracked exclusions (written to `examples-exclusions.json`). */
  exclusions: ExampleExclusion[];
  /** Hard failures that prevent an example from being published. */
  errors: ExtractExampleError[];
};

// ---------------------------------------------------------------------------
// Internal: paths
// ---------------------------------------------------------------------------

const PACKAGE_ROOT = join(import.meta.dir, '..');
const PACKAGES_ROOT = join(PACKAGE_ROOT, '..');
const PLAYGROUND_EXAMPLES_ROOT = join(PACKAGES_ROOT, 'playground/src/examples');
const COMPONENTS_SRC_ROOT = join(PACKAGE_ROOT, 'src/components');
const EXCLUSIONS_FILE = join(PACKAGE_ROOT, 'examples-exclusions.json');

// ---------------------------------------------------------------------------
// Internal: regex helpers
// ---------------------------------------------------------------------------

/** Matches `<script lang="ts" module>` or `<script module lang="ts">`. */
const MODULE_SCRIPT_REGEX =
  /<script\b(?=[^>]*\bmodule\b)(?=[^>]*\blang\s*=\s*["']ts["'])[^>]*>([\s\S]*?)<\/script>/;

/** Matches the presence of any `<style>` block. */
const STYLE_BLOCK_REGEX = /<style\b[^>]*>/;

/** Matches all `export const <name> = '...'` statements in a block. */
const ALL_STRING_EXPORTS_REGEX = /export\s+const\s+(\w+)\s*=\s*(['"`])([\s\S]*?)\2\s*;?/gm;

/** Matches `from 'specifier'` or `from "specifier"` in import statements. */
const IMPORT_FROM_REGEX = /^\s*import\b[^;]*\bfrom\s+['"]([^'"]+)['"]/gm;

/**
 * Matches side-effect imports: `import 'specifier';` (no `from` clause).
 * Catches CSS imports, polyfills, and `$lib` shim loads that would otherwise
 * slip past `IMPORT_FROM_REGEX`.
 */
const IMPORT_SIDE_EFFECT_REGEX = /^\s*import\s+['"]([^'"]+)['"]\s*;?/gm;

/**
 * Matches dynamic imports: `import('specifier')`.
 * Examples that dynamically load arbitrary specifiers also escape the static
 * import contract.
 */
const IMPORT_DYNAMIC_REGEX = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Matches `@cinder-example-exclude: <reason>` anywhere in the file. */
const EXCLUSION_MARKER_REGEX = /\/\/\s*@cinder-example-exclude:\s*(.+)/;

// ---------------------------------------------------------------------------
// Exported per-file extractor (pure; testable without real playground files)
// ---------------------------------------------------------------------------

/** Input to the per-file extractor for unit-testing without real files. */
export type ExampleFileInput = {
  /** Kebab-case component id (directory name). */
  componentId: string;
  /** Path to the file (used in error messages; need not exist on disk). */
  filePath: string;
  /** Raw source content of the `.example.svelte` file. */
  source: string;
  /** Set of valid `cinder/<subpath>` names (the component names, without `cinder/` prefix). */
  validCinderSubpaths: ReadonlySet<string>;
};

/** The result of extracting a single example file. */
export type ExampleFileResult =
  | { kind: 'example'; example: Example; componentOverride: string | undefined }
  | { kind: 'exclusion'; reason: string }
  | { kind: 'error'; reason: string };

/**
 * Extracts a single `.example.svelte` file into a publishable `Example`,
 * an `ExampleExclusion`, or an `ExtractExampleError`.
 *
 * This function is intentionally pure — it takes source as a string and a set
 * of valid subpaths, making it easy to unit-test without real disk I/O.
 */
export function extractExampleFile(input: ExampleFileInput): ExampleFileResult {
  const { componentId, filePath, source, validCinderSubpaths } = input;

  // Step 1: check for the exclusion marker anywhere in the file.
  const exclusionMatch = EXCLUSION_MARKER_REGEX.exec(source);
  if (exclusionMatch !== null) {
    const reason = (exclusionMatch[1] ?? '').trim();
    if (!(allowedExampleExclusionReasons as readonly string[]).includes(reason)) {
      return {
        kind: 'error',
        reason: `unknown exclusion reason "${reason}" in ${filePath}; allowed: ${allowedExampleExclusionReasons.join(', ')}`,
      };
    }
    return { kind: 'exclusion', reason };
  }

  // Step 2: require a module block.
  const moduleMatch = MODULE_SCRIPT_REGEX.exec(source);
  if (moduleMatch === null) {
    return {
      kind: 'error',
      reason: `no <script lang="ts" module> block found in ${filePath}`,
    };
  }

  const moduleBlockContent = moduleMatch[1] ?? '';

  // Step 3: extract `title` and `description` (required) and `component` (optional).
  const metadataExports = parseStringExports(moduleBlockContent);

  const title = metadataExports.get('title');
  if (title === undefined) {
    return {
      kind: 'error',
      reason: `missing or non-literal "export const title" in module block of ${filePath}`,
    };
  }

  const description = metadataExports.get('description');
  if (description === undefined) {
    return {
      kind: 'error',
      reason: `missing or non-literal "export const description" in module block of ${filePath}`,
    };
  }

  const componentOverride = metadataExports.get('component');

  // Validate the override against the closed set of public component ids.
  // Without this check, a bad `export const component = '../../bad/path'`
  // could write artifacts outside the canonical component directory. We accept
  // either the bare kebab id (stable) or the path used in `validCinderSubpaths`
  // for experimental components (which is prefixed with `experimental/`).
  if (componentOverride !== undefined) {
    if (!/^[a-z][a-z0-9-]*$/.test(componentOverride)) {
      return {
        kind: 'error',
        reason: `"export const component = '${componentOverride}'" in ${filePath} is not a kebab-case id`,
      };
    }
    const matchesBare = validCinderSubpaths.has(componentOverride);
    const matchesExperimental = validCinderSubpaths.has(`experimental/${componentOverride}`);
    if (!matchesBare && !matchesExperimental) {
      return {
        kind: 'error',
        reason: `"export const component = '${componentOverride}'" in ${filePath} does not match any public component`,
      };
    }
  }

  // Step 4: reject `<style>` blocks.
  if (STYLE_BLOCK_REGEX.test(source)) {
    return {
      kind: 'error',
      reason: `<style> block found in ${filePath}; styles must come from cinder/styles`,
    };
  }

  // Step 5: validate all import specifiers in the full file.
  const importError = validateImports(source, filePath, componentId, validCinderSubpaths);
  if (importError !== null) {
    return { kind: 'error', reason: importError };
  }

  // Step 6: compute the `code` field.
  // Strip the module block iff it contains ONLY the metadata exports (title,
  // description, and optionally component). If it has any other statements,
  // keep the module block verbatim.
  const code = buildCodeField(source, moduleMatch[0] ?? '', moduleBlockContent, metadataExports);

  return {
    kind: 'example',
    example: {
      id: basename(filePath, '.example.svelte'),
      title,
      description,
      code,
    },
    componentOverride,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers for the extractor
// ---------------------------------------------------------------------------

/**
 * Parses all `export const <name> = '<literal>'` statements from a module
 * block's content. Returns a map from export name → string value.
 * Non-string-literal exports are not included in the map.
 */
function parseStringExports(moduleBlockContent: string): Map<string, string> {
  const result = new Map<string, string>();
  const regex = new RegExp(ALL_STRING_EXPORTS_REGEX.source, ALL_STRING_EXPORTS_REGEX.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(moduleBlockContent)) !== null) {
    const name = match[1];
    const value = match[3];
    if (name !== undefined && value !== undefined) {
      result.set(name, value);
    }
  }
  return result;
}

/**
 * Returns an error message string if any import specifier in the source violates
 * the authoring contract; returns `null` if all imports are valid.
 */
function validateImports(
  source: string,
  filePath: string,
  _componentId: string,
  validCinderSubpaths: ReadonlySet<string>,
): string | null {
  // Validate every form an import can take in a Svelte module: bound (`from`),
  // side-effect (`import 'x';`), and dynamic (`import('x')`). Any specifier
  // that escapes one regex would have slipped past the contract.
  const patterns: Array<{ regex: RegExp; kind: 'bound' | 'side-effect' | 'dynamic' }> = [
    { regex: new RegExp(IMPORT_FROM_REGEX.source, IMPORT_FROM_REGEX.flags), kind: 'bound' },
    {
      regex: new RegExp(IMPORT_SIDE_EFFECT_REGEX.source, IMPORT_SIDE_EFFECT_REGEX.flags),
      kind: 'side-effect',
    },
    { regex: new RegExp(IMPORT_DYNAMIC_REGEX.source, IMPORT_DYNAMIC_REGEX.flags), kind: 'dynamic' },
  ];

  for (const { regex, kind } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const specifier = match[1];
      if (specifier === undefined) continue;

      const verdict = classifySpecifier(specifier, validCinderSubpaths);
      if (verdict === 'allowed') continue;

      const prefix =
        kind === 'bound'
          ? 'import'
          : kind === 'side-effect'
            ? 'side-effect import'
            : 'dynamic import';
      if (verdict === 'relative') {
        return `relative ${prefix} "${specifier}" not allowed in ${filePath}; use "cinder/<subpath>"`;
      }
      if (verdict === 'unknown-cinder-subpath') {
        return `${prefix} "cinder/${specifier.slice('cinder/'.length)}" does not match a known cinder subpath in ${filePath}`;
      }
      return `${prefix} "${specifier}" not allowed in ${filePath}; only cinder/* and allowed packages permitted`;
    }
  }

  return null;
}

/** Decide whether a single specifier satisfies the example authoring contract. */
function classifySpecifier(
  specifier: string,
  validCinderSubpaths: ReadonlySet<string>,
): 'allowed' | 'relative' | 'unknown-cinder-subpath' | 'banned' {
  if (specifier.startsWith('./') || specifier.startsWith('../') || specifier === '..') {
    return 'relative';
  }
  if (specifier.startsWith('$')) return 'banned';
  if (specifier === 'cinder') return 'allowed';
  if (specifier.startsWith('cinder/')) {
    const subpath = specifier.slice('cinder/'.length);
    if (
      validCinderSubpaths.has(subpath) ||
      isValidCinderSubpathWithSuffix(subpath, validCinderSubpaths)
    ) {
      return 'allowed';
    }
    return 'unknown-cinder-subpath';
  }
  if (ALLOWED_EXAMPLE_PACKAGES.includes(specifier)) return 'allowed';
  return 'banned';
}

/**
 * Returns true if the subpath is a valid `<name>/schema` or `<name>/variables`
 * suffix of a known component name.
 */
function isValidCinderSubpathWithSuffix(
  subpath: string,
  validCinderSubpaths: ReadonlySet<string>,
): boolean {
  for (const suffix of ['/schema', '/variables', '/examples', '/constraints']) {
    if (subpath.endsWith(suffix)) {
      const base = subpath.slice(0, -suffix.length);
      if (validCinderSubpaths.has(base)) return true;
    }
  }
  return false;
}

/**
 * Builds the `code` field for a published example.
 *
 * The module block is stripped if and only if it contains ONLY the metadata
 * exports (`title`, `description`, and optionally `component`) — no other
 * statements. When other statements are present, the full source is returned
 * verbatim.
 */
function buildCodeField(
  source: string,
  moduleBlockFull: string,
  moduleBlockContent: string,
  metadataExports: Map<string, string>,
): string {
  // Check whether the module block contains ONLY metadata exports.
  // Strategy: remove all metadata export statements from the block content
  // and check that only whitespace and comments remain.
  const metadataKeys = new Set(['title', 'description', 'component']);
  let remaining = moduleBlockContent;

  for (const key of metadataKeys) {
    if (!metadataExports.has(key)) continue;
    // Remove the export const statement for this key.
    const value = metadataExports.get(key)!;
    // Escape the value for regex use.
    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const removePattern = new RegExp(
      `export\\s+const\\s+${key}\\s*=\\s*(['"\`])${escapedValue}\\1\\s*;?\\s*`,
      'g',
    );
    remaining = remaining.replace(removePattern, '');
  }

  // After removing metadata exports, only whitespace/comments should remain.
  const nonWhitespace = remaining
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  const isMetadataOnly = nonWhitespace.length === 0;

  if (!isMetadataOnly) {
    // Module block has other content — keep the full source verbatim.
    return source;
  }

  // Strip the module block from the source.
  const stripped = source.replace(moduleBlockFull, '').replace(/^\n/, '').trimStart();
  return stripped;
}

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

/**
 * Generates all example sets from the playground, writing JSON output to disk.
 * Returns a full result summary including exclusions and errors.
 */
export async function generateAllExamples(): Promise<GenerateExamplesResult> {
  const components = await discoverDirectoryComponents();
  // Valid `cinder/<...>` subpaths include both flat component names and the
  // `experimental/<name>` namespace so examples for experimental components
  // can import their siblings via the same `cinder/<subpath>` contract.
  const validCinderSubpaths = new Set<string>();
  for (const component of components) {
    if (component.isExperimental) {
      validCinderSubpaths.add(`experimental/${component.name}`);
    } else {
      validCinderSubpaths.add(component.name);
    }
  }

  const exampleSets: ExampleSet[] = [];
  const exclusions: ExampleExclusion[] = [];
  const errors: ExtractExampleError[] = [];

  for (const { name: componentId, isExperimental } of components) {
    const examplesDir = join(PLAYGROUND_EXAMPLES_ROOT, componentId);
    if (!existsSync(examplesDir)) continue;

    let dirEntries: string[];
    try {
      const entries = await readdir(examplesDir);
      dirEntries = entries.filter((e) => e.endsWith('.example.svelte')).toSorted();
    } catch {
      continue;
    }

    if (dirEntries.length === 0) continue;

    const publishedExamples: Example[] = [];
    let componentImportOverride: string | undefined;

    for (const filename of dirEntries) {
      const filePath = join(examplesDir, filename);
      const relativeFilePath = filePath.slice(PACKAGES_ROOT.length + 1);

      let source: string;
      try {
        source = await Bun.file(filePath).text();
      } catch {
        errors.push({
          componentId,
          file: relativeFilePath,
          reason: `could not read file: ${filePath}`,
        });
        continue;
      }

      const result = extractExampleFile({
        componentId,
        filePath: relativeFilePath,
        source,
        validCinderSubpaths,
      });

      if (result.kind === 'error') {
        errors.push({ componentId, file: relativeFilePath, reason: result.reason });
      } else if (result.kind === 'exclusion') {
        exclusions.push({ componentId, file: relativeFilePath, reason: result.reason });
      } else {
        if (result.componentOverride !== undefined) {
          componentImportOverride = result.componentOverride;
        }
        publishedExamples.push(result.example);
      }
    }

    // Enforce: if a component has playground examples but ALL are excluded → error.
    const totalForComponent = dirEntries.length;
    const excludedForComponent = exclusions.filter((e) => e.componentId === componentId).length;
    const errorsForComponent = errors.filter((e) => e.componentId === componentId).length;
    if (
      publishedExamples.length === 0 &&
      totalForComponent > 0 &&
      excludedForComponent + errorsForComponent === totalForComponent
    ) {
      errors.push({
        componentId,
        file: `playground/src/examples/${componentId}`,
        reason: `all ${totalForComponent} playground example(s) for "${componentId}" are excluded or errored; at least one must be published`,
      });
      continue;
    }

    if (publishedExamples.length === 0) continue;

    const effectiveComponentId = componentImportOverride ?? componentId;
    const importPath = isExperimental
      ? `cinder/experimental/${effectiveComponentId}`
      : `cinder/${effectiveComponentId}`;
    // Experimental example artifacts live one directory deeper so the
    // `src/components/experimental/<id>/` layout matches the source tree.
    const $schema = isExperimental
      ? '../../../schemas/examples.schema.json'
      : '../../schemas/examples.schema.json';
    exampleSets.push({
      $schema,
      component: effectiveComponentId,
      import: importPath,
      examples: publishedExamples,
    });
  }

  // Enforce exclusion budget: ≤ 10% of all playground examples.
  const totalPlaygroundExamples =
    exclusions.length +
    errors.filter((e) => !e.reason.includes('all ')).length +
    exampleSets.reduce((sum, s) => sum + s.examples.length, 0);
  if (exclusions.length > totalPlaygroundExamples * 0.1) {
    throw new Error(
      `exclusion budget exceeded: ${exclusions.length} of ${totalPlaygroundExamples} examples excluded; cap is 10%`,
    );
  }

  return { exampleSets, exclusions, errors };
}

// ---------------------------------------------------------------------------
// Write artifacts
// ---------------------------------------------------------------------------

/**
 * Writes all `{id}.examples.json` files and `examples-exclusions.json` to disk.
 *
 * Exported for use by the orchestrator (`generate-component-artifacts.ts`).
 */
/**
 * Resolve the on-disk path for an example set's JSON artifact. Experimental
 * components live one directory deeper, mirroring the source tree.
 */
function exampleSetOutputPath(exampleSet: ExampleSet): string {
  const isExperimental = exampleSet.import.startsWith('cinder/experimental/');
  const componentDir = isExperimental
    ? join(COMPONENTS_SRC_ROOT, 'experimental', exampleSet.component)
    : join(COMPONENTS_SRC_ROOT, exampleSet.component);
  return join(componentDir, `${exampleSet.component}.examples.json`);
}

export async function writeExampleArtifacts(result: GenerateExamplesResult): Promise<void> {
  const { exampleSets, exclusions } = result;

  for (const exampleSet of exampleSets) {
    const outputPath = exampleSetOutputPath(exampleSet);
    await Bun.write(outputPath, JSON.stringify(exampleSet, null, 2) + '\n');
  }

  // Write exclusions file, grouped by componentId, sorted deterministically.
  const grouped: Record<string, ExampleExclusion[]> = {};
  for (const exclusion of exclusions.toSorted(
    (a, b) => a.componentId.localeCompare(b.componentId) || a.file.localeCompare(b.file),
  )) {
    const entry = grouped[exclusion.componentId] ?? [];
    grouped[exclusion.componentId] = entry;
    entry.push(exclusion);
  }

  await Bun.write(EXCLUSIONS_FILE, JSON.stringify(grouped, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Check mode: compare generated output against committed artifacts
// ---------------------------------------------------------------------------

/**
 * Regenerates everything into memory and compares against committed files.
 * Returns a list of drift issues (empty = no drift).
 *
 * Exported for use by the orchestrator (`generate-component-artifacts.ts`).
 */
export async function checkExamplesDrift(result: GenerateExamplesResult): Promise<string[]> {
  const issues: string[] = [];

  // Check each example set against the committed JSON.
  for (const exampleSet of result.exampleSets) {
    const outputPath = exampleSetOutputPath(exampleSet);
    const generated = JSON.stringify(exampleSet, null, 2) + '\n';

    if (!existsSync(outputPath)) {
      issues.push(`missing artifact: ${outputPath}`);
      continue;
    }

    const committed = await Bun.file(outputPath).text();
    if (committed !== generated) {
      issues.push(`drift detected: ${outputPath}`);
    }
  }

  // Check exclusions file.
  const grouped: Record<string, ExampleExclusion[]> = {};
  for (const exclusion of result.exclusions.toSorted(
    (a, b) => a.componentId.localeCompare(b.componentId) || a.file.localeCompare(b.file),
  )) {
    const entry = grouped[exclusion.componentId] ?? [];
    grouped[exclusion.componentId] = entry;
    entry.push(exclusion);
  }
  const generatedExclusions = JSON.stringify(grouped, null, 2) + '\n';

  if (!existsSync(EXCLUSIONS_FILE)) {
    issues.push(`missing artifact: ${EXCLUSIONS_FILE}`);
  } else {
    const committed = await Bun.file(EXCLUSIONS_FILE).text();
    if (committed !== generatedExclusions) {
      issues.push(`drift detected: ${EXCLUSIONS_FILE}`);
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const checkMode = process.argv.includes('--check');

  let result: GenerateExamplesResult;
  try {
    result = await generateAllExamples();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`examples generator fatal error: ${message}\n`);
    process.exit(1);
  }

  const totalExamples = result.exampleSets.reduce((sum, s) => sum + s.examples.length, 0);
  const totalExclusions = result.exclusions.length;
  const totalErrors = result.errors.length;

  if (checkMode) {
    const issues = await checkExamplesDrift(result);

    if (result.errors.length > 0) {
      process.stderr.write(
        `examples:check — ${result.errors.length} example(s) have errors (see below)\n`,
      );
      for (const error of result.errors.slice(0, 10)) {
        process.stderr.write(`  error [${error.componentId}] ${error.reason}\n`);
      }
    }

    if (issues.length > 0) {
      process.stderr.write(
        `examples:check — drift detected. Run "bun run examples:generate" to fix:\n`,
      );
      for (const issue of issues) process.stderr.write(`  ${issue}\n`);
      process.exit(1);
    }

    if (result.errors.length > 0) {
      // Extraction errors are hard failures, independent of drift.
      process.exit(1);
    }

    process.stdout.write(
      `examples:check — OK (${totalExamples} published, ${totalExclusions} excluded, ${totalErrors} errors)\n`,
    );
    return;
  }

  // Generate mode.
  // Extraction errors must short-circuit before writing any artifact — a
  // partial set of `.examples.json` files would leave the manifest stage with
  // stale `hasExamples` flags.
  if (totalErrors > 0) {
    process.stderr.write(
      `examples:generate — refusing to write artifacts: ${totalErrors} error(s)\n`,
    );
    for (const error of result.errors.slice(0, 10)) {
      process.stderr.write(`  [${error.componentId}] ${error.reason}\n`);
    }
    if (totalErrors > 10) process.stderr.write(`  … and ${totalErrors - 10} more\n`);
    process.exit(1);
  }
  await writeExampleArtifacts(result);

  process.stdout.write(`examples:generate — complete\n`);
  process.stdout.write(`  components with examples: ${result.exampleSets.length}\n`);
  process.stdout.write(`  total examples published: ${totalExamples}\n`);
  process.stdout.write(`  excluded: ${totalExclusions}\n`);
  process.stdout.write(`  errors: ${totalErrors}\n`);

  if (totalExclusions > 0) {
    const reasonBreakdown = new Map<string, number>();
    for (const exclusion of result.exclusions) {
      reasonBreakdown.set(exclusion.reason, (reasonBreakdown.get(exclusion.reason) ?? 0) + 1);
    }
    process.stderr.write(`\nexamples:generate — exclusions by reason:\n`);
    for (const [reason, count] of [...reasonBreakdown.entries()].toSorted(([a], [b]) =>
      a.localeCompare(b),
    )) {
      process.stderr.write(`  ${reason}: ${count}\n`);
    }
  }
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error('generate-component-examples failed:', err);
    process.exit(1);
  });
}
