import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    trigger: {
      type: 'string',
      description: 'Trigger label text. (The snippet form is template-only; see the type above.)',
    },
    open: {
      type: 'boolean',
      description:
        'Bindable open state. Parents can drive it directly and may use `bind:open`\nfor two-way synchronization.',
      default: false,
    },
    disabled: {
      type: 'boolean',
      description: 'When true, the trigger cannot be toggled.',
      default: false,
    },
    triggerAriaLabel: {
      type: 'string',
      description:
        'Accessible name override for the trigger button. The runtime prop also\naccepts a state-aware function (`{ open, disabled } => string`), but JSON\nSchema can only model the string variant.',
    },
    idBase: {
      type: 'string',
      description:
        'Base used to derive the trigger and panel ARIA ids. Auto-generated when omitted.',
    },
    class: {
      type: 'string',
      description: 'Additional classes merged onto the root element.',
    },
  },
  additionalProperties: false,
  required: ['trigger'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Panel content shown when open.',
      },
      {
        name: 'ontoggle',
        reason: 'function-or-snippet',
        description:
          'Fired on every successful toggle with the next open state. Not called while disabled.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
