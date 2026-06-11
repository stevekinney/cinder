import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'string',
      description: 'Identifier — matches the value of the corresponding Tab.',
    },
    ariaLabelledby: {
      type: 'string',
      description:
        "Override the `aria-labelledby` target. By default the panel points at the\ncontext-derived Tab id (`${baseId}-tab-${value}`). Supply this only when you\nhave overridden the paired Tab's `id` prop — pass that same custom id here so\nthe ARIA tab→panel relationship stays wired to a real element.",
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-tab-panel`.',
    },
  },
  additionalProperties: false,
  required: ['value'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Panel content.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
