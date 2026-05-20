import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    open: {
      type: 'boolean',
      description: 'Whether the sheet is open. Bindable via `bind:open`.',
    },
    title: {
      type: 'string',
      description:
        'Accessible name for the sheet. Required for screen-reader labelling.\nRendered as a visible `<h2>` in the default header. When a custom\n`header` snippet is provided without `ariaLabelledBy`, this text is\nrendered in a visually-hidden `<h2>` as the accessible name fallback.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-sheet`.',
    },
    triggerRef: {
      anyOf: [
        {
          type: 'object',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Optional reference to the element that opened the sheet. When supplied,\nfocus returns to this element on close. When omitted, focus restores to\nthe element that held focus before the sheet opened.',
    },
    ariaLabelledBy: {
      type: 'string',
      description:
        "Optional id of an element that names the sheet. When supplied, sheet\nwires `aria-labelledby` to this id and renders no internal heading.\nUse this when a custom `header` snippet has its own visible heading —\nsupply `ariaLabelledBy` pointing to that heading's id so the\nvisible and accessible names stay in sync.",
    },
    showDragHandle: {
      type: 'boolean',
      description:
        'When `true`, render a decorative drag handle above the header.\nSwipe-to-close gesture is a stretch goal not implemented in MVP —\nthe handle is purely a visual affordance. Default `false`.\n\nNamed `showDragHandle` (not `draggable`) to avoid colliding with the\nnative HTML `draggable` attribute on the underlying `<dialog>`.',
    },
  },
  additionalProperties: false,
  required: ['title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'footer',
        reason: 'function-or-snippet',
      },
      {
        name: 'header',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
