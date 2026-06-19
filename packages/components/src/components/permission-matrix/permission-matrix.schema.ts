import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Accessible label for the matrix.',
    },
    description: {
      type: 'string',
      description: 'Optional description rendered above the matrix.',
    },
    rowHeaderLabel: {
      type: 'string',
      description: 'Header label for the row axis. Default `Scope`.',
    },
    loading: {
      type: 'boolean',
      description: 'Whether the matrix is in a loading state. Default `false`.',
    },
    class: {
      type: 'string',
      description: 'Custom class applied to the root element.',
    },
  },
  additionalProperties: false,
  required: ['label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'columns',
        reason: 'unknown-shape',
        required: true,
        description: 'Column definitions, usually operations.',
      },
      {
        name: 'empty',
        reason: 'function-or-snippet',
        description: 'Snippet rendered when rows or columns are empty.',
      },
      {
        name: 'getCellState',
        reason: 'function-or-snippet',
        required: true,
        description: 'Resolves the discrete state for one row and column intersection.',
      },
      {
        name: 'loadingContent',
        reason: 'function-or-snippet',
        description: 'Snippet rendered while the matrix is loading.',
      },
      {
        name: 'onCellClick',
        reason: 'function-or-snippet',
        description: 'Called when a matrix cell is activated.',
      },
      {
        name: 'rows',
        reason: 'unknown-shape',
        required: true,
        description: 'Row definitions, usually authorization scopes.',
      },
      {
        name: 'stateLabels',
        reason: 'unknown-shape',
        description: 'Accessible and visible labels for the built-in states.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
