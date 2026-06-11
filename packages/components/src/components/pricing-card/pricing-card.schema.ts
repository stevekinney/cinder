import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Plan name displayed as the card heading.',
    },
    price: {
      type: 'string',
      description: 'Price string, e.g. "$9/mo" or "Free".',
    },
    features: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Feature strings to display in the bulleted list.',
    },
    cta: {
      type: 'string',
      description: 'Label for the call-to-action button.',
    },
    caveat: {
      type: 'string',
      description: 'Optional footnote or caveat beneath the features list.',
    },
    selected: {
      type: 'boolean',
      description: 'Whether this card is the currently selected plan.',
      default: false,
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-pricing-card`.',
    },
  },
  additionalProperties: false,
  required: ['cta', 'features', 'name', 'price'],
  metadata: {
    unsupportedProps: [
      {
        name: 'onselect',
        reason: 'function-or-snippet',
        required: true,
        description: 'Called when the CTA button is clicked.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
