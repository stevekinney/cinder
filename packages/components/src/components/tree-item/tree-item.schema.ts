import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Stable unique id within the tree.',
    },
    label: {
      type: 'string',
      description: 'Accessible name for the item. Also used as the typeahead key.',
    },
    disabled: {
      type: 'boolean',
      description: 'When true, the item cannot be selected or actioned. Still keyboard-reachable.',
    },
    draggable: {
      type: 'boolean',
      description: 'Render a reorder handle when the parent Tree provides onReorder.',
    },
    branch: {
      type: 'boolean',
      description:
        'Marks the node as an expandable branch. A node is a leaf unless it sets `branch`\nor `loadChildren`; supplying a `children` snippet alone is not enough. Marking the\nnode as a branch lets the tree render the correct expand affordance and\n`aria-expanded` state before any children exist (for example, before an async\n`loadChildren` resolves).',
    },
    selectionScopeIds: {
      type: 'array',
      items: {
        type: 'string',
      },
      description:
        'Explicit selectable ids controlled by this item in cascade checkbox-selection mode.',
    },
    class: {
      type: 'string',
      description: 'Additional CSS class merged with `.cinder-tree-item`.',
    },
  },
  additionalProperties: false,
  required: ['id', 'label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Nested TreeItem children for branch nodes.',
      },
      {
        name: 'loadChildren',
        reason: 'function-or-snippet',
        description:
          'Async loader called the first time the item is expanded. Implies `branch=true`.\nThe loader mutates consumer-owned reactive state; it returns no data.\nErrors are forwarded to `onLoadError` if provided, otherwise logged via\n`console.error` with a `[cinder-tree]` prefix.',
      },
      {
        name: 'onLoadError',
        reason: 'function-or-snippet',
        description: 'Called when `loadChildren` rejects with a non-abort error.',
      },
      {
        name: 'onRename',
        reason: 'function-or-snippet',
        description: 'Called when inline label editing commits a new label.',
      },
      {
        name: 'row',
        reason: 'function-or-snippet',
        description: 'Optional row content snippet override. Default renders `label`.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
