import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    itemHeight: {
      type: 'number',
      description:
        'Fixed row height in pixels. Variable and measured row heights are out of\nscope for v1; pass the known or estimated fixed height for every row.',
    },
    overscan: {
      type: 'number',
      description: 'Extra rows rendered before and after the visible window.\nDefaults to 5.',
    },
    height: {
      type: 'string',
      description: 'CSS block-size for the native scroll container.\nDefaults to `"20rem"`.',
    },
    stickToBottom: {
      type: 'boolean',
      description:
        'When true, appending items while the viewport is already at the bottom\nkeeps the newest item pinned in view. Appending while scrolled up leaves the\nscroll position unchanged.',
    },
    tabindex: {
      type: 'number',
      description:
        'Override the default focus behavior. The component sets `tabindex="0"`\nby default so keyboard users can reach the native scroll container for\narrow-key scrolling. Pass `tabindex={-1}` when the viewport should be\nprogrammatically focusable without entering the tab order.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-virtual-list`.',
    },
  },
  additionalProperties: false,
  required: ['itemHeight'],
  metadata: {
    unsupportedProps: [
      {
        name: 'getKey',
        reason: 'function-or-snippet',
        description:
          'Stable key extractor. Omit only when items are append-only and never\nreordered; the component will fall back to full-array indexes.',
      },
      {
        name: 'items',
        reason: 'generic-type-parameter',
        required: true,
        description: 'Items in full logical order. Only the visible window is mounted.',
      },
      {
        name: 'row',
        reason: 'function-or-snippet',
        required: true,
        description: 'Rendered row snippet. Receives the item and its virtual row context.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
