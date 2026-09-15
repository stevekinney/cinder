export type JsonSchemaDraft = 'draft-07' | '2019-09' | '2020-12' | 'unknown';

const DRAFT_IDS: ReadonlyMap<string, Exclude<JsonSchemaDraft, 'unknown'>> = new Map([
  ['http://json-schema.org/draft-07/schema#', 'draft-07'],
  ['http://json-schema.org/draft-07/schema', 'draft-07'],
  ['https://json-schema.org/draft-07/schema', 'draft-07'],
  ['https://json-schema.org/draft-07/schema#', 'draft-07'],
  ['https://json-schema.org/draft/2019-09/schema', '2019-09'],
  ['http://json-schema.org/draft/2019-09/schema', '2019-09'],
  ['https://json-schema.org/draft/2020-12/schema', '2020-12'],
  ['http://json-schema.org/draft/2020-12/schema', '2020-12'],
]);

export function detectJsonSchemaDraft(schema: unknown): JsonSchemaDraft {
  if (typeof schema === 'boolean') return '2020-12';
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return 'unknown';
  const identifier = Object.getOwnPropertyDescriptor(schema, '$schema')?.value;
  if (typeof identifier !== 'string') return '2020-12';
  return DRAFT_IDS.get(identifier) ?? 'unknown';
}
