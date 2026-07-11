import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    'aria-label': {
      type: 'string',
      description: 'Defines a string value that labels the current element.',
    },
    searchQuery: {
      type: 'string',
      description: 'Current text search query. When provided, the search field is controlled.',
    },
    showSearch: {
      type: 'boolean',
      description: 'Whether to render the leading search field. Defaults to `true`.',
    },
    searchPlaceholder: {
      type: 'string',
      description: 'Placeholder text shown in the leading search field.',
    },
    searchAriaLabel: {
      type: 'string',
      description: "Accessible label for the search input. Defaults to 'Search'.",
    },
    disabled: {
      type: 'boolean',
      description: 'When true, all filter controls and chips are disabled.',
    },
    class: {
      type: 'string',
      description: 'Additional CSS classes applied to the root element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'appliedFilters',
        reason: 'unknown-shape',
        description:
          'Applied filters displayed as removable chips below the controls row.\nControlled by the consumer; each entry is a key/value/label triple.',
      },
      {
        name: 'facets',
        reason: 'unknown-shape',
        description:
          'Facet definitions rendered as filter controls after the search field.\nEach entry is either a select-type facet or a custom snippet-driven facet.',
      },
      {
        name: 'onclearall',
        reason: 'function-or-snippet',
        description: 'Fires when the clear-all button is clicked.',
      },
      {
        name: 'onfacetchange',
        reason: 'function-or-snippet',
        description: 'Fires when a facet value changes, with the facet key and new value.',
      },
      {
        name: 'onfilterremove',
        reason: 'function-or-snippet',
        description: 'Fires when a specific applied filter chip is removed.',
      },
      {
        name: 'onsearchchange',
        reason: 'function-or-snippet',
        description: 'Fires when the search query changes.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
