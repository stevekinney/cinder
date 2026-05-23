/**
 * Generates a JSON Schema (draft 2020-12) for a component's `<name>.types.ts`
 * by walking the exported `*Props` type with `ts-morph`.
 *
 * Public surface — see `SUPPORTED.md` for the type subset this generator
 * understands. Non-JSON-schemable props (snippets, callbacks, generics,
 * mapped/conditional types) are recorded in the schema's `metadata.unsupportedProps`
 * instead of being silently widened or thrown. Only malformed types (`never`,
 * unresolvable references) throw.
 */

import { basename, dirname, join } from 'node:path';

import {
  Project,
  type InterfaceDeclaration,
  type Symbol as MorphSymbol,
  type SourceFile,
  type Type,
  type TypeAliasDeclaration,
} from 'ts-morph';

const SCHEMA_URI = 'https://json-schema.org/draft/2020-12/schema' as const;

export type UnsupportedReason =
  | 'function-or-snippet'
  | 'generic-type-parameter'
  | 'mapped-type'
  | 'conditional-type'
  | 'index-signature'
  | 'unknown-shape';

export interface UnsupportedProp {
  name: string;
  reason: UnsupportedReason;
}

export interface PropertySchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'array' | 'object';
  enum?: ReadonlyArray<string | number | boolean | null>;
  const?: string | number | boolean | null;
  items?: PropertySchema;
  properties?: Record<string, PropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
  anyOf?: PropertySchema[];
  description?: string;
  default?: unknown;
}

export interface ComponentSchemaOutput {
  $schema: typeof SCHEMA_URI;
  type: 'object';
  properties: Record<string, PropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
  metadata?: {
    unsupportedProps?: UnsupportedProp[];
  };
}

export interface GenerateResult {
  /** The schema object suitable for JSON serialization. */
  schema: ComponentSchemaOutput;
  /** Rendered TypeScript module text (the `.schema.ts` file content). */
  schemaModule: string;
  /** Rendered JSON text (the `.schema.json` file content). */
  schemaJson: string;
}

/** Map of project files keyed by absolute path — avoids reparsing across calls. */
let cachedProject: Project | null = null;
let activeTypesFilePath: string | null = null;
function getProject(): Project {
  if (cachedProject) return cachedProject;
  cachedProject = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: false,
  });
  return cachedProject;
}

export interface GenerateOptions {
  /** Optional pre-built project (for tests/fixtures). */
  project?: Project;
  /** Absolute path to `<name>.types.ts`. */
  typesFilePath: string;
  /** Component directory name; used for the relative `schema-types` import. */
  componentName: string;
  /** Depth from component directory up to `src/`. Top-level: 2, experimental: 3. */
  depthToSrc: number;
}

/**
 * Generate a schema for a component's types file.
 *
 * Resolves the exported type matching `<PascalCaseName>Props` — e.g.
 * `ButtonProps` for `button`. Throws if no such export exists.
 */
export function generateSchemaForComponent(options: GenerateOptions): GenerateResult {
  const { typesFilePath, componentName, depthToSrc } = options;
  activeTypesFilePath = typesFilePath;
  const project = options.project ?? getProject();
  const sourceFile = project.addSourceFileAtPath(typesFilePath);

  // Prefer a focused `<Name>SchemaProps` type if exported — that's the explicit
  // allowlist of cinder-specific props, free of HTML attribute spread. Fall back
  // to `<Name>Props`, which works for components without HTML attribute spread.
  const base = toPascalCase(componentName);
  const schemaPropsName = `${base}SchemaProps`;
  const propsTypeName = `${base}Props`;
  const propsType =
    findExportedType(sourceFile, schemaPropsName) ?? findExportedType(sourceFile, propsTypeName);

  if (!propsType) {
    throw new Error(
      `generate-component-schema: ${basename(typesFilePath)} does not export ${schemaPropsName} or ${propsTypeName}`,
    );
  }

  const properties: Record<string, PropertySchema> = {};
  const required: string[] = [];
  const unsupportedProps: UnsupportedProp[] = [];

  // When falling back to `<Name>Props`, filter out properties inherited from
  // svelte/elements HTML attribute types. Without this, every component that
  // intersects with `HTMLAttributes` produces 200+ rows of aria-*, on*, and
  // global-attribute props in its generated schema and README — drowning the
  // cinder-specific props in noise. A focused `<Name>SchemaProps` interface
  // (when present) is the authored allowlist; in its absence, we apply a
  // declared-in-svelte-elements heuristic.
  const usedFocusedAllowList = Boolean(findExportedType(sourceFile, schemaPropsName));

  const memberSymbols = propsType.getProperties();
  for (const symbol of memberSymbols) {
    const propName = symbol.getName();

    if (!usedFocusedAllowList && isInheritedFromSvelteElements(symbol)) {
      continue;
    }

    const propType = getPropType(symbol);

    const converted = convertType(propType, 0, hasJsDocTag(symbol, 'schemaObject'));
    if (converted.kind === 'unsupported') {
      unsupportedProps.push({ name: propName, reason: converted.reason });
      continue;
    }

    const description = readJsDocDescription(symbol);
    const defaultValue = readJsDocDefault(symbol);
    const schemaEntry: PropertySchema = { ...converted.schema };
    if (description) schemaEntry.description = description;
    if (defaultValue !== undefined) schemaEntry.default = defaultValue;
    properties[propName] = schemaEntry;

    if (!symbol.isOptional()) required.push(propName);
  }

  const schema: ComponentSchemaOutput = {
    $schema: SCHEMA_URI,
    type: 'object',
    properties,
    additionalProperties: false,
  };
  if (required.length > 0) schema.required = required.toSorted();
  if (unsupportedProps.length > 0) {
    schema.metadata = {
      unsupportedProps: unsupportedProps.toSorted((a, b) => a.name.localeCompare(b.name)),
    };
  }

  const schemaJson = JSON.stringify(schema, null, 2) + '\n';
  const schemaModule = renderSchemaModule(schema, depthToSrc);

  return { schema, schemaJson, schemaModule };
}

interface ConvertSuccess {
  kind: 'ok';
  schema: PropertySchema;
}

interface ConvertUnsupported {
  kind: 'unsupported';
  reason: UnsupportedReason;
}

type ConvertResult = ConvertSuccess | ConvertUnsupported;

function convertType(type: Type, depth = 0, expandObjectShapes = false): ConvertResult {
  // Strip `undefined` — optional props are handled by `symbol.isOptional()`,
  // so the schema only needs to describe the present-value type.
  if (type.isUnion()) {
    const parts = type.getUnionTypes().filter((t) => !t.isUndefined());
    if (parts.length === 0) return { kind: 'unsupported', reason: 'unknown-shape' };
    if (parts.length === 1) return convertSingleType(parts[0]!, depth, expandObjectShapes);
    // After stripping undefined, if every remaining type is a boolean literal
    // (`true` and `false`), collapse to a plain boolean schema rather than an enum.
    if (parts.length === 2 && parts.every((t) => t.isBooleanLiteral())) {
      return { kind: 'ok', schema: { type: 'boolean' } };
    }
    return convertUnion(parts, depth, expandObjectShapes);
  }

  return convertSingleType(type, depth, expandObjectShapes);
}

function convertUnion(parts: Type[], depth = 0, expandObjectShapes = false): ConvertResult {
  const nonNullParts = parts.filter((t) => !t.isNull());
  const hasNull = parts.some((t) => t.isNull());

  // Literal union → enum
  if (nonNullParts.every((t) => t.isLiteral())) {
    const values: Array<string | number | boolean | null> = nonNullParts.map(literalValue);
    if (hasNull) values.push(null);
    return { kind: 'ok', schema: { enum: values } };
  }

  // Mixed-shape union → anyOf, but each part must be convertible.
  const anyOf: PropertySchema[] = [];
  for (const part of nonNullParts) {
    const converted = convertSingleType(part, depth, expandObjectShapes);
    if (converted.kind === 'unsupported') return converted;
    anyOf.push(converted.schema);
  }
  if (hasNull) anyOf.push({ type: 'null' });
  return { kind: 'ok', schema: { anyOf } };
}

function convertSingleType(type: Type, depth = 0, expandObjectShapes = false): ConvertResult {
  if (type.isStringLiteral())
    return { kind: 'ok', schema: { const: type.getLiteralValueOrThrow() as string } };
  if (type.isNumberLiteral())
    return { kind: 'ok', schema: { const: type.getLiteralValueOrThrow() as number } };
  if (type.isBooleanLiteral()) {
    return { kind: 'ok', schema: { const: type.getText() === 'true' } };
  }
  if (type.isString()) return { kind: 'ok', schema: { type: 'string' } };
  if (type.isNumber()) return { kind: 'ok', schema: { type: 'number' } };
  if (type.isBoolean()) return { kind: 'ok', schema: { type: 'boolean' } };
  if (type.isNull()) return { kind: 'ok', schema: { type: 'null' } };

  if (type.isArray()) {
    const element = type.getArrayElementTypeOrThrow();
    const inner = convertType(element, depth + 1, expandObjectShapes);
    if (inner.kind === 'unsupported') return inner;
    return { kind: 'ok', schema: { type: 'array', items: inner.schema } };
  }

  // Function / snippet / callable
  if (type.getCallSignatures().length > 0) {
    return { kind: 'unsupported', reason: 'function-or-snippet' };
  }

  // Type parameter (generic)
  if (type.isTypeParameter()) {
    return { kind: 'unsupported', reason: 'generic-type-parameter' };
  }

  // Object: best-effort — only allow plain `Record<string, X>`-shaped or
  // empty objects. Anything with structural surface beyond that becomes
  // unsupported. This keeps the schema generator simple while still covering
  // most prop shapes.
  if (type.isObject()) {
    const stringIndex = type.getStringIndexType();
    if (stringIndex) {
      const inner = convertType(stringIndex, depth + 1, expandObjectShapes);
      if (inner.kind === 'unsupported') return inner;
      return { kind: 'ok', schema: { type: 'object' } };
    }

    if (depth > 2 || !expandObjectShapes || !isDeclaredInActiveTypesFile(type)) {
      return { kind: 'ok', schema: { type: 'object' } };
    }

    const properties: Record<string, PropertySchema> = {};
    const required: string[] = [];

    for (const property of type.getProperties()) {
      const converted = convertType(getPropType(property), depth + 1, expandObjectShapes);
      if (converted.kind === 'unsupported') return { kind: 'ok', schema: { type: 'object' } };

      const schemaEntry: PropertySchema = { ...converted.schema };
      const description = readJsDocDescription(property);
      const defaultValue = readJsDocDefault(property);
      if (description) schemaEntry.description = description;
      if (defaultValue !== undefined) schemaEntry.default = defaultValue;
      properties[property.getName()] = schemaEntry;

      if (!property.isOptional()) required.push(property.getName());
    }

    if (Object.keys(properties).length === 0) return { kind: 'ok', schema: { type: 'object' } };

    return {
      kind: 'ok',
      schema: {
        type: 'object',
        properties,
        additionalProperties: false,
        ...(required.length > 0 ? { required: required.toSorted() } : {}),
      },
    };
  }

  return { kind: 'unsupported', reason: 'unknown-shape' };
}

function isDeclaredInActiveTypesFile(type: Type): boolean {
  if (activeTypesFilePath === null) return false;

  const declarations = [
    ...(type.getAliasSymbol()?.getDeclarations() ?? []),
    ...(type.getSymbol()?.getDeclarations() ?? []),
  ];

  return declarations.some(
    (declaration) => declaration.getSourceFile().getFilePath() === activeTypesFilePath,
  );
}

function literalValue(type: Type): string | number | boolean {
  if (type.isStringLiteral()) return type.getLiteralValueOrThrow() as string;
  if (type.isNumberLiteral()) return type.getLiteralValueOrThrow() as number;
  if (type.isBooleanLiteral()) return type.getText() === 'true';
  throw new Error(`literalValue called on non-literal type: ${type.getText()}`);
}

/**
 * True when the property symbol's declaration sites are *all* inside
 * `svelte/elements` — i.e. it's a purely-inherited HTML attribute like
 * `aria-label`, `onclick`, `id`. Used to skip those props when falling back
 * to a `<Name>Props` type that intersects with `HTMLAttributes`.
 *
 * Filtering is by **declaration site**, not by name. A component-defined
 * `disabled: boolean` declared in `src/` is preserved even though
 * `HTMLButtonAttributes` also declares a `disabled?: boolean | null` — at
 * least one declaration is local, so the property keeps its place in the
 * schema. The same logic handles `Omit<...> & { disabled: ... }` (the Omit
 * removes the svelte/elements declaration, leaving only the local one) and
 * straight intersection shadows (both declarations present; one is local).
 *
 * `class` is declared inside `svelte/elements` but is meaningful for every
 * component and is allowlisted by name as a deliberate exception.
 */
function isInheritedFromSvelteElements(symbol: MorphSymbol): boolean {
  if (symbol.getName() === 'class') return false;
  const declarations = symbol.getDeclarations();
  if (declarations.length === 0) return false;
  const htmlAttributeDeclarationPaths = getHtmlAttributeDeclarationSites();
  for (const declaration of declarations) {
    const sourceFilePath = declaration.getSourceFile().getFilePath();
    if (!htmlAttributeDeclarationPaths.has(sourceFilePath)) {
      // At least one declaration lives outside svelte/elements — this is a
      // local prop (possibly shadowing an HTML attribute). Keep it.
      return false;
    }
  }
  return true;
}

/**
 * Set of absolute source-file paths whose declarations define HTML attributes
 * inherited by Svelte components (i.e. `svelte/elements.d.ts` and its sibling
 * `.d.ts` files in `node_modules/svelte/`).
 *
 * Computed once per process. The Project used to ask ts-morph for these paths
 * is the cached schema project — already pointed at the workspace tsconfig —
 * so resolution sees the same `svelte` package the consumers see.
 */
let cachedHtmlAttributeDeclarationSites: Set<string> | null = null;
function getHtmlAttributeDeclarationSites(): Set<string> {
  if (cachedHtmlAttributeDeclarationSites) return cachedHtmlAttributeDeclarationSites;
  const sites = new Set<string>();
  const project = getProject();
  // Resolve `svelte/elements` via Bun (works whether or not ts-morph has the
  // file in its project) then add every sibling `.d.ts` under that directory
  // to the set. Svelte spreads its HTML attribute interfaces across
  // `elements.d.ts` plus a handful of internal helper files; matching by
  // directory is robust to that layout without hard-coding filenames.
  let sveltePackageEntry: string;
  try {
    sveltePackageEntry = Bun.resolveSync('svelte/package.json', process.cwd());
  } catch {
    // No svelte in scope — return empty set. The filter degrades to "filter
    // nothing", which is the conservative behaviour for the fallback path.
    cachedHtmlAttributeDeclarationSites = sites;
    return sites;
  }
  const svelteDirectory = dirname(sveltePackageEntry);
  const elementsFilePath = join(svelteDirectory, 'elements.d.ts');
  const declarationGlob = new Bun.Glob('*.d.ts');
  for (const relativePath of declarationGlob.scanSync({ cwd: svelteDirectory, absolute: true })) {
    sites.add(relativePath);
  }
  // Ensure ts-morph knows about elements.d.ts itself — some downstream callers
  // walk back from a property's declaration through ts-morph and need the
  // source file resolvable. Adding it here is a no-op if it's already loaded.
  if (project.getSourceFile(elementsFilePath) === undefined) {
    try {
      project.addSourceFileAtPath(elementsFilePath);
    } catch {
      // Best-effort; the path-set is the source of truth for filtering.
    }
  }
  cachedHtmlAttributeDeclarationSites = sites;
  return sites;
}

function getPropType(symbol: MorphSymbol): Type {
  const declarations = symbol.getDeclarations();
  const decl = declarations[0];
  if (!decl) {
    throw new Error(`Symbol ${symbol.getName()} has no declarations`);
  }
  return symbol.getTypeAtLocation(decl);
}

function findExportedType(sourceFile: SourceFile, name: string): Type | null {
  const iface: InterfaceDeclaration | undefined = sourceFile.getInterface(name);
  if (iface && iface.isExported()) return iface.getType();
  const alias: TypeAliasDeclaration | undefined = sourceFile.getTypeAlias(name);
  if (alias && alias.isExported()) return alias.getType();
  return null;
}

function readJsDocDescription(symbol: MorphSymbol): string | undefined {
  const tags = symbol
    .getDeclarations()
    .flatMap((d) =>
      'getJsDocs' in d
        ? (d as { getJsDocs(): Array<{ getDescription(): string }> }).getJsDocs()
        : [],
    );
  for (const doc of tags) {
    const text = doc.getDescription().trim();
    if (text) return text;
  }
  return undefined;
}

function readJsDocDefault(symbol: MorphSymbol): unknown {
  for (const decl of symbol.getDeclarations()) {
    if (!('getJsDocs' in decl)) continue;
    const docs = (
      decl as {
        getJsDocs(): Array<{
          getTags(): Array<{ getTagName(): string; getCommentText(): string | undefined }>;
        }>;
      }
    ).getJsDocs();
    for (const doc of docs) {
      for (const tag of doc.getTags()) {
        if (tag.getTagName() === 'default') {
          const raw = tag.getCommentText();
          if (raw === undefined) return undefined;
          return parseDefaultValue(raw.trim());
        }
      }
    }
  }
  return undefined;
}

function hasJsDocTag(symbol: MorphSymbol, tagName: string): boolean {
  for (const decl of symbol.getDeclarations()) {
    if (!('getJsDocs' in decl)) continue;
    const docs = (
      decl as {
        getJsDocs(): Array<{
          getTags(): Array<{ getTagName(): string }>;
        }>;
      }
    ).getJsDocs();
    if (docs.some((doc) => doc.getTags().some((tag) => tag.getTagName() === tagName))) {
      return true;
    }
  }
  return false;
}

function parseDefaultValue(raw: string): unknown {
  // Strip optional surrounding backticks like `@default `true``.
  const trimmed = raw.replace(/^`+|`+$/g, '').trim();
  if (trimmed === '') return undefined;
  // Try JSON first (covers numbers, booleans, null, quoted strings).
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall back to a string literal value.
    return trimmed;
  }
}

function toPascalCase(kebab: string): string {
  return kebab
    .split(/[-/]/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join('');
}

function renderSchemaModule(schema: ComponentSchemaOutput, depthToSrc: number): string {
  const relativePath = '../'.repeat(depthToSrc) + 'schema-types';
  const literal = JSON.stringify(schema, null, 2);
  return [
    `import type { ComponentSchema } from '${relativePath}';`,
    ``,
    `const schema = ${literal} satisfies ComponentSchema;`,
    ``,
    `export default schema as ComponentSchema;`,
    ``,
  ].join('\n');
}

export function resetSchemaProjectCache(): void {
  cachedProject = null;
  cachedHtmlAttributeDeclarationSites = null;
}

if (import.meta.main) {
  // CLI entry: `bun scripts/generate-component-schema.ts <component-dir>`
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: generate-component-schema.ts <component-dir>');
    process.exit(1);
  }
  const componentName = basename(dir);
  const typesFilePath = join(dir, `${componentName}.types.ts`);
  const isExperimental = dir.includes('/experimental/');
  const depthToSrc = isExperimental ? 3 : 2;
  const result = generateSchemaForComponent({ typesFilePath, componentName, depthToSrc });
  await Bun.write(join(dir, `${componentName}.schema.json`), result.schemaJson);
  await Bun.write(join(dir, `${componentName}.schema.ts`), result.schemaModule);
  console.log(`wrote ${componentName}.schema.{json,ts}`);
}
