import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    as: {
      enum: ['section', 'div'],
      description: 'Wrapper element tag.',
      default: 'section',
    },
    title: {
      type: 'string',
      description: 'Optional section title.',
    },
    description: {
      type: 'string',
      description: 'Optional section description.',
    },
    plans: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Plan name.',
          },
          price: {
            type: 'string',
            description: 'Plan price label.',
          },
          features: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Included features.',
          },
          cta: {
            type: 'string',
            description: 'CTA label for the plan action button.',
          },
          caveat: {
            type: 'string',
            description: 'Optional caveat text.',
          },
          selected: {
            type: 'boolean',
            description: 'Marks plan as highlighted/selected.',
          },
        },
        additionalProperties: false,
        required: ['cta', 'features', 'name', 'price'],
      },
      description: 'Plans rendered as PricingCard components.',
    },
    columns: {
      enum: [1, 2, 3, 4],
      description: 'Grid column count.',
      default: 3,
    },
    maxWidth: {
      enum: ['prose', 'narrow', 'wide', 'full'],
      description: 'Max width token forwarded to Container.',
      default: 'wide',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-pricing-section`.',
    },
  },
  additionalProperties: false,
  required: ['plans'],
  metadata: {
    unsupportedProps: [
      {
        name: 'onPlanSelect',
        reason: 'function-or-snippet',
        description: 'Callback fired when a plan CTA is clicked.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
