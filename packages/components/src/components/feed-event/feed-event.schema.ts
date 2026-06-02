import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
    },
    datetime: {
      type: 'string',
      description:
        'ISO 8601 datetime string. Rendered as `<time datetime={datetime}>` so\nassistive tech and parsers receive a machine-readable timestamp. This is\nalways the authoritative value; the visible label is separate (see\n`timestamp` / `timestampLabel`).',
    },
    timestamp: {
      type: 'string',
      description:
        'Visible time label, as plain text — the common case (`"2m ago"`,\n`"May 12, 3:30 PM"`). Rendered inside the `<time>` element. Optional: when\nomitted (and no `timestampLabel` is given) the component falls back to the\nraw `datetime` string, which is deterministic and SSR-safe (no locale or\ntimezone dependence).',
    },
    variant: {
      enum: ['icon', 'minimal'],
      description: 'Icon variant: renders a circular badge on the rail with the icon inside.',
    },
  },
  additionalProperties: false,
  required: ['datetime'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'icon',
        reason: 'function-or-snippet',
      },
      {
        name: 'timestampLabel',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
