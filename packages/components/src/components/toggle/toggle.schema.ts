import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description:
        'Native id placed on the `<button>`; the rendered label uses `aria-labelledby` to name it (label id is derived as `${id}-label`).',
    },
    checked: {
      type: 'boolean',
      description: 'Whether the toggle is currently checked. Bindable — defaults to false.',
    },
    label: {
      type: 'string',
      description:
        'Visible label text. Always the accessible name, even when `hideLabel` is set. Required.',
    },
    disabled: {
      type: 'boolean',
      description: 'Prevents interaction when true. Sets `disabled` attribute.',
    },
    hideLabel: {
      type: 'boolean',
      description:
        'Visually hide the rendered label while keeping it as the accessible name. Use for icon-only or inline contexts.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-toggle` on the switch button.',
    },
  },
  additionalProperties: false,
  required: ['id', 'label'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
