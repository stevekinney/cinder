import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    itemHeight: {
      type: 'number',
      description:
        "Each item's extent in pixels along the axis being scrolled: its height by\ndefault, or its width under `horizontal`. By default every row is assumed to\nbe exactly this size. When `dynamicSize` is true this becomes the initial\nestimate for rows that have not been measured yet.",
    },
    dynamicSize: {
      type: 'boolean',
      description:
        'Measure each rendered row with `ResizeObserver` and cache the result,\ninstead of assuming every row is exactly `itemHeight` along the scrolled\naxis. Use this when rows wrap, contain images, or otherwise vary in size.\nComposes with `horizontal`, where each row is measured by its width.\n\nDefaults to `false`. While false, no row is measured, no size is cached,\nand no scroll correction runs — the fixed-height path stays the fast path.\nThe component still observes its own scroll container to track viewport\nsize, as it always has; that is independent of this prop.',
    },
    horizontal: {
      type: 'boolean',
      description:
        "Scrolls and lays rows out along the inline axis instead of the block axis.\n\n`itemHeight` and `height` are REINTERPRETED rather than renamed: `itemHeight`\nbecomes each item's width in pixels along the main axis, and `height` becomes\nthe container's inline-size. The `--cinder-virtual-list-height` custom property\nkeeps its name too and switches to driving `inline-size`, so an existing theme\noverride keeps working when this is turned on.\n\nRight-to-left is handled: the writing direction is resolved from the container's\ncomputed style at mount, and the scroll offset is read from the start (right)\nedge in that case.\n\nDefaults to false.",
    },
    overscan: {
      type: 'number',
      description: 'Extra rows rendered before and after the visible window.\nDefaults to 5.',
    },
    height: {
      type: 'string',
      description:
        'CSS extent of the native scroll container across the axis it scrolls: its\nblock-size by default, or its inline-size under `horizontal`.\nDefaults to `"20rem"`.',
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
          'Stable key extractor. Omit only when items are append-only and never\nreordered; the component will fall back to full-array indexes.\n\nRequired in practice under `dynamicSize`: measured sizes are cached by key,\nso index-derived keys will mis-attribute cached sizes if items ever reorder.',
      },
      {
        name: 'items',
        reason: 'generic-type-parameter',
        required: true,
        description: 'Items in full logical order. Only the visible window is mounted.',
      },
      {
        name: 'ref',
        reason: 'unknown-shape',
        description: 'Typed programmatic handle. Use `bind:ref` to receive it.',
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
