import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Stable id applied to the inner `<input>`. Required (mirrors `Input`).',
    },
    value: {
      type: 'string',
      description:
        'Controlled value. One-way: parent passes, child reads. NOT `$bindable`;\npair with `onchange`. Reading the value yields a canonical hex string\n(`#rrggbb`, or `#rrggbbaa` when `alpha={true}` and `a < 1`).',
    },
    defaultValue: {
      type: 'string',
      description: 'Initial value when uncontrolled. Accepts any of the allowed `formats`.',
    },
    alpha: {
      type: 'boolean',
      description:
        'Accept and emit alpha when partial. When `false` (default), `#rrggbbaa`\nis accepted on input but the alpha byte is stripped on emit.',
    },
    formats: {
      type: 'array',
      items: {
        enum: ['hex', 'rgb', 'hsl'],
      },
      description:
        "Accepted *input* formats. Defaults to `['hex', 'rgb', 'hsl']`. Output is\nalways hex.",
    },
    disabled: {
      type: 'boolean',
      description: 'Disable the input.',
    },
    name: {
      type: 'string',
      description:
        'Form field name. When set, a hidden sibling `<input>` mirrors the current\ncommitted canonical hex for form submission. The hidden input renders an\nempty value while a parse error is active so external submits do not send\na stale prior value.',
    },
    placeholder: {
      type: 'string',
      description: 'Placeholder text for the inner `<input>`.',
    },
    class: {
      type: 'string',
      description: 'Additional classes merged onto the outer wrapper (`.cinder-color-field`).',
    },
    errorMessage: {
      type: 'string',
      description: 'Override the default parse-failure error message.',
    },
    enterBehavior: {
      enum: ['commit-then-submit', 'commit-only'],
      description:
        "Commit-on-Enter behavior. Default `'commit-then-submit'`:\n- `'commit-then-submit'`: Enter commits, then calls `requestSubmit` on\n  the associated form for any non-failure outcome.\n- `'commit-only'`: Enter commits but never submits, regardless of outcome.",
    },
  },
  additionalProperties: false,
  required: ['id'],
  metadata: {
    unsupportedProps: [
      {
        name: 'onchange',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
