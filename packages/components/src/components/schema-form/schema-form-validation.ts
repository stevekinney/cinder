import { detectJsonSchemaDraft } from '../../utilities/json-schema-draft.ts';
import type {
  compileJsonSchemaRuntime,
  JsonSchemaRuntimeError,
} from '../../utilities/json-schema-runtime.ts';
import { createRetryingLoaderCache } from '../../utilities/retrying-loader-cache.ts';
import { isRecord, pathKey, type JsonSchemaObject } from './schema-form-model.ts';

const loadJsonSchemaRuntime = createRetryingLoaderCache(
  () => import('../../utilities/json-schema-runtime.ts'),
);

export type SchemaFormValidationIssue = {
  path: string[];
  message: string;
};

export type SchemaFormValidationResult =
  | { valid: true; value: unknown; issues: [] }
  | { valid: false; value: unknown; issues: SchemaFormValidationIssue[] };

const validatorCache = new WeakMap<
  JsonSchemaObject,
  Promise<ReturnType<typeof compileJsonSchemaRuntime>>
>();

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
  let node: ReturnType<typeof compileJsonSchemaRuntime>;
  try {
    node = await validatorForSchema(schema);
  } catch (error) {
    return validationFailure(value, readableSchemaError(error));
  }

  let valid: unknown;
  try {
    const { validateJsonSchemaRuntime } = await loadJsonSchemaRuntime();
    const result = validateJsonSchemaRuntime(node, value);
    valid = result.valid;
    if (!result.valid) {
      return {
        valid: false,
        value,
        issues: jsonSchemaIssues(result.errors),
      };
    }
  } catch (error) {
    return validationFailure(value, readableSchemaError(error));
  }

  if (valid) return { valid: true, value, issues: [] };
  return validationFailure(value, 'Invalid JSON Schema.');
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

function validatorForSchema(
  schema: JsonSchemaObject,
): Promise<ReturnType<typeof compileJsonSchemaRuntime>> {
  const cached = validatorCache.get(schema);
  if (cached) return cached;

  const promise = Promise.resolve()
    .then(() => createValidator(schema))
    .catch((error: unknown) => {
      validatorCache.delete(schema);
      throw error;
    });
  validatorCache.set(schema, promise);
  return promise;
}

async function createValidator(
  schema: JsonSchemaObject,
): Promise<ReturnType<typeof compileJsonSchemaRuntime>> {
  const { compileJsonSchemaRuntime } = await loadJsonSchemaRuntime();
  return compileJsonSchemaRuntime(schema, jsonSchemaDraft(schema), { throwOnInvalidSchema: true });
}

function jsonSchemaDraft(schema: JsonSchemaObject): '2020-12' | '2019-09' | 'draft-07' {
  const draft = detectJsonSchemaDraft(schema);
  if (draft === 'unknown')
    throw new Error(`Unknown JSON Schema draft: ${String(schema['$schema'])}`);
  return draft;
}

function jsonSchemaIssues(errors: readonly JsonSchemaRuntimeError[]): SchemaFormValidationIssue[] {
  return errors.map((error) => ({
    path: jsonSchemaErrorPath(error),
    message: readableJsonSchemaMessage(error),
  }));
}

function readableJsonSchemaMessage(error: JsonSchemaRuntimeError): string {
  const fieldName = jsonSchemaErrorPath(error).at(-1) ?? 'Value';
  const label = humanizeFieldName(fieldName);

  if (error.code === 'required-property-error') return `${label} is required.`;
  if (error.code === 'min-length-error') return `${label} is too short.`;
  if (error.code === 'max-length-error') return `${label} is too long.`;
  if (error.code === 'minimum-error')
    return `${label} must be at least ${String(error.data?.['minimum'])}.`;
  if (error.code === 'maximum-error')
    return `${label} must be at most ${String(error.data?.['maximum'])}.`;
  if (error.code === 'type-error') return `${label} must be ${String(error.data?.expected)}.`;
  if (error.code === 'const-error') return `${label} must be constant.`;

  return error.message ?? 'Invalid value';
}

function humanizeFieldName(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
}

function jsonSchemaErrorPath(error: JsonSchemaRuntimeError): string[] {
  const parentPath = jsonPointerToPath(error.data?.pointer?.replace(/^#/, '') ?? '');
  return error.code === 'required-property-error' && typeof error.data?.key === 'string'
    ? [...parentPath, error.data.key]
    : parentPath;
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
