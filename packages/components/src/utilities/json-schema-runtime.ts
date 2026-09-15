import { fullFormats } from 'ajv-formats/dist/formats.js';
import {
  compileSchema,
  draft07,
  draft2019,
  draft2020,
  type Draft,
  type JsonError,
  type JsonSchema,
  type SchemaNode,
} from 'json-schema-library';
import { addFormats } from 'json-schema-library/formats';
import { detectJsonSchemaDraft } from './json-schema-draft.ts';

type JsonSchemaRuntimeValue = JsonSchema | boolean;

export type JsonSchemaRuntimeError = JsonError & {
  data: JsonError['data'] & { key?: string; expected?: string; received?: string };
};

export type JsonSchemaRuntimeResult = {
  valid: boolean;
  errors: JsonSchemaRuntimeError[];
};

type RuntimeDraft = Draft & { formats: NonNullable<Draft['formats']> };

const runtimeDrafts = [draft07, draft2019, draft2020] as RuntimeDraft[];

addFormats(runtimeDrafts);

const customFormats: Record<string, RuntimeDraft['formats'][string]> = {};
type FormatDefinition = Exclude<(typeof fullFormats)[keyof typeof fullFormats], boolean>;

function formatApplies(definition: FormatDefinition, data: unknown): boolean {
  if (typeof definition === 'object' && definition !== null && 'type' in definition) {
    return typeof data === definition.type;
  }
  return typeof data === 'string';
}

for (const [name, definition] of Object.entries(fullFormats)) {
  if (definition === true) continue;
  customFormats[name] = ({ node, pointer, data }) => {
    if (!formatApplies(definition, data)) return undefined;
    const valid =
      definition instanceof RegExp
        ? typeof data === 'string' && definition.test(data)
        : typeof definition === 'function'
          ? typeof data === 'string' && definition(data)
          : typeof definition === 'object' && definition !== null && 'validate' in definition
            ? typeof definition.validate === 'function' && definition.type === 'number'
              ? typeof data === 'number' && definition.validate(data)
              : typeof definition.validate === 'function' &&
                typeof data === 'string' &&
                Reflect.apply(definition.validate, definition, [data]) === true
            : false;
    return valid
      ? undefined
      : node.createError(
          `format-${name}-error`,
          { value: data, pointer, schema: node.schema },
          `Value \`${String(data)}\` at \`${pointer}\` is not a valid ${name}`,
        );
  };
}

for (const draft of runtimeDrafts) {
  draft.formats = { ...draft.formats, ...customFormats };
}

function knownDraft(draft: string | undefined): RuntimeDraft | undefined {
  if (draft === 'draft-07') return draft07;
  if (draft === '2019-09') return draft2019;
  if (draft === '2020-12') return draft2020;
  return undefined;
}

function schemaDraft(schema: JsonSchema): string | undefined {
  const draft = detectJsonSchemaDraft(schema);
  return draft === '2020-12' && schema['$schema'] === undefined ? undefined : draft;
}

export function compileJsonSchemaRuntime(
  schema: JsonSchemaRuntimeValue,
  draftOverride?: string,
  options: { throwOnInvalidRef?: boolean; throwOnInvalidSchema?: boolean } = {},
): SchemaNode & { schemaErrors?: JsonError[] } {
  const declaredDraft = typeof schema === 'object' ? schemaDraft(schema) : undefined;
  if (declaredDraft === 'unknown') {
    const schemaIdentifier = typeof schema === 'object' ? schema['$schema'] : undefined;
    throw new Error(`Unknown JSON Schema draft: ${String(schemaIdentifier)}`);
  }
  if (draftOverride && declaredDraft && draftOverride !== declaredDraft) {
    throw new Error(`Schema draft ${declaredDraft} does not match override ${draftOverride}`);
  }
  const selectedDraft = knownDraft(draftOverride ?? declaredDraft) ?? draft2020;
  return compileSchema(schema, {
    drafts: [selectedDraft],
    formatAssertion: true,
    throwOnInvalidRef: options.throwOnInvalidRef ?? true,
    throwOnInvalidSchema: options.throwOnInvalidSchema ?? false,
  });
}

export function validateJsonSchemaRuntime(
  node: SchemaNode,
  value: unknown,
): JsonSchemaRuntimeResult {
  const result = node.validate(value);
  return {
    valid: result.valid,
    errors: (result.errors ?? []) as JsonSchemaRuntimeError[],
  };
}
