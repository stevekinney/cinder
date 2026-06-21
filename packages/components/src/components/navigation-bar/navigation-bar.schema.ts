import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
      description: 'Custom class merged onto the root `<nav>` element.',
    },
    placement: {
      enum: ['top', 'bottom'],
      description:
        'Visual placement mode. `bottom` renders a mobile tab-bar composition, but\nstill does not fix or stick itself to the viewport.',
      default: 'top',
    },
    showLabels: {
      enum: ['always', 'active', 'never'],
      description:
        'Label visibility for mobile bottom-tab compositions. Hidden labels remain in\nthe accessibility tree when wrapped in `[data-cinder-navigation-label]`.',
      default: 'always',
    },
    mobileMenuOpen: {
      type: 'boolean',
      description: 'Two-way bindable open state of the mobile menu.',
    },
    label: {
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
        required: true,
        description: 'Receives a context object with the current variant.',
      },
      {
        name: 'menuToggle',
        reason: 'function-or-snippet',
        description:
          'Snippet receiving toggle button attributes. Consumer renders the actual <button> and should mark decorative glyphs or icons inside it as aria-hidden so the button name comes from text or aria-label, not the ornament.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
