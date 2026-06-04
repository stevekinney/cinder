import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    active: {
      type: 'boolean',
    },
    disabled: {
      type: 'boolean',
    },
    current: {
      enum: ['true', 'page', 'step', 'location', 'date', 'time'],
      description:
        "The `aria-current` token emitted while `active` is true. Defaults to `'page'`,\nwhich is correct for navigation bars and breadcrumb-adjacent links. Use\n`'true'` (or another standard token such as `'step'` / `'location'`) for\nsection/view switchers, where `'page'` would mislabel the current section as\nthe current page in the browsing context.",
    },
    class: {
      type: 'string',
    },
    variant: {
      enum: ['horizontal', 'vertical', 'mobile'],
      description:
        "Controls item geometry. Emitted as `data-variant`. Default `'horizontal'`.\n\n- `'horizontal'`: top-rounded radius, accent bottom-border active indicator.\n  Used inside `NavigationBar` and similar horizontal tab-bar contexts.\n- `'mobile'`: stacked full-width layout when an owning navigation surface\n  enters its narrow container mode.\n- `'vertical'`: square row geometry, neutral selected surface, and accent inline-start border active indicator.\n  Used inside `SideNavigation` (set automatically by `SideNavigationItem`) or\n  standalone sidebar footers where flush sidebar edges are required.",
    },
    href: {
      type: 'string',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'onclick',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
