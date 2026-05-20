import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    disabled: {
      type: 'boolean',
      description: 'Disables the input and the clear button.',
    },
    name: {
      type: 'string',
      description: '`name` attribute for form submission.',
    },
    placeholder: {
      type: 'string',
      description: 'Placeholder text.',
    },
    readonly: {
      type: 'boolean',
      description: 'Marks the input as read-only; the clear button becomes inert.',
    },
    id: {
      type: 'string',
      description: 'Stable id for the input element. Required when composing with `FormField`.',
    },
    value: {
      type: 'string',
      description: 'Controlled value. When provided, the field is fully controlled by the parent.',
    },
    defaultValue: {
      type: 'string',
      description: 'Initial value for uncontrolled usage. Ignored when `value` is provided.',
    },
    shortcut: {
      type: 'string',
      description:
        'Optional keyboard shortcut hint (e.g. `\'⌘K\'`). Rendered as a trailing\n`<kbd aria-hidden="true">` badge. The shortcut itself is not wired by\nthis component.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
        reason: 'unknown-shape',
      },
      {
        name: 'onclear',
        reason: 'function-or-snippet',
      },
      {
        name: 'oninput',
        reason: 'function-or-snippet',
      },
      {
        name: 'onsearch',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
