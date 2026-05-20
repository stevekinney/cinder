import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        'Native id placed on the `<button>` so an external `<label for="…">` can reference it.',
    },
    checked: {
      type: 'boolean',
      description: 'Whether the toggle is currently checked. Bindable — defaults to false.',
    },
    label: {
      type: 'string',
      description: 'Visible accessible name placed on `aria-label`. Required.',
    },
    disabled: {
      type: 'boolean',
      description: 'Prevents interaction when true. Sets `disabled` attribute.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-toggle`.',
    },
  },
  additionalProperties: false,
  required: ['id', 'label'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
