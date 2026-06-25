import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    variant: {
      enum: ['default', 'danger'],
      description:
        'Visual style of the item. Use `danger` to signal a destructive action. Default `default`.',
    },
    itemRole: {
      enum: ['menuitem', 'menuitemradio'],
      description:
        'ARIA role for the row. Use `menuitemradio` for mutually exclusive menu selections.',
    },
    checked: {
      type: 'boolean',
      description: 'Checked state for `itemRole="menuitemradio"`. Omitted for normal menu items.',
    },
    inset: {
      type: 'boolean',
      description:
        'When true, adds leading padding to align the item with items that have a leading icon or indicator. Default `false`.',
    },
    closeOnSelect: {
      type: 'boolean',
      description:
        'When true, the parent dropdown closes after this item is activated. Default `true`.',
    },
    class: {
      type: 'string',
      description: "Additional class names merged with the component's root class.",
    },
    disabled: {
      type: 'boolean',
      description: 'When true the item is inert: click is blocked and aria-disabled is set.',
    },
    href: {
      type: 'string',
      description:
        'Destination URL. Any defined value — including an empty string — selects\nthe anchor branch and renders an `<a>`. Omit `href` entirely to render a\n`<button>`.',
    },
    type: {
      enum: ['button', 'submit', 'reset'],
      description:
        'Button type forwarded to the `<button>` element. Defaults to `"button"`.\n\nNOTE: `type="submit"` only submits a surrounding `<form>` when the menu\nstays inside that form\'s DOM subtree. DropdownMenu portals its panel to\n`document.body` on the non-popover fallback path, so a submit item is then\nNOT a form descendant and native submission is skipped. To submit a form\nfrom a portaled menu, set `form="<form-id>"` to associate the button with\nthe form by id, or handle submission in `onclick`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
