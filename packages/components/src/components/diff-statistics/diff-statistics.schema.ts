import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    added: {
      type: 'number',
      description: 'Number of added lines.',
    },
    removed: {
      type: 'number',
      description: 'Number of removed lines.',
    },
    modified: {
      type: 'number',
      description: 'Number of modified lines.',
    },
    variant: {
      enum: ['default', 'compact'],
      description: 'Visual density.',
    },
    density: {
      const: 'toolbar',
      description:
        'Toolbar density opt-in (compact variant only). When set, pills snap to\nthe shared `--cinder-control-height-sm` tier.',
    },
    hideZero: {
      type: 'boolean',
      description: 'Hide statistics with a zero value.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-diff-statistics`.',
    },
  },
  additionalProperties: false,
  required: ['added', 'modified', 'removed'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
