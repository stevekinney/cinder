import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Visible section header label.',
    },
    id: {
      type: 'string',
      description:
        'Optional stable id for the root <li>. Trigger uses `${id}-trigger`, panel uses `${id}-panel`. If omitted, generated via useId.',
    },
    expanded: {
      type: 'boolean',
      description: 'Whether the group is expanded. Bindable. Default: true.',
    },
    disabled: {
      type: 'boolean',
      description: 'When true, the disclosure button is disabled. Default: false.',
    },
  },
  additionalProperties: false,
  required: ['label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'badge',
        reason: 'function-or-snippet',
      },
      {
        name: 'class',
        reason: 'unknown-shape',
      },
      {
        name: 'icon',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
