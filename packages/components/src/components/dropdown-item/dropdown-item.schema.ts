import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    variant: {
      enum: ['default', 'danger'],
    },
    inset: {
      type: 'boolean',
    },
    closeOnSelect: {
      type: 'boolean',
    },
    class: {
      type: 'string',
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
      description: 'Button type forwarded to the `<button>` element. Defaults to `"button"`.',
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
