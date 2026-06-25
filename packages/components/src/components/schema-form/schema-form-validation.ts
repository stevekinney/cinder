import type { ErrorObject, ValidateFunction } from 'ajv';

import { isRecord, pathKey, type JsonSchemaObject } from './schema-form-model.ts';

export type SchemaFormValidationIssue = {
  path: string[];
  message: string;
};

export type SchemaFormValidationResult =
  | { valid: true; value: unknown; issues: [] }
  | { valid: false; value: unknown; issues: SchemaFormValidationIssue[] };

const validatorCache = new WeakMap<JsonSchemaObject, Promise<ValidateFunction>>();

export async function validateSchemaValue(
  schema: JsonSchemaObject,
  value: unknown,
): Promise<SchemaFormValidationResult> {
  if (!isRecord(schema)) {
    return validationFailure(value, 'SchemaForm only accepts JSON Schema objects.');
  }

  if (isLegacyStandardSchema(schema)) {
    return validationFailure(value, 'SchemaForm only accepts JSON Schema objects.');
  }

  return validateJsonSchemaValue(schema, value);
}

async function validateJsonSchemaValue(
  schema: JsonSchemaObject,
  value: unknown,
): Promise<SchemaFormValidationResult> {
  let validate: ValidateFunction;
  try {
    validate = await validatorForSchema(schema);
  } catch (error) {
    return validationFailure(value, readableSchemaError(error));
  }

  let valid: unknown;
  try {
    const result = validate(value) as unknown;
    valid = isPromiseLike(result) ? (await result, true) : result;
  } catch (error) {
    if (isAjvValidationError(error)) {
      return {
        valid: false,
        value,
        issues: ajvIssues(error.errors),
      };
    }

    return validationFailure(value, readableSchemaError(error));
  }

  if (valid) return { valid: true, value, issues: [] };
  return {
    valid: false,
    value,
    issues: ajvIssues(validate.errors ?? []),
  };
}

function validationFailure(value: unknown, message: string): SchemaFormValidationResult {
  return {
    valid: false,
    value,
    issues: [{ path: [], message }],
  };
}

function isLegacyStandardSchema(schema: JsonSchemaObject): boolean {
  const standard = schema['~standard'];
  return isRecord(standard) && standard['version'] === 1;
}

function readableSchemaError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Invalid JSON Schema.';
  return `Invalid JSON Schema: ${message}`;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return isRecord(value) && typeof value['then'] === 'function';
}

function isAjvValidationError(error: unknown): error is { errors: ErrorObject[] } {
  return isRecord(error) && Array.isArray(error['errors']);
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

function ajvIssues(errors: readonly ErrorObject[]): SchemaFormValidationIssue[] {
  return errors.map((error) => ({
    path: ajvErrorPath(error),
    message: readableAjvMessage(error),
  }));
}

function readableAjvMessage(error: ErrorObject): string {
  const fieldName = ajvErrorPath(error).at(-1) ?? 'Value';
  const label = humanizeFieldName(fieldName);

  if (error.keyword === 'required') return `${label} is required.`;
  if (error.keyword === 'minLength') return `${label} is too short.`;
  if (error.keyword === 'maxLength') return `${label} is too long.`;
  if (error.keyword === 'minimum') return `${label} must be at least ${error.params?.['limit']}.`;
  if (error.keyword === 'maximum') return `${label} must be at most ${error.params?.['limit']}.`;
  if (error.keyword === 'type') return `${label} must be ${error.params?.['type']}.`;

  return error.message ?? 'Invalid value';
}

function humanizeFieldName(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
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
