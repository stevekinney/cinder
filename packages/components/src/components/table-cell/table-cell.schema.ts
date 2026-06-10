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
        "When `'th'`, renders a `<th scope=\"row\">` instead of `<td>`, marking this\ncell as the row-header identifier for assistive technology. All existing\nCSS classes and attribute forwarding are preserved — this is purely a tag\nand scope change. Defaults to `'td'` so existing consumers are unaffected.",
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
