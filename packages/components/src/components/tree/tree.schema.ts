import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    selectionMode: {
      enum: ['none', 'single', 'multiple'],
      description: "Selection model. Default: 'none'.",
    },
    checkboxSelection: {
      type: 'boolean',
      description:
        'Render tree-owned checkbox indicators when selectionMode is multiple. Default: false.',
    },
    selectionBehavior: {
      enum: ['independent', 'cascade'],
      description:
        "Select only the target item or cascade through its selectable scope. Default: 'independent'.",
    },
    selectedIds: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Currently selected node ids. Bindable.',
    },
    expandedIds: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Currently expanded branch ids. Bindable.',
    },
    virtualizationEstimatedRowHeight: {
      type: 'number',
      description: 'Estimated row height for virtualized Tree rows. Default: 36.',
    },
    virtualizationOverscan: {
      type: 'number',
      description: 'Extra rows rendered before and after the viewport. Default: 4.',
    },
    virtualizationHeight: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'number',
        },
      ],
      description: "Block size for the virtualized scroll viewport. Default: '20rem'.",
    },
    'aria-label': {
      type: 'string',
      description:
        'Accessible label for the tree. One of aria-label or aria-labelledby is required.',
    },
    'aria-labelledby': {
      type: 'string',
      description:
        'The `id` of a visible element whose text serves as the accessible label for the tree. One of `aria-label` or `aria-labelledby` is required.',
    },
    disableTypeahead: {
      type: 'boolean',
      description: 'Disable typeahead. Default: false.',
    },
    filterValue: {
      type: 'string',
      description: 'Controlled filter query. When provided, matching is driven by this value.',
    },
    filterPlaceholder: {
      type: 'string',
      description:
        "Placeholder and accessible label for the built-in search input. Default: 'Search tree'.",
    },
    showSearch: {
      type: 'boolean',
      description:
        'Render the built-in search input before the role="tree" element. Default: false.',
    },
    class: {
      type: 'string',
      description: 'Additional CSS class merged with `.cinder-tree`.',
    },
    virtualized: {
      type: 'boolean',
      description: 'Use the data-driven virtualized render path for large trees. Default: false.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description:
          'Tree items (snippet). Required when virtualized is false or omitted; mutually exclusive with items.',
      },
      {
        name: 'filterPredicate',
        reason: 'function-or-snippet',
        description: 'Custom filter predicate. Default: case-insensitive label substring matching.',
      },
      {
        name: 'items',
        reason: 'unknown-shape',
        description:
          'Data-driven Tree items. Required when virtualized is true; mutually exclusive with children.',
      },
      {
        name: 'onFilterChange',
        reason: 'function-or-snippet',
        description: 'Fires whenever the built-in search input changes the filter query.',
      },
      {
        name: 'onReorder',
        reason: 'function-or-snippet',
        description:
          'Called when a draggable item is dropped before, after, or into another tree item.',
      },
      {
        name: 'ref',
        reason: 'unknown-shape',
        description: 'Typed programmatic handle. Use `bind:ref` to receive it.',
      },
      {
        name: 'selectionControls',
        reason: 'function-or-snippet',
        description: 'Optional selection controls rendered before the role="tree" element.',
      },
      {
        name: 'virtualizedItem',
        reason: 'function-or-snippet',
        description: 'Optional custom virtualized row renderer.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
