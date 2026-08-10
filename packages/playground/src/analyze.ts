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

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import type { Expression, Pattern, Property, SpreadElement } from 'estree';
import { type AST, parse } from 'svelte/compiler';
import {
  type Node,
  Project,
  type PropertySignature,
  type SourceFile,
  SymbolFlags,
  SyntaxKind,
  type Symbol as TsSymbol,
  type Type,
  type TypeNode,
} from 'ts-morph';

import { discoverComponentFilePaths } from './discover.ts';
import type {
  ComponentManifest,
  ControlKind,
  ObjectShape,
  PropManifest,
  ValueShape,
} from './types.ts';

export type { ComponentManifest, ControlKind, ObjectShape, PropManifest, ValueShape };

// ---------------------------------------------------------------------------
// Control kind inference from ts-morph TypeNode
// ---------------------------------------------------------------------------

/**
 * Infers a control kind from a ts-morph TypeNode.
 */
function inferControlKindFromTypeNode(
  typeNode: TypeNode | undefined,
  typeText: string,
  /**
   * How deep to expand array/object SHAPES. `0` means "describe the type, don't
   * walk it": the control still reports `kind: 'array'` and its `rawType` (which
   * is all the props table renders), but the element shape comes back opaque.
   *
   * Threaded rather than fixed because the shape has exactly one consumer —
   * seeding a REQUIRED prop with no default. Expanding it for every optional
   * array prop in the library tripled a cold manifest build (7.4s -> 26.7s),
   * paid on every dev-server start, for a value nothing reads.
   */
  shapeDepthBudget: number = MAX_SHAPE_DEPTH,
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

    // A MIXED union (`string | Snippet`, `Date | number | string`) is not a
    // select, but it is not unclassifiable either. If one arm is a primitive the
    // reader can actually type, offer a control for THAT arm — the component
    // accepts it, so the control and the generated snippet are both valid.
    //
    // Without this, `PageHeader`'s entirely ordinary `title: string | Snippet`
    // came out `unknown`, and because it is required with no default it counted
    // as unsynthesizable and suppressed the component's whole Playground
    // section. Nullish arms are skipped: they say the prop may be omitted, not
    // what it holds.
    for (const member of members) {
      if (isNullishTypeNode(member)) continue;
      const control = inferControlKindFromTypeNode(member, member.getText(), shapeDepthBudget);
      if (control.kind !== 'unknown' && control.kind !== 'snippet') return control;
    }
    return { kind: 'unknown', rawType: typeText };
  }

  // `readonly T[]` wraps the array in a TypeOperator; unwrap and re-enter.
  if (kind === SyntaxKind.TypeOperator) {
    const operator = typeNode.asKindOrThrow(SyntaxKind.TypeOperator);
    if (operator.getOperator() === SyntaxKind.ReadonlyKeyword) {
      const inner = operator.getTypeNode();
      return inferControlKindFromTypeNode(inner, inner.getText(), shapeDepthBudget);
    }
  }

  if (kind === SyntaxKind.ArrayType) {
    const element = typeNode.asKindOrThrow(SyntaxKind.ArrayType).getElementTypeNode();
    return {
      kind: 'array',
      element: shapeFromType(element.getType(), element, MAX_SHAPE_DEPTH - shapeDepthBudget),
      rawType: typeText,
    };
  }

  if (kind === SyntaxKind.TypeLiteral) {
    return {
      kind: 'object',
      shape: objectShapeFromType(typeNode.getType(), typeNode, MAX_SHAPE_DEPTH - shapeDepthBudget),
      rawType: typeText,
    };
  }

  if (kind === SyntaxKind.TypeReference) {
    const ref = typeNode.asKindOrThrow(SyntaxKind.TypeReference);
    const name = ref.getTypeName().getText();

    // Snippet or Snippet<[...]> â snippet control
    if (name === 'Snippet') return { kind: 'snippet' };

    // `ReadonlyArray<T>` / `Array<T>` are the generic spellings of `T[]`.
    if (name === 'Array' || name === 'ReadonlyArray') {
      const argument = ref.getTypeArguments()[0];
      if (argument !== undefined) {
        return {
          kind: 'array',
          element: shapeFromType(argument.getType(), argument, MAX_SHAPE_DEPTH - shapeDepthBudget),
          rawType: typeText,
        };
      }
    }

    // Try to resolve the referenced alias in the same source file
    const sf = typeNode.getSourceFile();
    const alias = sf.getTypeAlias(name);
    if (alias !== undefined) {
      const resolvedNode = alias.getTypeNode();
      return inferControlKindFromTypeNode(
        resolvedNode,
        resolvedNode?.getText() ?? typeText,
        shapeDepthBudget,
      );
    }

    const importedControl = inferControlKindFromImportedAlias(sf, name, typeText);
    if (importedControl !== undefined) return importedControl;

    const resolvedControl = inferControlKindFromResolvedType(ref.getType());
    if (resolvedControl !== undefined) return resolvedControl;

    return { kind: 'unknown', rawType: typeText };
  }

  return { kind: 'unknown', rawType: typeText };
}

/**
 * True for the `null` / `undefined` arms of a union. They carry optionality, not
 * a value shape, so {@link inferControlKindFromTypeNode} skips them when picking
 * a typeable arm out of a mixed union.
 */
function isNullishTypeNode(typeNode: TypeNode): boolean {
  const kind = typeNode.getKind();
  if (kind === SyntaxKind.UndefinedKeyword) return true;
  if (kind !== SyntaxKind.LiteralType) return false;
  return (
    typeNode.asKindOrThrow(SyntaxKind.LiteralType).getLiteral().getKind() === SyntaxKind.NullKeyword
  );
}

// ---------------------------------------------------------------------------
// Structural shapes — what a synthesized array/object placeholder is built from
// ---------------------------------------------------------------------------

/**
 * How deep a synthesized shape may nest before fields become opaque.
 *
 * Three, because the deepest real case in the library is
 * `groups[] -> shortcuts[] -> keys[]` — each array hop costs a level, so a cap
 * of two truncated `KeyboardShortcuts.groups` to `[{ shortcuts: [{}, {}] }]`.
 * The cap is what makes recursive types terminate at all:
 * `MegaMenuItem.submenu?: MegaMenuItem[]` would otherwise expand forever.
 */
const MAX_SHAPE_DEPTH = 3;

/** True for a resolved type the generator cannot invent a value for. */
function isOpaqueType(type: Type): boolean {
  return type.getCallSignatures().length > 0 || isSnippetType(type);
}

/**
 * Describe a resolved type structurally, for value synthesis.
 *
 * Union handling is ordered by what produces a usable placeholder: an
 * all-string-literal union becomes an `enum`; a mixed union prefers a safe
 * primitive arm before an object arm, so `string | number | Date` becomes a
 * distinct readable string instead of `{}`; an all-object union takes its first
 * object arm (`MegaMenuItem` and `RunStepTimelineEntry` are shaped that way).
 */
/**
 * Memoizes {@link shapeFromType} by resolved type text and depth.
 *
 * The same element types recur constantly — `string`, an enum alias, a shared
 * `Item` — both within one component and across the ~194 analyzed per build.
 * Recursing into array element types without this made a cold manifest build
 * roughly five times slower (5.9s -> 26s), which is paid on every dev-server
 * start. Cleared by `resetProject()` along with the other analyzer caches,
 * because a stale entry would outlive the source it was derived from.
 */
const shapeCache = new Map<string, ValueShape | ObjectShape>();

function shapeFromType(type: Type, at: Node, depth: number): ValueShape | ObjectShape {
  const bare = type.getNonNullableType();
  const cacheKey = `${depth}:${bare.getText()}`;
  const cached = shapeCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const shape = computeShapeFromType(bare, at, depth);
  shapeCache.set(cacheKey, shape);
  return shape;
}

function computeShapeFromType(bare: Type, at: Node, depth: number): ValueShape | ObjectShape {
  if (isOpaqueType(bare)) return { kind: 'opaque', rawType: bare.getText() };
  if (bare.isString()) return { kind: 'string' };
  if (bare.isNumber()) return { kind: 'number' };
  if (bare.isBoolean() || bare.isBooleanLiteral()) return { kind: 'boolean' };

  const literalUnion = inferControlKindFromResolvedType(bare);
  if (literalUnion !== undefined && literalUnion.kind === 'select') {
    return { kind: 'enum', options: literalUnion.options };
  }

  if (bare.isUnion()) {
    const arms = bare.getUnionTypes().filter((arm) => !arm.isNull() && !arm.isUndefined());
    if (arms.some((arm) => arm.isString() || arm.isStringLiteral())) return { kind: 'string' };
    if (arms.some((arm) => arm.isNumber() || arm.isNumberLiteral())) return { kind: 'number' };
    const objectArm = arms.find((arm) => arm.isObject() && !isOpaqueType(arm));
    if (objectArm !== undefined) return objectShapeFromType(objectArm, at, depth);
    return { kind: 'opaque', rawType: bare.getText() };
  }

  // A type PARAMETER (`Row extends DataTableRow = Record<string, unknown>`)
  // carries its shape on its default or constraint.
  if (bare.isTypeParameter()) {
    const resolved = bare.getDefault() ?? bare.getConstraint();
    if (resolved !== undefined && depth < MAX_SHAPE_DEPTH) {
      return shapeFromType(resolved, at, depth + 1);
    }
    return { kind: 'opaque', rawType: bare.getText() };
  }

  // Arrays BEFORE the object branch: an array is an object to the checker, so
  // reaching `objectShapeFromType` with `string[]` synthesizes the array's own
  // internals (`length`, `__@unscopables@…`) as if they were data fields.
  if (bare.isArray() || bare.isReadonlyArray()) {
    const element = bare.getArrayElementType();
    if (element === undefined || depth >= MAX_SHAPE_DEPTH) {
      return { kind: 'opaque', rawType: bare.getText() };
    }
    return { kind: 'array', element: shapeFromType(element, at, depth + 1) };
  }

  if (bare.isObject()) return objectShapeFromType(bare, at, depth);

  return { kind: 'opaque', rawType: bare.getText() };
}

/**
 * The required, named, synthesizable fields of an object type.
 *
 * An object with no named properties is `degenerate` — an index-signature-only
 * record such as `MatrixChartDatum = Record<string, string | number | null>`.
 * That seeds to `{}` / `[]`, never an invented member: those components' sibling
 * props name KEYS of the datum, so any datum invented here would contradict them.
 */
function objectShapeFromType(type: Type, at: Node, depth: number): ObjectShape {
  if (depth >= MAX_SHAPE_DEPTH) return { fields: [], degenerate: true };

  const fields: ObjectShape['fields'] = [];
  for (const symbol of type.getProperties()) {
    // Optional fields are dropped: the target is the MINIMAL literal.
    if (symbol.hasFlags(SymbolFlags.Optional)) continue;
    const shape = shapeFromType(symbol.getTypeAtLocation(at), at, depth + 1);
    // Never fake an opaque field — omit it and let the reader supply it.
    if ('kind' in shape && shape.kind === 'opaque') continue;
    fields.push({ name: symbol.getName(), shape });
  }

  return { fields, degenerate: fields.length === 0 };
}

const importedLiteralUnionCache = new Map<string, ControlKind | null>();

function inferControlKindFromResolvedType(type: Type): ControlKind | undefined {
  if (type.isBoolean()) return { kind: 'boolean' };
  if (type.isNumber()) return { kind: 'number' };
  if (type.isString()) return { kind: 'text' };

  const stringLiterals: string[] = [];
  const unionTypes = type.isUnion() ? type.getUnionTypes() : [type];

  for (const unionType of unionTypes) {
    if (!unionType.isStringLiteral()) return undefined;
    const literalValue = unionType.getLiteralValue();
    if (typeof literalValue !== 'string') return undefined;
    stringLiterals.push(literalValue);
  }

  if (stringLiterals.length === 0) return undefined;
  return { kind: 'select', options: stringLiterals };
}

function inferControlKindFromImportedAlias(
  sourceFile: SourceFile,
  name: string,
  typeText: string,
): ControlKind | undefined {
  for (const declaration of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    if (!moduleSpecifier.startsWith('.')) continue;

    for (const namedImport of declaration.getNamedImports()) {
      const importedName = namedImport.getNameNode().getText();
      const localName = namedImport.getAliasNode()?.getText() ?? importedName;
      if (localName !== name) continue;

      return inferControlKindFromRelativeTypeAlias(
        sourceFile.getFilePath(),
        moduleSpecifier,
        importedName,
        typeText,
      );
    }
  }

  return undefined;
}

function inferControlKindFromRelativeTypeAlias(
  importerPath: string,
  moduleSpecifier: string,
  typeName: string,
  typeText: string,
): ControlKind {
  const importedPath = resolveRelativeTypeModule(importerPath, moduleSpecifier);
  if (importedPath === undefined) return { kind: 'unknown', rawType: typeText };

  const cacheKey = `${importedPath}:${typeName}`;
  const cached = importedLiteralUnionCache.get(cacheKey);
  if (cached !== undefined) return cached ?? { kind: 'unknown', rawType: typeText };

  const control = controlKindFromTypeAliasSource(readFileSync(importedPath, 'utf8'), typeName);
  importedLiteralUnionCache.set(cacheKey, control);

  return control ?? { kind: 'unknown', rawType: typeText };
}

function resolveRelativeTypeModule(
  importerPath: string,
  moduleSpecifier: string,
): string | undefined {
  const basePath = resolve(dirname(importerPath), moduleSpecifier);
  const candidates = moduleSpecifier.endsWith('.ts')
    ? [basePath]
    : [`${basePath}.ts`, join(basePath, 'index.ts')];

  return candidates.find((candidate) => existsSync(candidate));
}

function controlKindFromTypeAliasSource(source: string, typeName: string): ControlKind | null {
  const escapedTypeName = typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:export\\s+)?type\\s+${escapedTypeName}\\s*=\\s*([\\s\\S]*?);`).exec(
    source,
  );
  if (match === null) return null;

  const options: string[] = [];
  for (const member of (match[1] ?? '').split('|')) {
    const text = member.trim();
    if (text.length === 0) continue;

    const literal = /^(['"])(.*)\1$/.exec(text);
    if (literal === null) return null;
    options.push(literal[2] ?? '');
  }

  return options.length > 0 ? { kind: 'select', options } : null;
}

// ---------------------------------------------------------------------------
// Svelte AST helpers â extracting props from $props() destructuring
// ---------------------------------------------------------------------------

type RawPropEntry = {
  name: string;
  /**
   * The identifier the prop is destructured INTO, which is not always the prop
   * name: `role: _role` binds `role` to a local called `_role`. The underscore
   * is the codebase's marker for a prop the component deliberately accepts and
   * swallows (so a spread consumer can pass it without it reaching the DOM) —
   * internal plumbing, not public API. Recorded here so
   * {@link isSwallowedProp} can keep those out of the manifest; the old code
   * discarded the binding name and shipped them as public required props.
   */
  localName: string | undefined;
  defaultValue?: unknown;
  bindable: boolean;
};

/**
 * Resolve the local binding identifier of a destructured property, unwrapping a
 * default (`role: _role = 'toolbar'` binds `_role`). Returns `undefined` for
 * nested destructuring patterns, which Svelte components don't use for props.
 */
function localBindingName(value: Pattern): string | undefined {
  const target = value.type === 'AssignmentPattern' ? value.left : value;
  return target.type === 'Identifier' ? target.name : undefined;
}

/**
 * True when a prop is destructured into an underscore-prefixed local, e.g.
 * `role: _role`. See {@link RawPropEntry.localName}.
 */
function isSwallowedProp(entry: RawPropEntry): boolean {
  return entry.localName !== undefined && entry.localName.startsWith('_');
}

/**
 * Returns the literal value of an array element, or `undefined` for holes,
 * spreads, and any non-literal expression.
 */
function literalElementValue(element: Expression | SpreadElement | null): unknown {
  if (element !== null && element.type === 'Literal') return element.value;
  return undefined;
}

/**
 * Resolves the static name of an object-expression property key, restricted
 * to the shapes `parseDefaultExpression`'s `ObjectExpression` branch accepts:
 * a non-computed `Identifier` key or a string `Literal` key.
 */
function staticObjectExpressionKeyName(property: Property): string | undefined {
  if (property.computed) return undefined;
  const key = property.key;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return undefined;
}

/**
 * Parses the right-hand side of an AssignmentPattern (the default value expression)
 * and returns { defaultValue, bindable }. `source` is the original component source
 * text, used only by the `ObjectExpression` branch's source-text fallback.
 */
function parseDefaultExpression(
  rhs: Expression,
  source: string,
): { defaultValue?: unknown; bindable: boolean } {
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

  // A negative numeric literal (e.g. `count = -1`) parses as a UnaryExpression
  // wrapping a Literal, not a Literal itself.
  if (rhs.type === 'UnaryExpression' && rhs.operator === '-') {
    const argument = rhs.argument;
    if (argument.type === 'Literal' && typeof argument.value === 'number') {
      return { defaultValue: -argument.value, bindable: false };
    }
    return { defaultValue: undefined, bindable: false };
  }

  // A static template literal (no interpolated expressions) used purely for
  // its escaping, e.g. `` label = `Untitled` ``. Templates with interpolated
  // expressions are not statically resolvable and fall through below.
  if (rhs.type === 'TemplateLiteral' && rhs.expressions.length === 0) {
    return { defaultValue: rhs.quasis[0]?.value.cooked ?? undefined, bindable: false };
  }

  if (rhs.type === 'ObjectExpression') {
    const entries: [string, string | number | boolean][] = [];
    let allLiterals = true;
    for (const property of rhs.properties) {
      if (property.type !== 'Property') {
        allLiterals = false;
        break;
      }
      const keyName = staticObjectExpressionKeyName(property);
      const value = property.value;
      const isLiteralValue =
        value.type === 'Literal' &&
        (typeof value.value === 'string' ||
          typeof value.value === 'number' ||
          typeof value.value === 'boolean');
      if (keyName === undefined || !isLiteralValue) {
        allLiterals = false;
        break;
      }
      entries.push([keyName, value.value as string | number | boolean]);
    }
    if (allLiterals) {
      return { defaultValue: Object.fromEntries(entries), bindable: false };
    }
    // Not every property is a plain literal (a nested object, an array, an
    // identifier reference, a computed key, a function) — fall back to the
    // raw source text of the whole ObjectExpression initializer. Svelte's
    // compiler AST nodes carry numeric start/end character offsets at
    // runtime that the `Expression` type imported from `estree` doesn't
    // declare, so read them via a narrow local cast rather than widening
    // the whole function's types.
    const { start, end } = rhs as Expression & { start: number; end: number };
    return { defaultValue: source.slice(start, end), bindable: false };
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
        const localName = localBindingName(value);

        if (value.type === 'AssignmentPattern') {
          const { defaultValue, bindable } = parseDefaultExpression(value.right, source);
          entries.push({ name: rawName, localName, defaultValue, bindable });
        } else {
          // No default value
          entries.push({ name: rawName, localName, defaultValue: undefined, bindable: false });
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
// Semantic fallback — filling the gaps the syntactic walk cannot reach
// ---------------------------------------------------------------------------
//
// `collectPropertiesFromTypeNode` walks type NODES: TypeLiteral, Intersection,
// a same-file TypeAlias, Parenthesized. That is fast and preserves source-order
// detail (a string-literal union keeps its authored option order), but it is
// blind to anything the TypeScript CHECKER would have to resolve:
//
//   - properties inherited from an IMPORTED base (`ChartSharedProps & { … }`),
//   - properties behind a mapped type (`Omit<HTMLAttributes<HTMLElement>, …>`),
//   - properties inside a UNION nested in an intersection
//     (`SharedBase & (WithLabel | WithChildren | WithIconOnly)` — the node walker
//     has no UnionType branch at this level, so every arm's props vanish).
//
// A prop missing from the type map got `{ kind: 'unknown', rawType: '?' }` AND
// `optional: false` (see `analyzeComponent`), i.e. "we could not type it" was
// reported as "it is required". That single default is what blocked Button — the
// most-visited page in the library — along with ~20 others whose only "required"
// props were optional DOM handlers all along.
//
// So: after the syntactic pass, ask the checker about the props it missed. The
// syntactic result always wins where it exists; this only fills gaps.

/** One arm's view of a prop, as both the syntactic and semantic paths report it. */
type ArmMembership = { never: boolean; optional: boolean };

/**
 * Decide whether a union expresses "exactly one of these props", and if so which
 * alternative the playground should commit to.
 *
 * The idiom is `{ a: string; b?: never } | { a?: never; b: string }`. Merged
 * naively both `a` and `b` come out optional — each is absent-or-`never` in one
 * arm — so the playground seeded both to `''` and supplied either both or
 * neither. DropdownGroup, which enforces "exactly one accessible naming
 * strategy", threw on its own generated preview.
 *
 * Two guards keep this narrow:
 *
 *  - Only a `?: never` member marks an exclusive alternative. `href?: undefined`
 *    on Button's non-link arm is not one — `href` is genuinely omittable, and
 *    treating it as exclusive reported a plain `<Button label="…" />` as missing
 *    a required prop.
 *  - If ANY arm requires none of the exclusive props, that arm is a legal
 *    "neither" and nothing is committed. Card's basic variant is exactly this:
 *    it needs no `header` and no `title`, so committing to the header arm would
 *    have turned a component that previews fine into one blocked on a required
 *    Snippet.
 *
 * @returns The chosen arm index (`-1` for "do not commit") and, per prop, the
 *   first arm that requires it.
 */
function chooseExclusiveArm(arms: ReadonlyArray<ReadonlyMap<string, ArmMembership>>): {
  requiredInArm: ReadonlyMap<string, number>;
  chosenArm: number;
} {
  const exclusive = new Set<string>();
  for (const arm of arms) {
    for (const [name, membership] of arm) {
      if (membership.never) exclusive.add(name);
    }
  }

  const requiredInArm = new Map<string, number>();
  const armRequiresOne = arms.map((arm, armIndex) => {
    let requiresOne = false;
    for (const name of exclusive) {
      const membership = arm.get(name);
      if (membership === undefined || membership.never || membership.optional) continue;
      requiresOne = true;
      if (!requiredInArm.has(name)) requiredInArm.set(name, armIndex);
    }
    return requiresOne;
  });

  if (arms.length === 0 || !armRequiresOne.every(Boolean) || requiredInArm.size === 0) {
    return { requiredInArm: new Map(), chosenArm: -1 };
  }
  return { requiredInArm, chosenArm: Math.min(...requiredInArm.values()) };
}

/**
 * True for the `prop?: never` member an exclusive-union arm uses to say "not
 * this alternative". Semantically the prop is ABSENT from that arm.
 */
function isNeverProperty(prop: PropertySignature): boolean {
  return prop.getTypeNode()?.getKind() === SyntaxKind.NeverKeyword;
}

/**
 * True when a resolved type is Svelte's `Snippet` (or `Snippet<[…]>`). Checked
 * via the ALIAS symbol because `Snippet` resolves to a call signature — without
 * this it would classify as an opaque function type.
 */
function isSnippetType(type: Type): boolean {
  return type.getAliasSymbol()?.getName() === 'Snippet';
}

/**
 * Classify a checker-resolved property type. `null`/`undefined` arms are
 * stripped first: an optional `string` prop resolves to `string | undefined`,
 * which would otherwise fall through every branch and land back on `unknown`.
 */
function controlKindFromResolvedPropertyType(type: Type): ControlKind {
  const bare = type.getNonNullableType();
  if (isSnippetType(bare)) return { kind: 'snippet' };
  return inferControlKindFromResolvedType(bare) ?? { kind: 'unknown', rawType: bare.getText() };
}

/**
 * True for the `prop?: never` member an exclusive-union arm uses to say "not
 * this alternative".
 */
function isNeverSymbol(symbol: TsSymbol): boolean {
  const declaration = propertySignatureOf(symbol);
  return declaration?.getTypeNode()?.getKind() === SyntaxKind.NeverKeyword;
}

/** The `PropertySignature` a resolved symbol was declared by, if it has one. */
function propertySignatureOf(symbol: TsSymbol): PropertySignature | undefined {
  for (const declaration of symbol.getDeclarations()) {
    if (declaration.getKind() === SyntaxKind.PropertySignature) {
      return declaration.asKindOrThrow(SyntaxKind.PropertySignature);
    }
  }
  return undefined;
}

/** The JSDoc description attached to a resolved property's declaration. */
function descriptionFromSymbol(symbol: TsSymbol): string | undefined {
  const text =
    propertySignatureOf(symbol)
      ?.getJsDocs()
      .map((doc) => doc.getDescription().trim())
      .join('') ?? '';
  return text === '' ? undefined : text;
}

/**
 * Classify a resolved property, preferring its DECLARATION's type node over
 * asking the checker for the property's type.
 *
 * Both give the same answer, but `getTypeAtLocation` instantiates the type,
 * which for props inherited from `HTMLAttributes<…>` is the expensive path and
 * is paid once per prop per union arm. The node walk is also higher fidelity: a
 * string-literal union keeps its authored option order, which the checker does
 * not promise.
 */
function controlKindFromResolvedSymbol(symbol: TsSymbol, at: Node): ControlKind {
  const typeNode = propertySignatureOf(symbol)?.getTypeNode();
  if (typeNode !== undefined) {
    return inferControlKindFromTypeNode(
      typeNode,
      typeNode.getText(),
      symbol.hasFlags(SymbolFlags.Optional) ? 0 : MAX_SHAPE_DEPTH,
    );
  }
  // No declaration node (a mapped or synthesized property) — the checker is the
  // only way to see it. Deliberately NOT used as a fallback when the node walk
  // returns `unknown`: instantiating these types is the expensive path, and
  // paying it to re-derive the same `unknown` roughly doubled the cost of a cold
  // manifest build. What this pass exists to recover is OPTIONALITY, which is
  // read off the symbol either way.
  return controlKindFromResolvedPropertyType(symbol.getTypeAtLocation(at));
}

/**
 * Resolve one prop against the checker, merging across the arms of a top-level
 * union.
 *
 * Optionality merges the SAME way the syntactic union path does: a prop that is
 * absent from any arm, or optional in any arm, is optional overall. That is the
 * conservative direction — a prop the caller may legally omit must never be
 * reported as required, because "required" is what suppresses the generated
 * preview.
 *
 * Returns `undefined` when no arm declares the prop, leaving it to the existing
 * `{ kind: 'unknown', rawType: '?' }` default.
 */
function resolvePropTypeInfo(
  armProperties: ReadonlyArray<ReadonlyMap<string, TsSymbol>>,
  at: Node,
  name: string,
  chosenArm: number,
  requiredInArm: ReadonlyMap<string, number>,
): TypeInfo | undefined {
  let found = false;
  let optional = false;
  let description: string | undefined;
  const controls: ControlKind[] = [];

  for (const properties of armProperties) {
    const symbol = properties.get(name);
    // A `never`-typed member is how an exclusive arm says "not this
    // alternative" — semantically absent, exactly like a missing symbol. Without
    // this, arm B's `label?: never` contributed an `unknown` control that
    // disagreed with arm A's `string`, and the merged result was `unknown`.
    if (symbol === undefined || isNeverSymbol(symbol)) {
      // Absent from this arm — a caller picking this arm omits it.
      optional = true;
      continue;
    }
    found = true;
    if (symbol.hasFlags(SymbolFlags.Optional)) optional = true;
    description ??= descriptionFromSymbol(symbol);
    controls.push(controlKindFromResolvedSymbol(symbol, at));
  }

  if (!found) return undefined;

  // Arms that disagree on the control kind can't drive one control. Keep the
  // resolved optionality though — that is the half that unblocks the preview.
  const first = controls[0] ?? { kind: 'unknown', rawType: '?' };
  const allAgree = controls.every((control) => control.kind === first.kind);

  return {
    control: allAgree ? first : { kind: 'unknown', rawType: 'discriminated-union' },
    // Exclusive alternatives (`{ a: string } | { b: string }`) are each optional
    // across the union as a whole, so seeding every one of them to `''` supplies
    // either all or none — and a component enforcing "exactly one" rejects both.
    // Commit to the first arm's required props; the rest stay optional, seed to
    // `''`, and are dropped from the snippet and the mount alike.
    optional: requiredInArm.get(name) === chosenArm ? false : optional,
    description,
  };
}

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
/** Per-generation analyzeAll cache, cleared by resetProject() on watcher invalidation. */
const analyzeAllCache = new Map<string, Promise<ComponentManifest[]>>();

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
  analyzeAllCache.clear();
  importedLiteralUnionCache.clear();
  shapeCache.clear();
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
  sourceDirectory: string,
  propNames: readonly string[],
): Map<string, TypeInfo> {
  const project = getSharedProject();

  // A unique path per call keeps concurrent `analyzeComponent` runs (and repeat
  // analyses of the same component) from clobbering each other's source file on
  // the shared project.
  syntheticFileCounter += 1;
  const syntheticPath = join(
    sourceDirectory,
    `__synthetic-${componentName}.${syntheticFileCounter}.ts`,
  );
  const sf = project.createSourceFile(syntheticPath, moduleScriptContent);

  try {
    return extractTypeInfo(sf, componentName, propNames);
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
  propNames: readonly string[],
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

      // Commit to one alternative of an `exactly one of` union — see
      // `chooseExclusiveArm` for the idiom and the two guards that keep it from
      // firing on ordinary unions.
      const { requiredInArm, chosenArm } = chooseExclusiveArm(
        perArmMaps.map(
          (armMap) =>
            new Map(
              [...armMap].map(([name, prop]) => [
                name,
                { never: isNeverProperty(prop), optional: prop.hasQuestionToken() },
              ]),
            ),
        ),
      );

      for (const name of allNames) {
        // Gather all type texts from arms that have this prop
        const typeTexts: string[] = [];
        let firstProp: PropertySignature | undefined;
        let description: string | undefined;
        let optional = false;

        for (const armMap of perArmMaps) {
          const prop = armMap.get(name);
          // `b?: never` is how an arm says "not this alternative" — semantically
          // the prop is ABSENT from that arm, not present with type `never`.
          if (prop !== undefined && !isNeverProperty(prop)) {
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

        // …except the chosen arm's own required prop: the playground commits to
        // that alternative so exactly one of the group is supplied.
        if (requiredInArm.get(name) === chosenArm) optional = false;

        // If all arms agree on type text, use that; otherwise unknown
        const uniqueTexts = [...new Set(typeTexts)];
        let control: ControlKind;
        if (uniqueTexts.length === 1 && firstProp !== undefined) {
          control = inferControlKindFromTypeNode(
            firstProp.getTypeNode(),
            uniqueTexts[0] ?? '?',
            optional ? 0 : MAX_SHAPE_DEPTH,
          );
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
      const optional = prop.hasQuestionToken();
      const control = inferControlKindFromTypeNode(
        typeNodeForProp,
        typeText,
        optional ? 0 : MAX_SHAPE_DEPTH,
      );
      const description =
        prop
          .getJsDocs()
          .map((d) => d.getDescription().trim())
          .join('') || undefined;

      result.set(name, { control, optional, description });
    }
  }

  processTypeNode(typeNode);

  // Gap-fill from the checker. Only props the syntactic walk MISSED are looked
  // up — where it produced an answer, that answer stands.
  //
  // The checker work is gated on there BEING a gap, and each arm's property list
  // is materialized once rather than per prop name. Both matter: resolving these
  // types pulls in the whole of `svelte/elements`, and doing it per name per arm
  // made a cold manifest build several times slower.
  const missing = propNames.filter((name) => !result.has(name));
  if (missing.length > 0) {
    const aliasType = propsAlias.getType();
    const arms = aliasType.isUnion() ? aliasType.getUnionTypes() : [aliasType];
    const armProperties = arms.map(
      (arm) => new Map(arm.getProperties().map((symbol) => [symbol.getName(), symbol])),
    );
    // Which arm first REQUIRES each missing prop — see the exclusive-union note
    // in `resolvePropTypeInfo`. Computed once over the whole missing set so the
    // choice is consistent across the alternatives of one group.
    const { requiredInArm, chosenArm } = chooseExclusiveArm(
      armProperties.map(
        (properties) =>
          new Map(
            missing.flatMap((name) => {
              const symbol = properties.get(name);
              if (symbol === undefined) return [];
              return [
                [
                  name,
                  { never: isNeverSymbol(symbol), optional: symbol.hasFlags(SymbolFlags.Optional) },
                ] as const,
              ];
            }),
          ),
      ),
    );

    for (const name of missing) {
      const resolved = resolvePropTypeInfo(
        armProperties,
        propsAlias,
        name,
        chosenArm,
        requiredInArm,
      );
      if (resolved !== undefined) result.set(name, resolved);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Derive component name from file path
// ---------------------------------------------------------------------------

function toPascalCase(kebab: string): string {
  return kebab.replace(/(^|-)([a-z])/g, (_, _sep, char: string) => char.toUpperCase());
}

/**
 * The canonical compound-namespace assembly: `Object.assign(<Root>, { … })`,
 * where `<Root>` is the bare root-component identifier. This is the convention
 * every compound component's `index.ts` uses to graft its public sub-components
 * onto the root (e.g. `Object.assign(AccordionRoot, { Item: AccordionItem })`),
 * and it is load-bearing for {@link detectCompound} — a compound component that
 * assembled its namespace another way (direct `Root.Item = …`, a spread) would
 * not be detected. The leading-identifier requirement (`,` after it) excludes
 * `Object.assign({}, …)` config-merge uses, which take an object literal first.
 */
const COMPOUND_NAMESPACE_PATTERN = /Object\.assign\(\s*[A-Za-z_$][\w$]*\s*,/;

/** Strip `//` line comments and block comments so the pattern test sees code only. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Detect whether a component is a compound namespace by inspecting its sibling
 * `index.ts`. Compound roots assemble their public sub-components onto the root
 * constructor with `Object.assign(Root, { Item: … })` — that call is the
 * authoritative signal that consumers compose the component as `Accordion.Item`
 * rather than passing plain-text children. Comments are stripped first so an
 * `Object.assign` reference in prose never trips the check, and the pattern
 * requires a leading identifier so an `Object.assign({}, …)` config merge is not
 * mistaken for namespace assembly. Flat-layout components have no sibling
 * `index.ts`, so the read simply returns `false`.
 *
 * @param svelteFilePath - Absolute path to the component's `.svelte` file.
 */
async function detectCompound(svelteFilePath: string): Promise<boolean> {
  const indexFile = Bun.file(join(dirname(svelteFilePath), 'index.ts'));
  if (!(await indexFile.exists())) return false;
  return COMPOUND_NAMESPACE_PATTERN.test(stripComments(await indexFile.text()));
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

const SKIP_PROPS = new Set(['class', 'rest']);

function isPublicPropName(name: string): boolean {
  if (SKIP_PROPS.has(name)) return false;
  if (name.startsWith('aria-')) return false;
  return !name.includes(':');
}

/** Analyzes a single Svelte component file and returns its ComponentManifest. */
export type AnalyzeComponentOptions = {
  importPath?: string;
};

export async function analyzeComponent(
  filePath: string,
  options: AnalyzeComponentOptions = {},
): Promise<ComponentManifest> {
  const source = await Bun.file(filePath).text();
  const fileBaseName = basename(filePath, '.svelte');
  const componentName = toPascalCase(fileBaseName);

  const rawProps = extractPropsFromSvelteAst(source);
  const publicRawProps = rawProps.filter(
    (prop) => isPublicPropName(prop.name) && !isSwallowedProp(prop),
  );
  let moduleScriptContent = extractModuleScriptContent(source);

  const typeInfoMap =
    publicRawProps.length > 0
      ? await buildComponentTypeInfoMap(
          filePath,
          moduleScriptContent,
          componentName,
          publicRawProps.map((prop) => prop.name),
        )
      : new Map<string, TypeInfo>();

  const props: PropManifest[] = [];

  for (const rawProp of publicRawProps) {
    const { name, defaultValue, bindable } = rawProp;

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

  const isCompound = await detectCompound(filePath);

  return {
    name: componentName,
    kebabName: fileBaseName,
    file: filePath,
    importPath: options.importPath ?? `@lostgradient/cinder/${fileBaseName}`,
    props,
    ...(isCompound ? { isCompound: true } : {}),
  };
}

async function buildComponentTypeInfoMap(
  filePath: string,
  moduleScriptContent: string,
  componentName: string,
  propNames: readonly string[],
): Promise<Map<string, TypeInfo>> {
  // After the per-directory migration, the .svelte module script may only
  // re-export types from <name>.types.ts. Concatenate the types-file content
  // so the existing module-script type walker finds the Props alias.
  const typesFilePath = filePath.replace(/\.svelte$/, '.types.ts');
  const typesFile = Bun.file(typesFilePath);
  if (await typesFile.exists()) {
    const typesSource = await typesFile.text();
    moduleScriptContent = `${moduleScriptContent}\n${typesSource}`;
  }

  return buildTypeInfoMap(moduleScriptContent, componentName, dirname(filePath), propNames);
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
  const cached = analyzeAllCache.get(componentsDir);
  if (cached) return cached;

  const promise = computeAnalyzeAll(componentsDir);
  analyzeAllCache.set(componentsDir, promise);
  try {
    return await promise;
  } catch (error) {
    if (analyzeAllCache.get(componentsDir) === promise) {
      analyzeAllCache.delete(componentsDir);
    }
    throw error;
  }
}

async function computeAnalyzeAll(componentsDir: string): Promise<ComponentManifest[]> {
  const filePaths = await discoverComponentFilePaths(componentsDir);

  const manifests = await Promise.all(filePaths.map((filePath) => analyzeComponent(filePath)));

  return manifests.toSorted((a, b) => a.kebabName.localeCompare(b.kebabName));
}
