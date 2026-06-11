import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    density: {
      enum: ['comfortable', 'condensed'],
      description:
        'List-level density inherited by StackedListItem rows that do not set their\nown `density` prop. Omit to let each row use its own default. A per-row\n`density` always overrides this list-level value.\n\nNote: when passing a variable that may be `undefined`, spread conditionally\nbecause `exactOptionalPropertyTypes` is enabled:\n`{...(density ? { density } : {})}`',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description:
          'Row renderer. MUST render an `<li>` (the list root is a `<ul role="list">`).\nStackedListItem is the recommended row — it renders an `<li>` with\nleading/title/description/meta/trailing slots.',
      },
      {
        name: 'empty',
        reason: 'function-or-snippet',
        description:
          'Rendered when `items` is empty. The component automatically wraps the\nsnippet output in `<li class="cinder-data-list-empty">`.\n\n**Do NOT wrap in an `<li>` yourself** — the component provides the `<li>`\nwrapper automatically. Pass only inner content (e.g. a `<p>`, a `<div>`,\nor plain text). Contrast with `children`, which must render an `<li>`.',
      },
      {
        name: 'items',
        reason: 'generic-type-parameter',
        required: true,
        description: 'The records to render. Each is passed to `children`.',
      },
      {
        name: 'key',
        reason: 'function-or-snippet',
        description:
          'Key extractor for efficient DOM updates. Svelte uses this to identify each\nrow when the list is reordered, filtered, or updated — without it, rows are\nmatched by index and the wrong row instances may receive updated props.\n\nStrongly recommended for any list that can change after initial render:\n\n```svelte\n<DataList {items} key={(m) => m.id}>\n```\n\nOmit only for truly static, never-reordered lists (e.g. a fixed reference\nlist). When omitted, Svelte falls back to index-based reconciliation.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
