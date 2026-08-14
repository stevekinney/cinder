import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    active: {
      type: 'boolean',
      description:
        'When true (default), Tab key navigation is constrained within the trap container. Set to false to temporarily suspend trapping without unmounting.',
    },
    restoreFocus: {
      type: 'boolean',
      description:
        'When true (default), returns focus to the previously focused element when the trap is deactivated or unmounted.',
    },
    initialFocus: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'CSS selector for the element that should receive focus when the trap activates. Falls back to `fallbackFocus` when the selector matches nothing.',
    },
    fallbackFocus: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'CSS selector for the element that receives focus when `initialFocus` is unset or unresolvable. Defaults to the trap container itself.',
    },
    restoreFallback: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'CSS selector, resolved against the document, for the element that receives focus when the previously focused element cannot take it back — typically because it was removed from the DOM while the trap was open. Without it, focus falls to `<body>`.',
    },
    preferRestoreFallback: {
      type: 'boolean',
      description:
        'When true, `restoreFallback` is tried before the previously focused element rather than only after it. For hosts that know the captured element is about to be removed but cannot prove it yet, such as a delete that awaits a server round trip.',
    },
    class: {
      type: 'string',
      description: 'Additional class applied to the focus-trap wrapper element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
