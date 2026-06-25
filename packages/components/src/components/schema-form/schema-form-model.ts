export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonSchemaObject = Record<string, unknown>;

export type SchemaFormFieldKind =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'array'
  | 'object'
  | 'json';

export type SchemaFormOption = {
  label: string;
  value: JsonPrimitive;
  encodedValue: string;
};

export type SchemaFormField = {
  kind: SchemaFormFieldKind;
  key: string;
  path: string[];
  label: string;
  required: boolean;
  description?: string;
  schema: JsonSchemaObject;
  fields: SchemaFormField[];
  options: SchemaFormOption[];
  item?: SchemaFormField;
};

export type SchemaFormModel = {
  field: SchemaFormField;
  sourceSchema: JsonSchemaObject;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isJsonSchemaObject(value: unknown): value is JsonSchemaObject {
  return isRecord(value);
}

export function createSchemaFormModel(schema: JsonSchemaObject): SchemaFormModel {
  return {
    field: fieldFromJsonSchema(schema, [], 'value', true),
    sourceSchema: schema,
  };
}

function fieldFromJsonSchema(
  schema: unknown,
  path: string[],
  key: string,
  required: boolean,
): SchemaFormField {
  if (!isRecord(schema)) {
    return baseField('json', {}, path, key, required);
  }

  const normalizedSchema = schema;
  const options = enumOptions(normalizedSchema);
  if (options.length > 0) {
    return { ...baseField('enum', normalizedSchema, path, key, required), options };
  }

  const schemaType = schemaTypeOf(normalizedSchema);
  const schemaProperties = normalizedSchema['properties'];
  if (schemaType === 'object' || isRecord(schemaProperties)) {
    const requiredProperties = requiredPropertyNames(normalizedSchema);
    const properties = isRecord(schemaProperties) ? schemaProperties : {};
    const fields = Object.entries(properties).map(([propertyKey, propertySchema]) =>
      fieldFromJsonSchema(
        propertySchema,
        [...path, propertyKey],
        propertyKey,
        requiredProperties.has(propertyKey),
      ),
    );
    return { ...baseField('object', normalizedSchema, path, key, required), fields };
  }

  if (schemaType === 'array') {
    const schemaItems = normalizedSchema['items'];
    const itemSchema = isRecord(schemaItems) ? schemaItems : {};
    const item = fieldFromJsonSchema(itemSchema, [...path, '0'], 'item', true);
    return { ...baseField('array', normalizedSchema, path, key, required), item };
  }

  const fieldKind = fieldKindForSchemaType(schemaType);
  if (fieldKind) {
    return baseField(fieldKind, normalizedSchema, path, key, required);
  }

  return baseField('json', normalizedSchema, path, key, required);
}

function fieldKindForSchemaType(type: string | undefined): SchemaFormFieldKind | undefined {
  switch (type) {
    case 'string':
    case 'number':
    case 'integer':
    case 'boolean':
    case 'array':
    case 'object':
      return type;
    default:
      return undefined;
  }
}

function baseField(
  kind: SchemaFormFieldKind,
  schema: JsonSchemaObject,
  path: string[],
  key: string,
  required: boolean,
): SchemaFormField {
  const description = schema['description'];
  return {
    kind,
    key,
    path,
    label: fieldLabel(schema, key),
    required,
    ...(typeof description === 'string' && description.length > 0 ? { description } : {}),
    schema,
    fields: [],
    options: [],
  };
}

function schemaTypeOf(schema: JsonSchemaObject): string | undefined {
  const { type } = schema;
  if (typeof type === 'string') return type;
  if (Array.isArray(type)) {
    const supported = type.find(
      (candidate) => typeof candidate === 'string' && candidate !== 'null',
    );
    return typeof supported === 'string' ? supported : undefined;
  }
  return undefined;
}

function requiredPropertyNames(schema: JsonSchemaObject): Set<string> {
  const required = schema['required'];
  if (!Array.isArray(required)) return new Set();
  return new Set(required.filter((property): property is string => typeof property === 'string'));
}

function enumOptions(schema: JsonSchemaObject): SchemaFormOption[] {
  const values = schema['enum'];
  if (!Array.isArray(values) || values.length === 0) return [];
  if (!values.every((value): value is JsonPrimitive => isJsonPrimitive(value))) return [];
  return values.map((value) => ({
    label: String(value),
    value,
    encodedValue: encodeEnumValue(value),
  }));
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

export function encodeEnumValue(value: JsonPrimitive): string {
  return JSON.stringify(value);
}

export function decodeEnumValue(value: string): JsonPrimitive {
  const parsed: unknown = JSON.parse(value);
  if (!isJsonPrimitive(parsed)) {
    throw new Error('SchemaForm enum values must be JSON primitives.');
  }
  return parsed;
}

function fieldLabel(schema: JsonSchemaObject, key: string): string {
  const title = schema['title'];
  if (typeof title === 'string' && title.trim().length > 0) {
    return title;
  }
  if (key === 'value') return 'Value';
  return key
    .replaceAll(/[-_]+/g, ' ')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function defaultValueForField(field: SchemaFormField): unknown {
  if ('default' in field.schema) return cloneJsonCompatible(field.schema['default']);

  if (field.kind === 'object') {
    const value: Record<string, unknown> = {};
    for (const child of field.fields) {
      value[child.key] = defaultValueForField(child);
    }
    return value;
  }

  if (field.kind === 'array') return [];
  if (field.kind === 'boolean') return false;
  if (field.kind === 'enum') return field.options[0]?.value ?? '';
  if (field.kind === 'string') return '';
  if (field.kind === 'json') return null;
  return undefined;
}

export function initialValueForField(field: SchemaFormField, value: unknown): unknown {
  if (value === undefined) return defaultValueForField(field);
  const clonedValue = cloneJsonCompatible(value);
  if (clonedValue === undefined) return defaultValueForField(field);
  return mergeInitialValueWithFieldDefaults(field, clonedValue);
}

function mergeInitialValueWithFieldDefaults(field: SchemaFormField, value: unknown): unknown {
  if (field.kind === 'object' && isRecord(value)) {
    const defaultValue = defaultValueForField(field);
    const defaultRecord = isRecord(defaultValue) ? defaultValue : {};
    const result: Record<string, unknown> = { ...defaultRecord };
    const fieldKeys = new Set(field.fields.map((child) => child.key));

    for (const child of field.fields) {
      const seededValue = Object.hasOwn(value, child.key)
        ? value[child.key]
        : defaultRecord[child.key];
      result[child.key] =
        seededValue === undefined
          ? defaultValueForField(child)
          : mergeInitialValueWithFieldDefaults(child, seededValue);
    }

    for (const [key, extraValue] of Object.entries(value)) {
      if (!fieldKeys.has(key)) result[key] = extraValue;
    }

    return result;
  }

  if (field.kind === 'array' && Array.isArray(value) && field.item) {
    return value.map((item) => mergeInitialValueWithFieldDefaults(field.item!, item));
  }

  return value;
}

export function cloneJsonCompatible(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    const serializedValue = JSON.stringify(value, cloneJsonCompatibleReplacer);
    if (serializedValue === undefined) return undefined;
    const clonedValue: unknown = JSON.parse(serializedValue);
    return clonedValue;
  } catch {
    return undefined;
  }
}

function cloneJsonCompatibleReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('SchemaForm values must contain finite numbers.');
  }
  if (typeof value === 'bigint') {
    throw new TypeError('SchemaForm values must not contain bigint values.');
  }
  return value;
}

export function pathKey(path: readonly string[]): string {
  return path.map((segment) => segment.replaceAll('~', '~0').replaceAll('/', '~1')).join('/');
}

export function pathId(path: readonly string[]): string {
  return path.length === 0 ? 'value' : path.map(domIdSegment).join('__');
}

function domIdSegment(segment: string): string {
  let encoded = '';
  for (const character of segment) {
    if (/^[a-zA-Z0-9]$/.test(character)) {
      encoded += character;
    } else {
      encoded += `_${character.codePointAt(0)?.toString(16) ?? '0'}_`;
    }
  }
  return `${segment.length}_${encoded}`;
}

export function getValueAtPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

export function setValueAtPath(value: unknown, path: readonly string[], next: unknown): unknown {
  if (path.length === 0) return next;

  const [head, ...tail] = path;
  if (head === undefined) return next;

  if (Array.isArray(value)) {
    const copy = [...value];
    const index = Number(head);
    if (!Number.isInteger(index) || index < 0) return copy;
    copy[index] = setValueAtPath(copy[index], tail, next);
    return copy;
  }

  const copy: Record<string, unknown> = isRecord(value) ? { ...value } : {};
  copy[head] = setValueAtPath(copy[head], tail, next);
  return copy;
}

export function pruneUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => pruneUndefined(item));
  if (!isRecord(value)) return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) output[key] = pruneUndefined(child);
  }
  return output;
}

export function arrayValueAtPath(value: unknown, path: readonly string[]): unknown[] {
  const array = getValueAtPath(value, path);
  return Array.isArray(array) ? array : [];
}

export function rebaseFieldPath(field: SchemaFormField, path: string[]): SchemaFormField {
  const originalPath = field.path;

  function rebase(candidate: SchemaFormField): SchemaFormField {
    const suffix = candidate.path.slice(originalPath.length);
    return {
      ...candidate,
      path: [...path, ...suffix],
      fields: candidate.fields.map(rebase),
      ...(candidate.item ? { item: rebase(candidate.item) } : {}),
    };
  }

  return rebase(field);
}

export function collectJsonFields(field: SchemaFormField): SchemaFormField[] {
  const fields: SchemaFormField[] = [];

  function visit(candidate: SchemaFormField) {
    if (candidate.kind === 'json') fields.push(candidate);
    for (const child of candidate.fields) visit(child);
    if (candidate.item) visit(candidate.item);
  }

  visit(field);
  return fields;
}
