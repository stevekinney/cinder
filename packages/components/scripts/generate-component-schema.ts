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
  Node,
  Project,
  type InterfaceDeclaration,
  type Symbol as MorphSymbol,
  type SourceFile,
  type Type,
  type TypeAliasDeclaration,
} from 'ts-morph';

const SCHEMA_URI = 'https://json-schema.org/draft/2020-12/schema' as const;
const MAX_SCHEMA_TYPE_DEPTH = 6;
const MAX_SCHEMA_STRUCTURAL_OBJECT_DEPTH = 5;
// JSON Schema's conditional `then` keyword, used as a computed object key in
// the generated `if`/`then` blocks below. `as const` keeps it typed as the
// literal without an assertion.
// eslint-disable-next-line unicorn/no-thenable -- `then` is JSON Schema's conditional keyword, not a Promise `.then`; this constant only ever becomes a computed key on schema data, never an awaited value.
const JSON_SCHEMA_THEN_KEYWORD = 'then' as const;

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
  /**
   * `true` when the prop is required on the component; omitted when it is
   * optional. Recorded so the generated README can show a faithful Required
   * column for props the JSON schema cannot express (e.g. a required
   * `onselect: () => void` callback). The renderer treats an absent value as
   * not-required.
   */
  required?: boolean;
  /** The prop's JSDoc description, when one is authored. */
  description?: string;
}

export interface PropertySchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'array' | 'object';
  enum?: ReadonlyArray<string | number | boolean | null>;
  const?: string | number | boolean | null;
  items?: PropertySchema;
  properties?: Record<string, PropertySchema>;
  required?: string[];
  additionalProperties?: boolean | PropertySchema;
  anyOf?: PropertySchema[];
  not?: PropertySchema;
  minimum?: number;
  minItems?: number;
  description?: string;
  default?: unknown;
}

export interface ComponentSchemaOutput {
  $schema: typeof SCHEMA_URI;
  type: 'object';
  properties: Record<string, PropertySchema>;
  required?: string[];
  allOf?: Array<Record<string, unknown>>;
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
    if (!propType) {
      unsupportedProps.push(makeUnsupportedProp(symbol, propName, 'unknown-shape'));
      continue;
    }

    const converted = hasJsDocTag(symbol, 'schemaPermissive')
      ? { kind: 'ok' as const, schema: {} }
      : convertType(
          propType,
          0,
          hasJsDocTag(symbol, 'schemaObject') || hasSchemaObjectTagDeep(propType),
        );
    if (converted.kind === 'unsupported') {
      unsupportedProps.push(makeUnsupportedProp(symbol, propName, converted.reason));
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

  // When a `<Name>SchemaProps` allowlist is used, props that exist on the full
  // `<Name>Props` but are deliberately omitted from the allowlist never reach the
  // loop above. That is correct for HTML-attribute and expressible props — the
  // allowlist is the curated JSON-expressible surface. But a component-authored
  // FUNCTION or SNIPPET prop (e.g. a required `onselect: () => void`) is part of
  // the public API and JSON Schema simply cannot represent it. Omitting it
  // silently means tooling and the generated README have no way to discover the
  // prop exists at all. Record exactly those props in `unsupportedProps` so they
  // are documented as known-but-unexpressible, without polluting the schema with
  // the hundreds of inherited HTML attributes.
  if (usedFocusedAllowList) {
    const fullPropsType = findExportedType(sourceFile, propsTypeName);
    if (fullPropsType) {
      const recordedNames = new Set([
        ...Object.keys(properties),
        ...unsupportedProps.map((entry) => entry.name),
      ]);
      for (const symbol of fullPropsType.getProperties()) {
        const propName = symbol.getName();
        if (recordedNames.has(propName)) continue;
        // Only component-authored props — never the inherited svelte/elements
        // event handlers (onclick, etc.) or aria-*/global attributes.
        if (isInheritedFromSvelteElements(symbol)) continue;
        const propType = getPropType(symbol);
        if (!propType) continue;
        const converted = convertType(
          propType,
          0,
          hasJsDocTag(symbol, 'schemaObject') || hasSchemaObjectTagDeep(propType),
        );
        // Record ONLY function/snippet props. An expressible prop the author
        // deliberately curated out of the allowlist stays out; a non-callback
        // unsupported shape is the author's omission to make, not ours to surface.
        if (converted.kind === 'unsupported' && converted.reason === 'function-or-snippet') {
          unsupportedProps.push(makeUnsupportedProp(symbol, propName, 'function-or-snippet'));
        }
      }
    }
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
  applyComponentSchemaRules(componentName, schema);

  const schemaJson = JSON.stringify(schema, null, 2) + '\n';
  const schemaModule = renderSchemaModule(schema, depthToSrc);

  return { schema, schemaJson, schemaModule };
}

/**
 * Build an `unsupportedProps` entry, capturing the prop's required-ness and
 * authored description so the generated README can report a prop the JSON schema
 * cannot express (e.g. a required `() => void` callback) without falsely showing
 * it as optional and undescribed.
 */
function makeUnsupportedProp(
  symbol: MorphSymbol,
  name: string,
  reason: UnsupportedReason,
): UnsupportedProp {
  const entry: UnsupportedProp = { name, reason };
  if (!symbol.isOptional()) entry.required = true;
  const description = readJsDocDescription(symbol);
  if (description) entry.description = description;
  return entry;
}

function applyComponentSchemaRules(componentName: string, schema: ComponentSchemaOutput): void {
  if (componentName === 'grid' || componentName === 'bento-grid') {
    const columns = schema.properties['columns'];
    if (columns?.anyOf) {
      columns.anyOf = columns.anyOf.map((entry) =>
        entry.type === 'number' ? { ...entry, type: 'integer', minimum: 1 } : entry,
      );
    }
    return;
  }

  if (componentName === 'bento-cell') {
    for (const spanProp of ['colSpan', 'rowSpan']) {
      const prop = schema.properties[spanProp];
      if (prop?.anyOf) {
        prop.anyOf = prop.anyOf.map((entry) =>
          entry.type === 'number' ? { ...entry, type: 'integer', minimum: 1 } : entry,
        );
      }
    }

    for (const lineProp of ['columnStart', 'columnEnd', 'rowStart', 'rowEnd']) {
      const prop = schema.properties[lineProp];
      if (prop?.anyOf) {
        prop.anyOf = prop.anyOf.map((entry) =>
          entry.type === 'number' ? { ...entry, type: 'integer', not: { const: 0 } } : entry,
        );
      }
    }
    return;
  }

  if (componentName === 'event-stream-viewer') {
    applyEventStreamViewerSchemaRules(schema);
    return;
  }

  if (componentName === 'approval-card') {
    applyApprovalCardSchemaRules(schema);
    return;
  }

  if (componentName === 'run-step-timeline') {
    applyRunStepTimelineSchemaRules(schema);
    return;
  }

  if (componentName !== 'modal') return;

  schema.allOf = [
    {
      if: {
        properties: {
          role: { const: 'alertdialog' },
        },
        required: ['role'],
      },
      // eslint-disable-next-line unicorn/no-thenable -- `then` is JSON Schema's conditional keyword here, not a Promise `.then`; this object is schema data, never awaited.
      [JSON_SCHEMA_THEN_KEYWORD]: {
        required: ['describedById'],
      },
    },
  ];
}

function applyEventStreamViewerSchemaRules(schema: ComponentSchemaOutput): void {
  const entries = schema.properties['events'];
  const variants = entries?.items?.anyOf;
  const reconnectBoundary = variants?.find(
    (variant) => variant.properties?.['kind']?.const === 'reconnected',
  );
  const streamEvent = variants?.find(
    (variant) => variant.required?.includes('summary') && variant.properties?.['sequence'],
  );
  const sequence = streamEvent?.properties?.['sequence'];
  const replayedCount = reconnectBoundary?.properties?.['replayedCount'];

  if (streamEvent?.properties && sequence?.type === 'number') {
    streamEvent.properties['sequence'] = {
      ...sequence,
      type: 'integer',
    };
  }

  if (reconnectBoundary?.properties && replayedCount?.type === 'number') {
    reconnectBoundary.properties['replayedCount'] = {
      ...replayedCount,
      type: 'integer',
      minimum: 0,
    };
  }
}

function applyApprovalCardSchemaRules(schema: ComponentSchemaOutput): void {
  const operation = schema.properties['operation'];
  const variants = operation?.anyOf;
  const fileWriteOperation = variants?.find(
    (variant) => variant.properties?.['kind']?.const === 'file-write',
  );
  const filesTouched = fileWriteOperation?.properties?.['filesTouched'];

  if (fileWriteOperation && filesTouched?.type === 'array') {
    fileWriteOperation.properties ??= {};
    fileWriteOperation.properties['filesTouched'] = {
      ...filesTouched,
      minItems: 1,
    };
    fileWriteOperation.required = sortedUniqueStrings([
      ...(fileWriteOperation.required ?? []),
      'filesTouched',
    ]);
  }
}

function applyRunStepTimelineSchemaRules(schema: ComponentSchemaOutput): void {
  const cappedChildrenSchema: PropertySchema = {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: true,
    },
    description: 'Descendants beyond the rendered depth cap; summarized as a depth-limit row.',
  };
  const depthThreeStepSchema = makeRunStepTimelineStepSchema(cappedChildrenSchema);
  const depthTwoStepSchema = makeRunStepTimelineStepSchema({
    type: 'array',
    items: depthThreeStepSchema,
    description: 'Nested child-workflow steps rendered at depth 3.',
  });
  const depthOneStepSchema = makeRunStepTimelineStepSchema({
    type: 'array',
    items: depthTwoStepSchema,
    description: 'Nested child-workflow steps rendered at depth 2.',
  });
  const topLevelStepSchema = makeRunStepTimelineStepSchema({
    type: 'array',
    items: depthOneStepSchema,
    description: 'Schema-bounded nested child-workflow steps.',
  });

  schema.properties['steps'] = {
    type: 'array',
    items: topLevelStepSchema,
    description: 'Ordered list of steps to render.',
  };
  schema.required = sortedUniqueStrings([...(schema.required ?? []), 'steps']);

  const unsupportedProps = schema.metadata?.unsupportedProps?.filter(
    (property) => property.name !== 'steps',
  );
  if (unsupportedProps && unsupportedProps.length > 0) {
    schema.metadata = { unsupportedProps };
  } else {
    delete schema.metadata;
  }
}

function sortedUniqueStrings(values: string[]): string[] {
  const sorted: string[] = [];

  for (const value of new Set(values)) {
    const insertionIndex = sorted.findIndex((existingValue) => existingValue > value);
    if (insertionIndex === -1) {
      sorted.push(value);
    } else {
      sorted.splice(insertionIndex, 0, value);
    }
  }

  return sorted;
}

function makeRunStepTimelineStepSchema(childrenSchema?: PropertySchema): PropertySchema {
  const properties: Record<string, PropertySchema> = {
    id: {
      type: 'string',
      description: 'Stable identity; used as the keyed list identity.',
    },
    label: {
      type: 'string',
      description: 'Display label for this step.',
    },
    status: {
      enum: [
        'pending',
        'running',
        'succeeded',
        'failed',
        'cancelled',
        'skipped',
        'retrying',
        'waiting_approval',
      ],
      description: 'Generic execution state.',
    },
    startTime: {
      type: 'string',
      description: 'ISO datetime string for when this step started.',
    },
    endTime: {
      type: 'string',
      description: 'ISO datetime string for when this step ended.',
    },
    duration: {
      type: 'string',
      description: 'Human-readable duration string, e.g. "1m 23s".',
    },
    attemptCount: {
      type: 'number',
      description: 'Number of attempts made so far, including any retries.',
    },
    actionsCount: {
      type: 'number',
      description: 'Number of actions associated with this step.',
    },
    progress: {
      type: 'number',
      description: 'Optional determinate progress value between 0 and `progressMax`.',
    },
    progressMax: {
      type: 'number',
      description: 'Maximum value for the progress bar. Defaults to 100.',
    },
    details: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Stable identity for this detail panel.',
          },
          label: {
            type: 'string',
            description: 'Trigger label rendered on the Collapsible header.',
          },
          content: {
            type: 'string',
            description: 'Pre-formatted content shown inside the panel.',
          },
        },
        additionalProperties: false,
        required: ['content', 'id', 'label'],
      },
      description: 'Expandable detail panels (logs, payloads, errors) shown inline.',
    },
    link: {
      type: 'object',
      properties: {
        href: {
          type: 'string',
          description: 'Destination URL for the step link.',
        },
        label: {
          type: 'string',
          description: 'Visible text for the step link.',
        },
      },
      additionalProperties: false,
      required: ['href', 'label'],
      description: 'Optional link to logs, traces, or a step detail route.',
    },
  };

  if (childrenSchema) {
    properties['children'] = childrenSchema;
  }

  return {
    type: 'object',
    properties,
    additionalProperties: false,
    required: ['id', 'label', 'status'],
  };
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
  if (depth > MAX_SCHEMA_TYPE_DEPTH) return { kind: 'unsupported', reason: 'unknown-shape' };

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
  if (type.isStringLiteral()) return { kind: 'ok', schema: { const: stringLiteralValue(type) } };
  if (type.isNumberLiteral()) return { kind: 'ok', schema: { const: numberLiteralValue(type) } };
  if (type.isBooleanLiteral()) {
    return { kind: 'ok', schema: { const: booleanLiteralValue(type) } };
  }
  if (type.isString()) return { kind: 'ok', schema: { type: 'string' } };
  if (type.isNumber()) return { kind: 'ok', schema: { type: 'number' } };
  if (type.isBoolean()) return { kind: 'ok', schema: { type: 'boolean' } };
  if (type.isNull()) return { kind: 'ok', schema: { type: 'null' } };

  if (type.isArray()) {
    const element = type.getArrayElementTypeOrThrow();
    const inner = convertType(
      element,
      depth + 1,
      expandObjectShapes || hasSchemaObjectTagDeep(element),
    );
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

  // NoInfer<T> — TypeScript 5.4 substitution type that wraps a type parameter to
  // prevent inference widening. ts-morph does not flag it as a type parameter, but
  // its getText() returns "NoInfer<…>", so we detect it by text prefix.
  if (type.getText().startsWith('NoInfer<')) {
    return { kind: 'unsupported', reason: 'generic-type-parameter' };
  }

  // Object: model simple structural object types only when explicitly allowed.
  // Unsupported member shapes make the whole prop unsupported instead of emitting
  // an opaque object schema that downstream consumers would treat as permissive.
  if (type.isObject()) {
    const stringIndex = type.getStringIndexType();
    if (stringIndex) {
      const inner = convertType(stringIndex, depth + 1, expandObjectShapes);
      if (inner.kind === 'unsupported') return inner;
      return { kind: 'ok', schema: { type: 'object', additionalProperties: inner.schema } };
    }

    if (
      depth > MAX_SCHEMA_STRUCTURAL_OBJECT_DEPTH ||
      !expandObjectShapes ||
      !(
        isDeclaredInActiveTypesFile(type) ||
        isDeclaredInComponentTypesFile(type) ||
        hasSchemaObjectTagDeep(type) ||
        isNamedSchemaObjectType(type)
      )
    ) {
      return { kind: 'unsupported', reason: 'unknown-shape' };
    }

    const properties: Record<string, PropertySchema> = {};
    const required: string[] = [];

    for (const property of type.getProperties()) {
      const propertyType = getPropType(property);
      if (!propertyType) return { kind: 'unsupported', reason: 'unknown-shape' };
      const converted = hasJsDocTag(property, 'schemaPermissive')
        ? { kind: 'ok' as const, schema: {} }
        : convertType(
            propertyType,
            depth + 1,
            expandObjectShapes ||
              hasJsDocTag(property, 'schemaObject') ||
              hasSchemaObjectTagDeep(propertyType),
          );
      if (converted.kind === 'unsupported') return converted;

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

function isDeclaredInComponentTypesFile(type: Type): boolean {
  const declarations = [
    ...(type.getAliasSymbol()?.getDeclarations() ?? []),
    ...(type.getSymbol()?.getDeclarations() ?? []),
  ];

  return declarations.some((declaration) => {
    const filePath = declaration.getSourceFile().getFilePath();
    return (
      filePath.includes('/packages/components/src/components/') && filePath.endsWith('.types.ts')
    );
  });
}

/**
 * Read a string-literal type's value. ts-morph types `getLiteralValueOrThrow()`
 * as `string | number | PseudoBigInt`, so we runtime-check rather than assert.
 */
function stringLiteralValue(type: Type): string {
  const value = type.getLiteralValueOrThrow();
  if (typeof value !== 'string') {
    throw new Error(`Expected string literal, got ${typeof value}: ${type.getText()}`);
  }
  return value;
}

/**
 * Read a number-literal type's value. See {@link stringLiteralValue} for why
 * this runtime-checks instead of asserting.
 */
function numberLiteralValue(type: Type): number {
  const value = type.getLiteralValueOrThrow();
  if (typeof value !== 'number') {
    throw new Error(`Expected number literal, got ${typeof value}: ${type.getText()}`);
  }
  return value;
}

function literalValue(type: Type): string | number | boolean {
  if (type.isStringLiteral()) return stringLiteralValue(type);
  if (type.isNumberLiteral()) return numberLiteralValue(type);
  if (type.isBooleanLiteral()) return booleanLiteralValue(type);
  throw new Error(`literalValue called on non-literal type: ${type.getText()}`);
}

function booleanLiteralValue(type: Type): boolean {
  // A boolean-literal type prints as exactly `true` or `false`. ts-morph's
  // public `Type` API has no boolean accessor, so the type text is the
  // cast-free way to read which literal this is.
  return type.getText() === 'true';
}

function hasSchemaObjectTag(type: Type): boolean {
  const symbol = type.getAliasSymbol() ?? type.getSymbol();
  if (!symbol) return false;

  let declarations: ReturnType<MorphSymbol['getDeclarations']>;
  try {
    declarations = symbol.getDeclarations();
  } catch {
    return false;
  }

  for (const declaration of declarations) {
    if (!Node.isJSDocable(declaration)) continue;
    const docs = declaration.getJsDocs();
    if (docs.some((doc) => doc.getTags().some((tag) => tag.getTagName() === 'schemaObject'))) {
      return true;
    }
  }

  return false;
}

function hasSchemaObjectTagDeep(type: Type, seen = new Set<string>(), depth = 0): boolean {
  if (depth > 4) return false;
  const key = [
    type.getAliasSymbol()?.getName(),
    type.getSymbol()?.getName(),
    type.getText(undefined, 0).slice(0, 240),
  ].join('|');
  if (seen.has(key)) return false;
  seen.add(key);

  if (hasSchemaObjectTag(type)) return true;
  if (type.isUnion()) {
    return type
      .getUnionTypes()
      .some((part) => !part.isUndefined() && hasSchemaObjectTagDeep(part, seen, depth + 1));
  }
  if (type.isArray())
    return hasSchemaObjectTagDeep(type.getArrayElementTypeOrThrow(), seen, depth + 1);
  return false;
}

function isNamedSchemaObjectType(type: Type): boolean {
  const names = [
    type.getAliasSymbol()?.getName(),
    type.getSymbol()?.getName(),
    type.getText(),
  ].filter(Boolean);

  return names.some((name) => /(?:Schema|SchemaConfiguration|SchemaPoint)/.test(name ?? ''));
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

function getPropType(symbol: MorphSymbol): Type | null {
  const declarations = symbol.getDeclarations();
  if (declarations.length === 0) return null;

  // When a component's own prop type shadows an inherited HTML attribute (e.g.
  // `value?: NoInfer<T>` in `SelectProps<T>` shadowing `HTMLSelectAttributes`'s
  // `value?: any`), ts-morph returns the HTML-attribute declaration first because
  // TypeScript resolves intersections left-to-right. We prefer the locally-authored
  // declaration so schema generation sees the component's intended type, not the
  // HTML fallback.
  const htmlAttributeSites = getHtmlAttributeDeclarationSites();
  const localDecl = declarations.find(
    (d) => !htmlAttributeSites.has(d.getSourceFile().getFilePath()),
  );
  const decl = localDecl ?? declarations[0]!;
  const resolvedType = symbol.getTypeAtLocation(decl);

  // `symbol.getTypeAtLocation` collapses `NoInfer<T>` props to `any` when the
  // enclosing type alias is generic (e.g. `SelectProps<T>`). When the resolved
  // type is `any` and the local declaration lives in the active types file, use
  // the TypeChecker directly on that declaration to recover the unevaluated
  // generic type. We only substitute the checker type when it references `NoInfer`
  // to avoid changing resolution for other components (e.g. `Input`, `Radio`) that
  // also shadow HTML attribute `value` with a plain `string` type.
  if (resolvedType.isAny() && localDecl !== undefined) {
    const checkerType = getProject().getTypeChecker().getTypeAtLocation(localDecl);
    if (checkerType.getText().includes('NoInfer<')) return checkerType;
  }

  return resolvedType;
}

function findExportedType(sourceFile: SourceFile, name: string): Type | null {
  const iface: InterfaceDeclaration | undefined = sourceFile.getInterface(name);
  if (iface && iface.isExported()) return iface.getType();
  const alias: TypeAliasDeclaration | undefined = sourceFile.getTypeAlias(name);
  if (alias && alias.isExported()) return alias.getType();
  return null;
}

function readJsDocDescription(symbol: MorphSymbol): string | undefined {
  const tags = symbol.getDeclarations().flatMap((d) => (Node.isJSDocable(d) ? d.getJsDocs() : []));
  for (const doc of tags) {
    const text = doc.getDescription().trim();
    if (text) return text;
  }
  return undefined;
}

function readJsDocDefault(symbol: MorphSymbol): unknown {
  for (const decl of symbol.getDeclarations()) {
    if (!Node.isJSDocable(decl)) continue;
    const docs = decl.getJsDocs();
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
    if (!Node.isJSDocable(decl)) continue;
    const docs = decl.getJsDocs();
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
  if (schema.allOf) {
    // `allOf` schemas carry a JSON Schema `then` keyword. Emitting them as an
    // object literal would (a) make the `then` key trip `unicorn/no-thenable`
    // and (b) force `tsc` to deep-check a large literal. Parsing a JSON string
    // sidesteps both; the value is a build-time-generated schema, so the single
    // assertion on `JSON.parse`'s `any` result is safe and documented.
    return [
      `import type { ComponentSchema } from '${relativePath}';`,
      ``,
      `// eslint-disable-next-line no-unsafe-type-assertion -- generated schema parsed from a build-validated JSON string; see generate-component-schema.ts.`,
      `const schema = JSON.parse(${JSON.stringify(literal)}) as ComponentSchema;`,
      ``,
      `export default schema;`,
      ``,
    ].join('\n');
  }

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
