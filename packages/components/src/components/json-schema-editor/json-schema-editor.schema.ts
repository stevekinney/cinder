import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Required for ARIA wiring.',
    },
    schemaKey: {
      type: 'string',
      description: 'Changing this triggers a full reset (history clears).',
    },
    view: {
      enum: ['form', 'json', 'diff'],
      description: 'Active view: form / json / diff. Bindable.',
    },
    readonly: {
      type: 'boolean',
      description: 'Read-only mode disables all mutations.',
    },
    maxHistory: {
      type: 'number',
      description: 'Maximum history entries (default 100).',
    },
    draftOverride: {
      enum: ['2020-12', '2019-09', 'draft-07'],
      description: 'Force a draft override regardless of $schema.',
    },
    class: {
      type: 'string',
      description: 'Additional class merged onto the `.cinder-jse` root element.',
    },
  },
  additionalProperties: false,
  required: ['id'],
  metadata: {
    unsupportedProps: [
      {
        name: 'defaultSchema',
        reason: 'unknown-shape',
        description: 'Omit `schema` to use this as the initial value of an uncontrolled editor.',
      },
      {
        name: 'onRevert',
        reason: 'function-or-snippet',
      },
      {
        name: 'onSchemaChange',
        reason: 'function-or-snippet',
        description: 'Observe a schema change after the parent accepts the request.',
      },
      {
        name: 'onValidate',
        reason: 'function-or-snippet',
      },
      {
        name: 'onValueChangeRequest',
        reason: 'function-or-snippet',
        description: 'Request that the parent replace `schema` with a committed editor value.',
      },
      {
        name: 'original',
        reason: 'unknown-shape',
        description: 'Optional explicit baseline; defaults to the initial schema input.',
      },
      {
        name: 'schema',
        reason: 'unknown-shape',
        description:
          'Parent-owned schema. Requires `onValueChangeRequest`; do not combine with `defaultSchema`.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
