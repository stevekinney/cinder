import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    align: {
      enum: ['left', 'center', 'right'],
      description: 'Visual alignment for numeric columns.',
    },
    as: {
      enum: ['td', 'th'],
      description:
        'When `\'th\'`, renders a `<th scope="row">` instead of `<td>`, marking this\ncell as the row-header identifier for assistive technology. The component\nsets `scope="row"` itself (so `scope` is not part of the prop surface).\nDefaults to `\'td\'` so existing consumers are unaffected.\n\nThe attribute surface is `HTMLTdAttributes` for both modes — `<td>` and\n`<th>` share `HTMLTableCellElement`, so `colspan`, `rowspan`, `headers`, and\n`abbr` are all forwarded regardless of `as`. Only `scope` is removed from the\nprop surface, because the component owns it (`scope="row"` when `as=\'th\'`).',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-table__cell`.',
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
