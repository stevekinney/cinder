import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    legend: {
      type: 'string',
      description: 'Optional legend rendered as a `<legend>` inside the `<fieldset>`.',
    },
    description: {
      type: 'string',
      description: 'Helper text below the group; wired via `aria-describedby` on the fieldset.',
    },
    error: {
      type: 'string',
      description:
        'Group-level validation message. Rendered as a polite live region and\nreferenced by the fieldset\'s `aria-describedby`. Also sets\n`aria-invalid="true"` on the fieldset itself as a supplementary signal.\n\nNote: fieldset-level `aria-describedby` is not reliably re-announced as\nfocus moves between descendants. This is best-effort supplemental context\n— if a specific control must announce as invalid on focus, pass `error`\nto that `<Checkbox>` directly.',
    },
    disabled: {
      type: 'boolean',
      description:
        "Disables every native form control inside via the fieldset's built-in\ncascade. Renders as the native `disabled` attribute on `<fieldset>`.",
    },
    required: {
      type: 'boolean',
      description:
        'Marks the group as visually required. Sets `data-cinder-required` on the\nfieldset so consumers can target it (e.g. legend asterisk).\n\nThis is a visual/data-attribute hint. It does NOT set `required` on any\nchild `<input>` and does NOT enforce constraint validation. Per-control\n`required` must be set on the individual `<Checkbox>`.',
    },
    variant: {
      enum: ['default', 'card'],
      description:
        "Layout variant. `'default'` is a stacked column. `'card'` styles each\ndirect child `.cinder-checkbox-field` as a bordered card row.\n\nAlways emitted as `data-variant` on the fieldset. Card variant assumes\neach direct child of the items container is a single `<Checkbox>`.",
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-checkbox-group`.',
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
