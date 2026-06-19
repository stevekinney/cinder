import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ErrorObject, ValidateFunction } from 'ajv';

import { isRecord, isStandardSchema, pathKey, type JsonSchemaObject } from './schema-form-model.ts';

export type SchemaFormValidationIssue = {
  path: string[];
  message: string;
};

export type SchemaFormValidationResult =
  | { valid: true; value: unknown; issues: [] }
  | { valid: false; value: unknown; issues: SchemaFormValidationIssue[] };

const validatorCache = new WeakMap<JsonSchemaObject, Promise<ValidateFunction>>();

export async function validateSchemaValue(
  schema: JsonSchemaObject | StandardSchemaV1,
  value: unknown,
): Promise<SchemaFormValidationResult> {
  if (isStandardSchema(schema)) return validateStandardSchemaValue(schema, value);
  return validateJsonSchemaValue(schema, value);
}

async function validateStandardSchemaValue(
  schema: StandardSchemaV1,
  value: unknown,
): Promise<SchemaFormValidationResult> {
  const result = await schema['~standard'].validate(value);
  if (!result.issues) return { valid: true, value: result.value, issues: [] };
  return {
    valid: false,
    value,
    issues: result.issues.map((issue) => ({
      path: standardIssuePath(issue.path),
      message: issue.message,
    })),
  };
}

async function validateJsonSchemaValue(
  schema: JsonSchemaObject,
  value: unknown,
): Promise<SchemaFormValidationResult> {
  const validate = await validatorForSchema(schema);
  const valid = validate(value);
  if (valid) return { valid: true, value, issues: [] };
  return {
    valid: false,
    value,
    issues: ajvIssues(validate.errors ?? []),
  };
}

function validatorForSchema(schema: JsonSchemaObject): Promise<ValidateFunction> {
  const cached = validatorCache.get(schema);
  if (cached) return cached;

  const promise = createValidator(schema);
  validatorCache.set(schema, promise);
  return promise;
}

async function createValidator(schema: JsonSchemaObject): Promise<ValidateFunction> {
  const draft = jsonSchemaDraft(schema);
  if (draft === 'draft-07') {
    const { default: Ajv } = await import('ajv');
    return new Ajv({ strict: false, allErrors: true, addUsedSchema: false }).compile(schema);
  }
  if (draft === '2019-09') {
    const { default: Ajv2019 } = await import('ajv/dist/2019.js');
    return new Ajv2019({ strict: false, allErrors: true, addUsedSchema: false }).compile(schema);
  }
  const { default: Ajv2020 } = await import('ajv/dist/2020.js');
  return new Ajv2020({ strict: false, allErrors: true, addUsedSchema: false }).compile(schema);
}

function jsonSchemaDraft(schema: JsonSchemaObject): '2020-12' | '2019-09' | 'draft-07' {
  const id = schema['$schema'];
  if (typeof id !== 'string') return '2020-12';
  if (id.includes('draft-07')) return 'draft-07';
  if (id.includes('2019-09')) return '2019-09';
  return '2020-12';
}

function standardIssuePath(
  path: ReadonlyArray<PropertyKey | StandardSchemaV1.PathSegment> | undefined,
): string[] {
  if (!path) return [];
  return path.map((segment) => {
    if (isRecord(segment) && 'key' in segment) return propertyKeyPathSegment(segment.key);
    return propertyKeyPathSegment(segment);
  });
}

function propertyKeyPathSegment(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'symbol') return value.description ?? value.toString();
  if (value === null || value === undefined) return '';

  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

function ajvIssues(errors: readonly ErrorObject[]): SchemaFormValidationIssue[] {
  return errors.map((error) => ({
    path: ajvErrorPath(error),
    message: error.message ?? 'Invalid value',
  }));
}

function ajvErrorPath(error: ErrorObject): string[] {
  const parentPath = jsonPointerToPath(error.instancePath);
  if (error.keyword !== 'required' || !isRecord(error.params)) return parentPath;

  const missingProperty = error.params['missingProperty'];
  return typeof missingProperty === 'string' ? [...parentPath, missingProperty] : parentPath;
}

export function jsonPointerToPath(pointer: string): string[] {
  if (pointer === '') return [];
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
}

export function issuesByPath(issues: readonly SchemaFormValidationIssue[]): Record<string, string> {
  const grouped: Record<string, string> = {};
  for (const issue of issues) {
    const key = pathKey(issue.path);
    grouped[key] ??= issue.message;
  }
  return grouped;
}

export function parseJsonDraft(
  path: string[],
  text: string,
): { ok: true; value: unknown } | { ok: false; issue: SchemaFormValidationIssue } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      issue: {
        path,
        message: error instanceof Error ? error.message : 'Invalid JSON',
      },
    };
  }
}

export function serializeValidatedValue(
  value: unknown,
): { ok: true; value: string } | { ok: false; issue: SchemaFormValidationIssue } {
  try {
    const serialized = JSON.stringify(value, schemaFormJsonReplacer);
    if (serialized === undefined) {
      throw new TypeError('Validated value is not JSON serializable.');
    }
    return { ok: true, value: serialized };
  } catch (error) {
    return {
      ok: false,
      issue: {
        path: [],
        message:
          error instanceof Error ? error.message : 'Validated value is not JSON serializable',
      },
    };
  }
}

function schemaFormJsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('Validated value contains a non-finite number.');
  }
  if (typeof value === 'bigint') {
    throw new TypeError('Validated value contains a bigint, which is not JSON serializable.');
  }
  return value;
}

export function readSchemaFormData(formData: FormData, name = 'value'): unknown {
  const raw = formData.get(name);
  if (typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
