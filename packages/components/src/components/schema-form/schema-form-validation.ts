import {
  compileInterpreted,
  dedupeInterpreterErrors,
  stripPointerHash,
  type InterpreterCompiled,
  type InterpreterError,
  type InterpreterKnownDraft,
} from '../../utilities/json-schema-interpreter.ts';
import { isRecord, pathKey, type JsonSchemaObject } from './schema-form-model.ts';

export type SchemaFormValidationIssue = {
  path: string[];
  message: string;
};

export type SchemaFormValidationResult =
  | { valid: true; value: unknown; issues: [] }
  | { valid: false; value: unknown; issues: SchemaFormValidationIssue[] };

const validatorCache = new WeakMap<JsonSchemaObject, Promise<InterpreterCompiled>>();

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
  let compiled: InterpreterCompiled;
  try {
    compiled = await validatorForSchema(schema);
  } catch (error) {
    return validationFailure(value, readableSchemaError(error));
  }

  // A schema that doesn't compile (bad keyword shape, unresolved $ref, …)
  // is a schema-authoring problem, not a data-validation failure — surface
  // it as a root issue, matching Ajv's compile() throwing.
  const compileErrors = dedupeInterpreterErrors([...compiled.schemaErrors, ...compiled.refErrors]);
  if (compileErrors.length > 0) {
    return validationFailure(value, readableSchemaError(new Error(compileErrors[0]?.message)));
  }

  const result = compiled.validate(value);
  if (result.valid) return { valid: true, value, issues: [] };
  return { valid: false, value, issues: interpreterIssues(result.errors) };
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
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (message.startsWith('Invalid JSON Schema')) return message;
  return message === '' ? 'Invalid JSON Schema.' : `Invalid JSON Schema: ${message}`;
}

function validatorForSchema(schema: JsonSchemaObject): Promise<InterpreterCompiled> {
  const cached = validatorCache.get(schema);
  if (cached) return cached;

  const promise = createValidator(schema)
    .then((compiled) => {
      // A schema that fails to compile (bad keyword shape, unresolved
      // $ref, …) is retried on every call rather than cached — the schema
      // object may be actively mutated in place by its owner (see "does
      // not cache failed JSON Schema compilation attempts" below), and a
      // cached failure would otherwise survive that mutation.
      if (compiled.schemaErrors.length > 0 || compiled.refErrors.length > 0) {
        validatorCache.delete(schema);
      }
      return compiled;
    })
    .catch((error: unknown) => {
      validatorCache.delete(schema);
      throw error;
    });
  validatorCache.set(schema, promise);
  return promise;
}

function createValidator(schema: JsonSchemaObject): Promise<InterpreterCompiled> {
  // SchemaForm has never registered ajv-formats — `format` has always been
  // a recognised-but-unenforced keyword here (unlike JsonSchemaEditor,
  // which does register it). `formats: false` keeps that exact behaviour
  // rather than newly asserting formats as a side effect of moving both
  // components onto one shared interpreter.
  return compileInterpreted(schema, jsonSchemaDraft(schema), { formats: false });
}

function jsonSchemaDraft(schema: JsonSchemaObject): InterpreterKnownDraft {
  const id = schema['$schema'];
  if (typeof id !== 'string') return '2020-12';
  if (id.includes('draft-07')) return 'draft-07';
  if (id.includes('2019-09')) return '2019-09';
  return '2020-12';
}

function interpreterIssues(errors: readonly InterpreterError[]): SchemaFormValidationIssue[] {
  return errors.map((error) => ({
    path: interpreterErrorPath(error),
    message: readableInterpreterMessage(error),
  }));
}

function readableInterpreterMessage(error: InterpreterError): string {
  const fieldName = interpreterErrorPath(error).at(-1) ?? 'Value';
  const label = humanizeFieldName(fieldName);

  if (error.code === 'required-property-error') return `${label} is required.`;
  if (error.code === 'min-length-error') return `${label} is too short.`;
  if (error.code === 'max-length-error') return `${label} is too long.`;
  if (error.code === 'minimum-error') {
    return `${label} must be at least ${String(error.data['minimum'])}.`;
  }
  if (error.code === 'maximum-error') {
    return `${label} must be at most ${String(error.data['maximum'])}.`;
  }
  if (error.code === 'type-error') return `${label} must be ${String(error.data['expected'])}.`;

  return error.message || 'Invalid value';
}

function humanizeFieldName(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
}

function interpreterErrorPath(error: InterpreterError): string[] {
  const parentPath = jsonPointerToPath(stripPointerHash(error.pointer));
  if (error.code !== 'required-property-error') return parentPath;

  const missingProperty = error.data['key'];
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
