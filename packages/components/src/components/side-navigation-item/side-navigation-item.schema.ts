import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
    },
    href: {
      type: 'string',
    },
    disabled: {
      type: 'boolean',
    },
    active: {
      type: 'boolean',
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
