import type { ComponentSchema } from '../../schema-types.ts';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    readonly: {
      type: 'boolean',
      description:
        'Disables create/edit/delete/resolve/reopen and review-note editing.\nViewing and filtering remain available.',
    },
    defaultFilter: {
      enum: ['all', 'unresolved'],
      description:
        'Initial comment filter. Uncontrolled after mount -- the person can change it locally.',
    },
    class: {
      type: 'string',
      description: 'Additional CSS classes',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'state',
        reason: 'unknown-shape',
        required: true,
        description: 'Controlled diff-review session state. Never mutated directly.',
      },
      {
        name: 'onStateChange',
        reason: 'function-or-snippet',
        required: true,
        description:
          'Called whenever a comment/review-note action succeeds. See the prop doc for the\nlowercase-contract-to-camelCase naming note.',
      },
      {
        name: 'onNavigate',
        reason: 'function-or-snippet',
        required: false,
        description:
          'Called when a person activates a CURRENT comment\'s "Go to" action, never for an\noutdated or removed one.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
