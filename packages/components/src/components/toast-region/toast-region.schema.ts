import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    maxStack: {
      type: 'number',
      description: 'Maximum simultaneous toasts in each region. Default 5.',
    },
    defaultDuration: {
      type: 'number',
      description: 'Default auto-dismiss duration in ms. Default 5000. Set to 0 for sticky.',
    },
    position: {
      enum: ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'],
      description: 'Viewport anchor for both live-region channels. Default `bottom-right`.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-toast-region`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description:
          "Optional children. When provided, the region wraps them so descendants\ncan call `useToast()` and read the region's context. Most apps mount\n`<ToastRegion>` as a self-closing tag at the root of their layout and\nleave this empty — but some patterns (modal-scoped regions, tests)\nbenefit from explicit child composition.",
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
