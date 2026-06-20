import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description:
        'Visible group caption. Rendered as a `<legend>` inside the `<fieldset>`.\nNamed `label` for consistency with every other form control — the element\nis a `<legend>` because the group is a fieldset.',
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
        'Marks the group required: sets `aria-required="true"` and\n`data-cinder-required` on the fieldset and renders the required asterisk in\nthe legend.\n\nIt does NOT set `required` on any child `<input>` and does NOT enforce\nnative constraint validation. Per-control `required` must be set on the\nindividual `<Checkbox>`.',
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
        required: true,
        description: 'Checkbox children.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
