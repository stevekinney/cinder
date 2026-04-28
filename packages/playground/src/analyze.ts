/**
 * Component manifest analyzer for the cinder playground.
 *
 * Combines two sources of truth:
 *  1. svelte/compiler.parse — reads the $props() destructuring to extract prop names,
 *     bindability ($bindable), and default values.
 *  2. ts-morph — reads the exported `${Name}Props` type alias to determine each
 *     prop's type (and therefore control kind), optionality, and JSDoc description.
 *
 * The $props() destructuring is canonical: only props that appear there are included in
 * the manifest. If the Props type has a property not in the destructuring, it is skipped.
 */

import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { parse } from 'svelte/compiler';
import { Project, type PropertySignature, SyntaxKind, type TypeNode } from 'ts-morph';

import type { ComponentManifest, ControlKind, PropManifest } from './types.ts';

export type { ComponentManifest, ControlKind, PropManifest };

// ---------------------------------------------------------------------------
// Internal types for AST nodes (svelte/compiler returns untyped objects)
// ---------------------------------------------------------------------------

type AstNode = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Control kind inference from ts-morph TypeNode
// ---------------------------------------------------------------------------

/**
 * Infers a control kind from a ts-morph TypeNode.
 * Internal implementation — the public string-based API lives in controls.ts.
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

    // Snippet or Snippet<[...]> → snippet control
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
// Svelte AST helpers — extracting props from $props() destructuring
// ---------------------------------------------------------------------------

type RawPropEntry = {
  name: string;
  defaultValue?: unknown;
  bindable: boolean;
};

/**
 * Parses the right-hand side of an AssignmentPattern (the default value expression)
 * and returns { defaultValue, bindable }.
 */
function parseDefaultExpression(rhs: AstNode): { defaultValue?: unknown; bindable: boolean } {
  if (rhs['type'] === 'Literal') {
    return { defaultValue: rhs['value'], bindable: false };
  }

  if (rhs['type'] === 'ArrayExpression') {
    const elements = rhs['elements'] as AstNode[];
    if (elements.length === 0) return { defaultValue: [], bindable: false };
    const allLiterals = elements.every((el) => el['type'] === 'Literal');
    if (allLiterals) {
      return { defaultValue: elements.map((el) => el['value']), bindable: false };
    }
    return { defaultValue: undefined, bindable: false };
  }

  if (rhs['type'] === 'CallExpression') {
    const callee = rhs['callee'] as AstNode;
    if (callee['type'] === 'Identifier' && callee['name'] === '$bindable') {
      const args = rhs['arguments'] as AstNode[];
      if (args.length === 0) return { defaultValue: undefined, bindable: true };
      const firstArg = args[0];
      if (firstArg === undefined) return { defaultValue: undefined, bindable: true };
      if (firstArg['type'] === 'Literal')
        return { defaultValue: firstArg['value'], bindable: true };
      // ArrayExpression default with $bindable (e.g. $bindable([]))
      if (firstArg['type'] === 'ArrayExpression') {
        const elements = firstArg['elements'] as AstNode[];
        return { defaultValue: elements.map((el) => el['value']), bindable: true };
      }
      return { defaultValue: undefined, bindable: true };
    }
  }

  return { defaultValue: undefined, bindable: false };
}

/**
 * Extracts prop entries from the ObjectPattern of a $props() destructuring.
 * Returns an empty array if the component does not use destructuring (e.g.
 * `const props: Props = $props()`).
 */
function extractPropsFromSvelteAst(source: string): RawPropEntry[] {
  const ast = parse(source, { filename: '__analyze__.svelte' });
  const instanceScript = ast['instance'] as { content: { body: AstNode[] } } | undefined;

  if (instanceScript === undefined) return [];

  const body = instanceScript.content.body;

  for (const node of body) {
    if (node['type'] !== 'VariableDeclaration') continue;

    const declarations = node['declarations'] as AstNode[];
    for (const declarator of declarations) {
      const init = declarator['init'] as AstNode | undefined;
      if (init === undefined) continue;

      // Look for either `$props()` directly or `$props()` as the expression
      const isPropsCall =
        init['type'] === 'CallExpression' &&
        (init['callee'] as AstNode)['type'] === 'Identifier' &&
        (init['callee'] as AstNode)['name'] === '$props';

      if (!isPropsCall) continue;

      const id = declarator['id'] as AstNode;
      if (id['type'] !== 'ObjectPattern') {
        // `const props: Type = $props()` — no destructuring, skip
        return [];
      }

      const properties = id['properties'] as AstNode[];
      const entries: RawPropEntry[] = [];

      for (const property of properties) {
        // RestElement → ...rest spread — skip
        if (property['type'] === 'RestElement') continue;

        const key = property['key'] as AstNode;
        // Computed properties (e.g. [Symbol.iterator]) — skip
        if (property['computed'] === true) continue;

        const rawName: string =
          key['type'] === 'Identifier' ? (key['name'] as string) : (key['value'] as string);

        // class, aria-* and other non-standard names — will be filtered later
        const value = property['value'] as AstNode;

        if (value['type'] === 'AssignmentPattern') {
          const rhs = value['right'] as AstNode;
          const { defaultValue, bindable } = parseDefaultExpression(rhs);
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
// ts-morph helpers — extracting type info from the module script block
// ---------------------------------------------------------------------------

/**
 * Extracts the content of the first `<script lang="ts" module>` block
 * (attribute order doesn't matter — matches both orderings).
 */
function extractModuleScriptContent(source: string): string {
  // Match <script module lang="ts"> or <script lang="ts" module>
  const pattern = /<script[^>]+\bmodule\b[^>]*>([\s\S]*?)<\/script>/;
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

/**
 * Builds a map from prop name → TypeInfo by reading the exported Props type alias
 * from ts-morph. Handles discriminated unions at the top level by walking all arms
 * and merging prop types (conflicting types → unknown).
 */
function buildTypeInfoMap(
  moduleScriptContent: string,
  componentName: string,
): Map<string, TypeInfo> {
  const project = new Project({
    tsConfigFilePath: join(import.meta.dirname, '../../components/tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });

  const syntheticPath = `__synthetic__/${componentName}.ts`;
  const sf = project.createSourceFile(syntheticPath, moduleScriptContent, { overwrite: true });

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
            // Prop missing from this arm → it's optional overall
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

    // TypeLiteral, IntersectionType, TypeReference — collect all properties
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
  const source = readFileSync(filePath, 'utf-8');
  const fileBaseName = basename(filePath, '.svelte');
  const componentName = toPascalCase(fileBaseName);

  const rawProps = extractPropsFromSvelteAst(source);
  const moduleScriptContent = extractModuleScriptContent(source);
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
    importPath: `cinder/${fileBaseName}`,
    props,
  };
}

/** Globs all top-level *.svelte files from componentsDir and analyzes each one. */
export async function analyzeAll(componentsDir: string): Promise<ComponentManifest[]> {
  const glob = new Bun.Glob('*.svelte');
  const filePaths: string[] = [];

  for await (const file of glob.scan({ cwd: componentsDir })) {
    filePaths.push(join(componentsDir, file));
  }

  const manifests = await Promise.all(filePaths.map((filePath) => analyzeComponent(filePath)));

  return manifests.toSorted((a, b) => a.kebabName.localeCompare(b.kebabName));
}
