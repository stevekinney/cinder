import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    variant: {
      enum: ['primary', 'secondary', 'soft', 'danger', 'soft-danger', 'ghost', 'ghost-danger'],
      description: 'Visual style.',
      default: 'secondary',
    },
    size: {
      enum: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: 'Size of the button.',
      default: 'md',
    },
    fullWidth: {
      type: 'boolean',
      description: 'Expand to container width.',
      default: false,
    },
    loading: {
      type: 'boolean',
      description: 'Disable the button and show a spinner.',
      default: false,
    },
    iconOnly: {
      type: 'boolean',
      description: 'Render the button with only an icon. Requires an accessible name source.',
      default: false,
    },
    href: {
      type: 'string',
      description: 'Render as an anchor `<a>` element with this href.',
    },
    label: {
      type: 'string',
      description: 'Visible text label. Must be non-empty if provided.',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-button`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
