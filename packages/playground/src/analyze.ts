/**
 * Component manifest analyzer for the cinder playground.
 *
 * Combines two sources of truth:
 *  1. svelte/compiler.parse â reads the $props() destructuring to extract prop names,
 *     bindability ($bindable), and default values.
 *  2. ts-morph â reads the exported `${Name}Props` type alias to determine each
 *     prop's type (and therefore control kind), optionality, and JSDoc description.
 *
 * The $props() destructuring is canonical: only props that appear there are included in
 * the manifest. If the Props type has a property not in the destructuring, it is skipped.
 */

import { basename, join } from 'node:path';

import type { Expression, Pattern, Property, SpreadElement } from 'estree';
import { type AST, parse } from 'svelte/compiler';
import { Project, type PropertySignature, SyntaxKind, type TypeNode } from 'ts-morph';

import { discoverComponentFilePaths } from './discover.ts';
import type { ComponentManifest, ControlKind, PropManifest } from './types.ts';

export type { ComponentManifest, ControlKind, PropManifest };

// ---------------------------------------------------------------------------
// Control kind inference from ts-morph TypeNode
// ---------------------------------------------------------------------------

/**
 * Infers a control kind from a ts-morph TypeNode.
 */
function inferControlKindFromTypeNode(
  typeNode: TypeNode | undefined,
  typeText: string,
): ControlKind {
  if (typeNode === undefined) return { kind: 'unknown', rawType: typeText };

  const kind = typeNode.getKind();

  if (kind === SyntaxKind.BooleanKeyword) return { kind: 'boolean' };
  if (kind === SyntaxKind.NumberKeyword) return { kind: 'number' };
  if (kind === SyntaxKind.StringKeyword) return { kind: 'text' };

  if (kind === SyntaxKind.UnionType) {
    const union = typeNode.asKindOrThrow(SyntaxKind.UnionType);
    const members = union.getTypeNodes();
    const stringLiterals: string[] = [];
    let allStringLiterals = true;

    for (const member of members) {
      if (member.getKind() === SyntaxKind.LiteralType) {
        const literal = member.asKindOrThrow(SyntaxKind.LiteralType).getLiteral();
        if (literal.getKind() === SyntaxKind.StringLiteral) {
          // getText() includes quotes; remove them
          stringLiterals.push(literal.getText().replace(/^['"]|['"]$/g, ''));
          continue;
        }
      }
      allStringLiterals = false;
      break;
    }

    if (allStringLiterals && stringLiterals.length > 0) {
      return { kind: 'select', options: stringLiterals };
    }
    return { kind: 'unknown', rawType: typeText };
  }

  if (kind === SyntaxKind.TypeReference) {
    const ref = typeNode.asKindOrThrow(SyntaxKind.TypeReference);
    const name = ref.getTypeName().getText();

    // Snippet or Snippet<[...]> â snippet control
    if (name === 'Snippet') return { kind: 'snippet' };

    // Try to resolve the referenced alias in the same source file
    const sf = typeNode.getSourceFile();
    const alias = sf.getTypeAlias(name);
    if (alias !== undefined) {
      const resolvedNode = alias.getTypeNode();
      return inferControlKindFromTypeNode(resolvedNode, resolvedNode?.getText() ?? typeText);
    }

    return { kind: 'unknown', rawType: typeText };
  }

  return { kind: 'unknown', rawType: typeText };
}

// ---------------------------------------------------------------------------
// Svelte AST helpers â extracting props from $props() destructuring
// ---------------------------------------------------------------------------

type RawPropEntry = {
  name: string;
  defaultValue?: unknown;
  bindable: boolean;
};

/**
 * Returns the literal value of an array element, or `undefined` for holes,
 * spreads, and any non-literal expression.
 */
function literalElementValue(element: Expression | SpreadElement | null): unknown {
  if (element !== null && element.type === 'Literal') return element.value;
  return undefined;
}

/**
 * Parses the right-hand side of an AssignmentPattern (the default value expression)
 * and returns { defaultValue, bindable }.
 */
function parseDefaultExpression(rhs: Expression): { defaultValue?: unknown; bindable: boolean } {
  if (rhs.type === 'Literal') {
    return { defaultValue: rhs.value, bindable: false };
  }

  if (rhs.type === 'ArrayExpression') {
    const elements = rhs.elements;
    if (elements.length === 0) return { defaultValue: [], bindable: false };
    const allLiterals = elements.every((el) => el !== null && el.type === 'Literal');
    if (allLiterals) {
      return { defaultValue: elements.map(literalElementValue), bindable: false };
    }
    return { defaultValue: undefined, bindable: false };
  }

  if (rhs.type === 'CallExpression') {
    const callee = rhs.callee;
    if (callee.type === 'Identifier' && callee.name === '$bindable') {
      const args = rhs.arguments;
      if (args.length === 0) return { defaultValue: undefined, bindable: true };
      const firstArg = args[0];
      if (firstArg === undefined || firstArg.type === 'SpreadElement') {
        return { defaultValue: undefined, bindable: true };
      }
      if (firstArg.type === 'Literal') return { defaultValue: firstArg.value, bindable: true };
      // ArrayExpression default with $bindable (e.g. $bindable([]))
      if (firstArg.type === 'ArrayExpression') {
        return { defaultValue: firstArg.elements.map(literalElementValue), bindable: true };
      }
      return { defaultValue: undefined, bindable: true };
    }
  }

  return { defaultValue: undefined, bindable: false };
}

/**
 * Resolves the static name of an object-pattern property key. Returns
 * `undefined` for keys that don't have a usable static name (e.g. a numeric
 * `Literal` key on a destructured prop, which Svelte components never use).
 */
function staticPropertyKeyName(key: Property['key']): string | undefined {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return undefined;
}

/**
 * Extracts prop entries from the ObjectPattern of a $props() destructuring.
 * Returns an empty array if the component does not use destructuring (e.g.
 * `const props: Props = $props()`).
 */
function extractPropsFromSvelteAst(source: string): RawPropEntry[] {
  const ast: AST.Root = parse(source, { filename: '__analyze__.svelte', modern: true });
  const instanceScript = ast.instance;

  // `AST.Root.instance` is typed `Script | null`, but `parse(..., { modern: true })`
  // returns `undefined` (not `null`) when a component has no instance `<script>`
  // block — e.g. markup-only components, or ones with only a `<script module>`.
  // A strict `=== null` check misses that case and falls through to
  // `instanceScript.content`, throwing a TypeError. Use a nullish check so both
  // `null` and `undefined` short-circuit to "no destructured props".
  if (!instanceScript) return [];

  const body = instanceScript.content.body;

  for (const node of body) {
    if (node.type !== 'VariableDeclaration') continue;

    for (const declarator of node.declarations) {
      const init = declarator.init;
      if (init === undefined || init === null) continue;

      // Look for `$props()` as the initializer expression.
      const isPropsCall =
        init.type === 'CallExpression' &&
        init.callee.type === 'Identifier' &&
        init.callee.name === '$props';

      if (!isPropsCall) continue;

      const id: Pattern = declarator.id;
      if (id.type !== 'ObjectPattern') {
        // `const props: Type = $props()` â no destructuring, skip
        return [];
      }

      const entries: RawPropEntry[] = [];

      for (const property of id.properties) {
        // RestElement â ...rest spread â skip
        if (property.type === 'RestElement') continue;

        // Computed properties (e.g. [Symbol.iterator]) â skip
        if (property.computed) continue;

        const rawName = staticPropertyKeyName(property.key);
        if (rawName === undefined) continue;

        // class, aria-* and other non-standard names â will be filtered later
        const value = property.value;

        if (value.type === 'AssignmentPattern') {
          const { defaultValue, bindable } = parseDefaultExpression(value.right);
          entries.push({ name: rawName, defaultValue, bindable });
        } else {
          // No default value
          entries.push({ name: rawName, defaultValue: undefined, bindable: false });
        }
      }

      return entries;
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// ts-morph helpers â extracting type info from the module script block
// ---------------------------------------------------------------------------

/**
 * Extracts the content of the first `<script lang="ts" module>` block.
 *
 * Attribute order doesn't matter and the `module` attribute may stand alone:
 * `<script module>`, `<script module lang="ts">`, and `<script lang="ts" module>`
 * all match. The leading `[^>]*` (not `[^>]+`) is what permits the bare
 * `<script module>` form valid in Svelte 5.
 */
function extractModuleScriptContent(source: string): string {
  const pattern = /<script[^>]*\bmodule\b[^>]*>([\s\S]*?)<\/script>/;
  const match = pattern.exec(source);
  return match?.[1] ?? '';
}

/**
 * Collects property signatures from a TypeLiteral node into a map.
 * Handles intersection types by recursively merging all TypeLiteral arms.
 */
function collectPropertiesFromTypeNode(
  typeNode: TypeNode,
  map: Map<string, PropertySignature>,
): void {
  const kind = typeNode.getKind();

  if (kind === SyntaxKind.TypeLiteral) {
    for (const member of typeNode.asKindOrThrow(SyntaxKind.TypeLiteral).getMembers()) {
      if (member.getKind() === SyntaxKind.PropertySignature) {
        const prop = member.asKindOrThrow(SyntaxKind.PropertySignature);
        const name = prop.getName();
        if (!map.has(name)) {
          map.set(name, prop);
        }
      }
    }
    return;
  }

  if (kind === SyntaxKind.IntersectionType) {
    for (const arm of typeNode.asKindOrThrow(SyntaxKind.IntersectionType).getTypeNodes()) {
      collectPropertiesFromTypeNode(arm, map);
    }
    return;
  }

  if (kind === SyntaxKind.TypeReference) {
    const ref = typeNode.asKindOrThrow(SyntaxKind.TypeReference);
    const name = ref.getTypeName().getText();
    const sf = typeNode.getSourceFile();
    const alias = sf.getTypeAlias(name);
    if (alias !== undefined) {
      const resolved = alias.getTypeNode();
      if (resolved !== undefined) collectPropertiesFromTypeNode(resolved, map);
    }
    return;
  }

  if (kind === SyntaxKind.ParenthesizedType) {
    collectPropertiesFromTypeNode(
      typeNode.asKindOrThrow(SyntaxKind.ParenthesizedType).getTypeNode(),
      map,
    );
    return;
  }
}

type TypeInfo = {
  control: ControlKind;
  optional: boolean;
  description: string | undefined;
};

// ---------------------------------------------------------------------------
// Shared ts-morph Project
// ---------------------------------------------------------------------------
//
// `analyzeAll` runs `analyzeComponent` concurrently via `Promise.all` for ~100
// components. Creating a fresh `Project` per call spins up ~100 TypeScript
// compiler instances, which is the dominant cost of a cold manifest build.
//
// Instead we keep one module-scoped `Project`, created lazily on first use, and
// reuse it across every call. Each `buildTypeInfoMap` call adds a synthetic
// source file under a unique path (so concurrent calls never collide), reads
// the type info, then removes the file so the project doesn't accumulate stale
// sources or leak memory.

/** The shared ts-morph project, created lazily on first analysis. */
let sharedProject: Project | undefined;
/** Number of `Project` instances created — exposed for tests to assert sharing. */
let projectCreationCount = 0;
/** Monotonic counter guaranteeing a unique synthetic source-file path per call. */
let syntheticFileCounter = 0;

/**
 * Returns the shared ts-morph `Project`, creating it on first use. Subsequent
 * calls return the same instance so concurrent `analyzeComponent` runs share a
 * single TypeScript compiler.
 */
function getSharedProject(): Project {
  if (sharedProject === undefined) {
    sharedProject = new Project({
      tsConfigFilePath: join(import.meta.dirname, '../../components/tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    });
    projectCreationCount += 1;
  }
  return sharedProject;
}

/**
 * Disposes the shared ts-morph `Project` so the next analysis builds a fresh
 * one. Wire this into manifest-cache invalidation (e.g. the playground
 * watcher's rebuild path) so a long-running server never accumulates stale
 * compiler state across rebuilds.
 */
export function resetProject(): void {
  sharedProject = undefined;
}

/**
 * Returns how many ts-morph `Project` instances have been created since module
 * load. Tests use this to assert the project is shared across calls and that
 * {@link resetProject} forces exactly one new instance.
 */
export function getProjectCreationCount(): number {
  return projectCreationCount;
}

/**
 * Builds a map from prop name â TypeInfo by reading the exported Props type alias
 * from ts-morph. Handles discriminated unions at the top level by walking all arms
 * and merging prop types (conflicting types â unknown).
 */
function buildTypeInfoMap(
  moduleScriptContent: string,
  componentName: string,
): Map<string, TypeInfo> {
  const project = getSharedProject();

  // A unique path per call keeps concurrent `analyzeComponent` runs (and repeat
  // analyses of the same component) from clobbering each other's source file on
  // the shared project.
  syntheticFileCounter += 1;
  const syntheticPath = `__synthetic__/${componentName}.${syntheticFileCounter}.ts`;
  const sf = project.createSourceFile(syntheticPath, moduleScriptContent);

  try {
    return extractTypeInfo(sf, componentName);
  } finally {
    // Remove the synthetic source file so the shared project doesn't accumulate
    // stale sources or leak memory across the ~100 components analyzed per build.
    project.removeSourceFile(sf);
  }
}

/**
 * Reads the exported `${componentName}Props` type alias from an already-created
 * ts-morph source file and returns a prop name → {@link TypeInfo} map. Split out
 * of {@link buildTypeInfoMap} so the synthetic source file can be removed in a
 * `finally` regardless of which early-return path is taken.
 */
function extractTypeInfo(
  sf: ReturnType<Project['createSourceFile']>,
  componentName: string,
): Map<string, TypeInfo> {
  const propsAliasName = `${componentName}Props`;
  const propsAlias = sf.getTypeAlias(propsAliasName);

  if (propsAlias === undefined) return new Map();

  const typeNode = propsAlias.getTypeNode();
  if (typeNode === undefined) return new Map();

  const result = new Map<string, TypeInfo>();

  function processTypeNode(node: TypeNode): void {
    const nodeKind = node.getKind();

    // Discriminated union at the top level: walk all arms and merge
    if (nodeKind === SyntaxKind.UnionType) {
      const union = node.asKindOrThrow(SyntaxKind.UnionType);
      const perArmMaps: Array<Map<string, PropertySignature>> = [];

      for (const arm of union.getTypeNodes()) {
        const armMap = new Map<string, PropertySignature>();
        collectPropertiesFromTypeNode(arm, armMap);
        perArmMaps.push(armMap);
      }

      // Merge: collect all unique prop names across arms
      const allNames = new Set<string>();
      for (const armMap of perArmMaps) {
        for (const name of armMap.keys()) allNames.add(name);
      }

      for (const name of allNames) {
        // Gather all type texts from arms that have this prop
        const typeTexts: string[] = [];
        let firstProp: PropertySignature | undefined;
        let description: string | undefined;
        let optional = false;

        for (const armMap of perArmMaps) {
          const prop = armMap.get(name);
          if (prop !== undefined) {
            const tn = prop.getTypeNode();
            typeTexts.push(tn?.getText() ?? '?');
            if (firstProp === undefined) {
              firstProp = prop;
              description =
                prop
                  .getJsDocs()
                  .map((d) => d.getDescription().trim())
                  .join('') || undefined;
            }
            if (prop.hasQuestionToken()) optional = true;
          } else {
            // Prop missing from this arm â it's optional overall
            optional = true;
          }
        }

        if (firstProp === undefined) continue;

        // If all arms agree on type text, use that; otherwise unknown
        const uniqueTexts = [...new Set(typeTexts)];
        let control: ControlKind;
        if (uniqueTexts.length === 1 && firstProp !== undefined) {
          control = inferControlKindFromTypeNode(firstProp.getTypeNode(), uniqueTexts[0] ?? '?');
        } else {
          control = { kind: 'unknown', rawType: 'discriminated-union' };
        }

        result.set(name, { control, optional, description });
      }

      return;
    }

    // TypeLiteral, IntersectionType, TypeReference â collect all properties
    const propMap = new Map<string, PropertySignature>();
    collectPropertiesFromTypeNode(node, propMap);

    for (const [name, prop] of propMap) {
      const typeNodeForProp = prop.getTypeNode();
      const typeText = typeNodeForProp?.getText() ?? '?';
      const control = inferControlKindFromTypeNode(typeNodeForProp, typeText);
      const optional = prop.hasQuestionToken();
      const description =
        prop
          .getJsDocs()
          .map((d) => d.getDescription().trim())
          .join('') || undefined;

      result.set(name, { control, optional, description });
    }
  }

  processTypeNode(typeNode);
  return result;
}

// ---------------------------------------------------------------------------
// Derive component name from file path
// ---------------------------------------------------------------------------

function toPascalCase(kebab: string): string {
  return kebab.replace(/(^|-)([a-z])/g, (_, _sep, char: string) => char.toUpperCase());
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

const SKIP_PROPS = new Set(['class', 'rest']);

/** Analyzes a single Svelte component file and returns its ComponentManifest. */
export async function analyzeComponent(filePath: string): Promise<ComponentManifest> {
  const source = await Bun.file(filePath).text();
  const fileBaseName = basename(filePath, '.svelte');
  const componentName = toPascalCase(fileBaseName);

  const rawProps = extractPropsFromSvelteAst(source);
  let moduleScriptContent = extractModuleScriptContent(source);

  // After the per-directory migration, the .svelte module script may only
  // re-export types from <name>.types.ts. Concatenate the types-file content
  // so the existing module-script type walker finds the Props alias.
  const typesFilePath = filePath.replace(/\.svelte$/, '.types.ts');
  const typesFile = Bun.file(typesFilePath);
  if (await typesFile.exists()) {
    const typesSource = await typesFile.text();
    moduleScriptContent = `${moduleScriptContent}\n${typesSource}`;
  }

  const typeInfoMap = buildTypeInfoMap(moduleScriptContent, componentName);

  const props: PropManifest[] = [];

  for (const rawProp of rawProps) {
    const { name, defaultValue, bindable } = rawProp;

    // Skip class, ...rest, and aria-* attributes
    if (SKIP_PROPS.has(name)) continue;
    if (name.startsWith('aria-')) continue;
    // Skip names with colons (e.g. aria-* style quoted keys aren't possible here,
    // but guard against potential 'class:...' patterns)
    if (name.includes(':')) continue;

    const typeInfo = typeInfoMap.get(name);
    const control: ControlKind = typeInfo?.control ?? { kind: 'unknown', rawType: '?' };
    const optional = typeInfo?.optional ?? false;
    const description = typeInfo?.description;

    const manifest: PropManifest = {
      name,
      control,
      bindable,
      optional,
    };

    if (defaultValue !== undefined) manifest.defaultValue = defaultValue;
    if (description !== undefined) manifest.description = description;

    props.push(manifest);
  }

  return {
    name: componentName,
    kebabName: fileBaseName,
    file: filePath,
    importPath: `@lostgradient/cinder/${fileBaseName}`,
    props,
  };
}

/**
 * Discovers and analyzes every public component under `componentsDir`. Covers
 * both legacy flat components (`<name>.svelte` at the top level) and the
 * migrated per-directory layout (`<name>/<name>.svelte`). Underscore-prefixed
 * names are excluded as internal-only.
 *
 * The file-path scan is shared with `discover.discoverComponents` via
 * {@link discoverComponentFilePaths} so the two stay in lockstep.
 */
export async function analyzeAll(componentsDir: string): Promise<ComponentManifest[]> {
  const filePaths = await discoverComponentFilePaths(componentsDir);

  const manifests = await Promise.all(filePaths.map((filePath) => analyzeComponent(filePath)));

  return manifests.toSorted((a, b) => a.kebabName.localeCompare(b.kebabName));
}
