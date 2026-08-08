import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    patch: {
      type: 'string',
      description: 'Unified patch text to parse and render.',
    },
    ariaLabel: {
      type: 'string',
      description: 'Accessible label for the diff region.',
    },
    maxLines: {
      type: 'integer',
      description: 'Maximum number of diff rows to render before truncating.',
      minimum: 0,
      default: 1000,
    },
    lineNumbers: {
      type: 'boolean',
      description: 'Whether old and new line-number gutters are rendered.',
      default: true,
    },
    class: {
      type: 'string',
      description: 'Additional CSS classes merged with `.cinder-source-diff-viewer`.',
    },
  },
  additionalProperties: false,
  required: ['patch'],
  metadata: {
    unsupportedProps: [
      {
        name: 'empty',
        reason: 'function-or-snippet',
        description:
          'Rendered when the patch is empty or contains no displayable diff rows.\nFalls back to a default "No patch lines to display." message — matching\nthe `empty` snippet the chart/command families expose.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
