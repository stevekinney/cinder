import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
      description: 'Additional class merged onto the `.cinder-navigation-item` root element.',
    },
    href: {
      type: 'string',
      description:
        'Destination URL. Providing this prop renders the item as an `<a>` element instead of a `<button>`.',
    },
    disabled: {
      type: 'boolean',
      description:
        'Prevents interaction: removes the item from the tab order, blocks clicks, and applies disabled visual styling.',
    },
    active: {
      type: 'boolean',
      description:
        'Marks this item as the currently active destination; emits `aria-current` and applies active visual styling.',
    },
    current: {
      enum: ['true', 'page', 'step', 'location', 'date', 'time'],
      description:
        "The `aria-current` token emitted while `active` is true. Defaults to `'page'`,\nwhich is correct for navigation bars and breadcrumb-adjacent links. Use\n`'true'` (or another standard token such as `'step'` / `'location'`) for\nsection/view switchers, where `'page'` would mislabel the current section as\nthe current page in the browsing context.",
    },
    listItemClass: {
      type: 'string',
      description: 'Class merged onto the outer <li>.',
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
      {
        name: 'onclick',
        reason: 'function-or-snippet',
        description:
          'Optional click handler called for the rendered `<a>` element. Useful for\nintercepting plain left-clicks for SPA navigation while letting modified\nclicks (cmd/ctrl/shift/alt or middle-click) fall through to native browser\nbehavior. Disabled-state preventDefault still applies.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
