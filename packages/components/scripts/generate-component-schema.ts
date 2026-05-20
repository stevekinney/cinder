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

import { basename, join } from 'node:path';

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

    const converted = convertType(propType);
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

function convertType(type: Type): ConvertResult {
  // Strip `undefined` — optional props are handled by `symbol.isOptional()`,
  // so the schema only needs to describe the present-value type.
  if (type.isUnion()) {
    const parts = type.getUnionTypes().filter((t) => !t.isUndefined());
    if (parts.length === 0) return { kind: 'unsupported', reason: 'unknown-shape' };
    if (parts.length === 1) return convertSingleType(parts[0]!);
    // After stripping undefined, if every remaining type is a boolean literal
    // (`true` and `false`), collapse to a plain boolean schema rather than an enum.
    if (parts.length === 2 && parts.every((t) => t.isBooleanLiteral())) {
      return { kind: 'ok', schema: { type: 'boolean' } };
    }
    return convertUnion(parts);
  }

  return convertSingleType(type);
}

function convertUnion(parts: Type[]): ConvertResult {
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
    const converted = convertSingleType(part);
    if (converted.kind === 'unsupported') return converted;
    anyOf.push(converted.schema);
  }
  if (hasNull) anyOf.push({ type: 'null' });
  return { kind: 'ok', schema: { anyOf } };
}

function convertSingleType(type: Type): ConvertResult {
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
    const inner = convertType(element);
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
      const inner = convertType(stringIndex);
      if (inner.kind === 'unsupported') return inner;
      return { kind: 'ok', schema: { type: 'object' } };
    }
    // Plain object shape with members — not currently modeled; emit a typed
    // object placeholder.
    return { kind: 'ok', schema: { type: 'object' } };
  }

  return { kind: 'unsupported', reason: 'unknown-shape' };
}

function literalValue(type: Type): string | number | boolean {
  if (type.isStringLiteral()) return type.getLiteralValueOrThrow() as string;
  if (type.isNumberLiteral()) return type.getLiteralValueOrThrow() as number;
  if (type.isBooleanLiteral()) return type.getText() === 'true';
  throw new Error(`literalValue called on non-literal type: ${type.getText()}`);
}

/**
 * True when the property is declared inside `svelte/elements` (or its
 * `@types`-style equivalents) — i.e. it's an inherited HTML attribute like
 * `aria-label`, `onclick`, `class`, `id`. Used to skip those props when
 * falling back to a `<Name>Props` type that intersects with `HTMLAttributes`.
 *
 * `class` is NOT a member of HTMLAttributes per se (Svelte adds it via its own
 * declaration), so it survives this filter; that's intentional — `class` is a
 * meaningful prop on every component and should appear in the schema.
 */
function isInheritedFromSvelteElements(symbol: MorphSymbol): boolean {
  const declarations = symbol.getDeclarations();
  for (const decl of declarations) {
    const sourceFile = decl.getSourceFile();
    const path = sourceFile.getFilePath();
    // svelte/elements lives in `node_modules/svelte/elements.d.ts` (and
    // sometimes a few sibling .d.ts files under `node_modules/svelte/`).
    if (/\bnode_modules\/svelte\b/.test(path)) {
      // The `class` prop is declared in svelte/elements but is meaningful for
      // every component; let it through.
      if (symbol.getName() === 'class') return false;
      return true;
    }
  }
  return false;
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
