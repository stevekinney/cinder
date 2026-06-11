import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Accessible name for the list (applied as aria-label on the list root).',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'announcements',
        reason: 'unknown-shape',
        description: 'Optional overrides for announcement strings.',
      },
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Row content snippet. Receives the item and a per-row context.',
      },
      {
        name: 'formatHandleLabel',
        reason: 'function-or-snippet',
        description:
          'Optional formatter for the drag handle\'s accessible name. Default: "Reorder {itemLabel}".',
      },
      {
        name: 'getItemLabel',
        reason: 'function-or-snippet',
        required: true,
        description:
          'Returns an accessible label for each item (e.g., "Buy milk").\nThe second argument is the item\'s original index in the `items` array\n(not its current visual position during a drag).\nUsed in handle aria-label and announcements.',
      },
      {
        name: 'getKey',
        reason: 'function-or-snippet',
        required: true,
        description: 'Returns a stable key for each item. Must not change across reorders.',
      },
      {
        name: 'handle',
        reason: 'function-or-snippet',
        description:
          'Optional snippet rendered inside the drag-handle button. Receives { pressed, label }.',
      },
      {
        name: 'items',
        reason: 'generic-type-parameter',
        required: true,
        description: 'The list of items to render.',
      },
      {
        name: 'onreorder',
        reason: 'function-or-snippet',
        required: true,
        description: 'Fires with the full reordered array and change metadata on drop.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
