/**
 * JSON Schema for `DiffReviewExportModel` version 1 (DR-5, "JSON output parses and validates
 * against its versioned contract"). Tests validate every golden JSON fixture and every generated
 * export against this with `ajv`; it is not used at runtime by the exporters themselves, which
 * build the shape directly from typed data and therefore cannot violate it silently.
 *
 * @module
 */

const diffAnchorSchema = {
  oneOf: [
    {
      type: 'object',
      properties: { kind: { const: 'file' } },
      required: ['kind'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        kind: { const: 'range' },
        side: { enum: ['old', 'new'] },
        startLine: { type: 'integer', minimum: 1 },
        endLine: { type: 'integer', minimum: 1 },
        coordinateSpace: { enum: ['raw-source', 'normalized-markdown'] },
        hunkOccurrence: { type: 'integer', minimum: 0 },
        selectedText: { type: 'string' },
        contextBefore: { type: 'array', items: { type: 'string' } },
        contextAfter: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'kind',
        'side',
        'startLine',
        'endLine',
        'coordinateSpace',
        'hunkOccurrence',
        'selectedText',
        'contextBefore',
        'contextAfter',
      ],
      additionalProperties: false,
    },
  ],
};

/** The existing-document anchor variant (contract: "an explicit `document-text` or
 * document-level anchor variant"). */
const documentAnchorSchema = {
  oneOf: [
    {
      type: 'object',
      properties: { kind: { const: 'document' } },
      required: ['kind'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        kind: { const: 'document-text' },
        quote: { type: 'string' },
        prefix: { type: ['string', 'null'] },
        suffix: { type: ['string', 'null'] },
      },
      required: ['kind', 'quote', 'prefix', 'suffix'],
      additionalProperties: false,
    },
  ],
};

const rawMappingSchema = {
  oneOf: [
    {
      type: 'object',
      properties: { status: { const: 'exact' } },
      required: ['status'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { status: { const: 'unavailable' }, reason: { const: 'normalization' } },
      required: ['status', 'reason'],
      additionalProperties: false,
    },
  ],
};

const diffRecordSchema = {
  type: 'object',
  properties: {
    recordKind: { const: 'diff' },
    exportId: { type: 'string' },
    commentId: { type: 'string' },
    targetId: { type: 'string' },
    current: { type: 'boolean' },
    targetKind: { enum: ['source', 'markdown'] },
    targetLabel: { type: 'string' },
    repositoryLabel: { type: ['string', 'null'] },
    baseRevisionLabel: { type: ['string', 'null'] },
    headRevisionLabel: { type: ['string', 'null'] },
    snapshotId: { type: 'string' },
    fileOccurrence: { type: 'integer', minimum: 0 },
    oldPath: { type: ['string', 'null'] },
    newPath: { type: ['string', 'null'] },
    anchor: diffAnchorSchema,
    rawMapping: rawMappingSchema,
    body: { type: 'string' },
    resolved: { type: 'boolean' },
    outdated: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: [
    'recordKind',
    'exportId',
    'commentId',
    'targetId',
    'current',
    'targetKind',
    'targetLabel',
    'repositoryLabel',
    'baseRevisionLabel',
    'headRevisionLabel',
    'snapshotId',
    'fileOccurrence',
    'oldPath',
    'newPath',
    'anchor',
    'rawMapping',
    'body',
    'resolved',
    'outdated',
    'createdAt',
    'updatedAt',
  ],
  additionalProperties: false,
};

const documentRecordSchema = {
  type: 'object',
  properties: {
    recordKind: { const: 'document' },
    exportId: { type: 'string' },
    targetId: { type: 'string' },
    threadId: { type: 'string' },
    createdAt: { type: 'string' },
    anchor: documentAnchorSchema,
    messages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          body: { type: 'string' },
          createdAt: { type: 'string' },
        },
        required: ['id', 'body', 'createdAt'],
        additionalProperties: false,
      },
    },
  },
  required: ['recordKind', 'exportId', 'targetId', 'threadId', 'createdAt', 'anchor', 'messages'],
  additionalProperties: false,
};

/** The versioned contract for `exportDiffReviewJson`'s output (schema version 1 only). */
export const diffReviewExportJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    schemaVersion: { const: 1 },
    scope: { enum: ['all', 'unresolved'] },
    reviewTitle: { type: 'string' },
    reviewNote: { type: 'string' },
    totals: {
      type: 'object',
      properties: {
        records: { type: 'integer', minimum: 0 },
        messageBodies: { type: 'integer', minimum: 0 },
        open: { type: 'integer', minimum: 0 },
        resolved: { type: 'integer', minimum: 0 },
        outdated: { type: 'integer', minimum: 0 },
      },
      required: ['records', 'messageBodies', 'open', 'resolved', 'outdated'],
      additionalProperties: false,
    },
    records: {
      type: 'array',
      items: { oneOf: [diffRecordSchema, documentRecordSchema] },
    },
  },
  required: ['schemaVersion', 'scope', 'reviewTitle', 'reviewNote', 'totals', 'records'],
  additionalProperties: false,
};
