import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Inner `<input>` id. Required (mirrors Input).',
    },
    value: {
      type: 'string',
      description:
        'Controlled value. One-way: parent sets, child reads via `onchange`.\nNot `$bindable` — use `onchange` to observe changes.',
    },
    defaultValue: {
      type: 'string',
      description: 'Initial value when uncontrolled. Accepts any allowed `formats` input.',
    },
    alpha: {
      type: 'boolean',
      description:
        'Accept and emit alpha when the parsed alpha is partial. When `false`\n(default), inputs with alpha (`#RRGGBBAA`, `rgba(...)`, `hsla(...)`) are\nstill accepted but the alpha channel is stripped on emit.',
    },
    formats: {
      type: 'array',
      items: {
        enum: ['hex', 'rgb', 'hsl'],
      },
      description:
        'Accepted *input* formats. Defaults to all three. Output is always hex.\nModern slash-alpha syntax (e.g. `rgb(255 0 0 / 50%)`) is unsupported.',
    },
    disabled: {
      type: 'boolean',
      description: 'Disable the field.',
    },
    name: {
      type: 'string',
      description:
        'Form field name. When set, a hidden sibling `<input>` mirrors the current\ncommitted hex value for native form submission.',
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
        "Behavior when the user presses Enter in the field:\n- `'commit-then-submit'` (default): commit the value, then allow the\n  form's native submission to proceed (`requestSubmit()`).\n- `'commit-only'`: commit and `preventDefault()` the submission. Useful\n  in dialogs / multi-field flows where Enter must not submit the form.",
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
