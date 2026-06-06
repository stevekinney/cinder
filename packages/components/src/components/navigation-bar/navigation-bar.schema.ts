import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
    },
    mobileMenuOpen: {
      type: 'boolean',
      description: 'Two-way bindable open state of the mobile menu.',
    },
    navAriaLabel: {
      type: 'string',
      description:
        "Accessible name for the <nav> landmark. Wins over any aria-label passed via rest. Default 'Main navigation'.",
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
      },
      {
        name: 'brand',
        reason: 'function-or-snippet',
      },
      {
        name: 'items',
        reason: 'function-or-snippet',
      },
      {
        name: 'menuToggle',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
