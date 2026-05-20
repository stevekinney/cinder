import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Visible label rendered in a `<label>` element associated via `for`.',
    },
    description: {
      type: 'string',
      description: 'Helper text displayed below the textarea; wired via `aria-describedby`.',
    },
    error: {
      type: 'string',
      description: 'Validation error message; sets `aria-invalid="true"` and `aria-describedby`.',
    },
    showCount: {
      type: 'boolean',
      description:
        'When `true` AND `maxlength` is set, renders a live character counter\n(`{value.length}/{maxlength}`) below the textarea. The counter element\nis wired into `aria-describedby` so screen readers announce it as part\nof the field\'s description, and it is also placed inside an\n`aria-live="polite"` region so updates are announced as the user types.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
