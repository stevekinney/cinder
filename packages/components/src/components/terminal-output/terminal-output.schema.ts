import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'string',
      description:
        "ANSI output text. Supports SGR 16-color foregrounds, bold/reset,\ncarriage-return rewrites, and erase-line sequences. Defaults to `''`.",
      default: '',
    },
    followLatest: {
      type: 'boolean',
      description:
        'Keeps the viewport anchored to the latest line while appending.\nBindable, but this component has no persistent host-controlled mode,\nbound or not: its own scroll handler always reassigns this (as local\ncomponent state, independent of whether a parent binds it) to `true`\nthe moment the user scrolls back to the bottom, which resumes\nautomatic scrolling on the next append. Setting `false` only affects\nthe initial or current value—there is currently no way for a host to\ndurably keep this component from following once the user reaches the\nbottom again. Defaults to `true`.',
      default: true,
    },
    class: {
      type: 'string',
      description: "Additional class merged with the component's root class.",
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description:
          'Rendered in place of the ANSI output when `value` is empty, e.g. an empty state.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
