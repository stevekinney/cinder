import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Name of the hidden serialized output field. Defaults to `value`.',
    },
    submitLabel: {
      type: 'string',
      description: 'Label for the built-in submit button. Defaults to `Submit`.',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-schema-form`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'ondraftchange',
        reason: 'function-or-snippet',
        description:
          'Called after each edit with the complete current draft, before schema validation.\nThe draft can be schema-invalid and does not change the seed-only `value` contract.',
      },
      {
        name: 'onsubmit',
        reason: 'function-or-snippet',
        description: 'Called after validation passes with the schema-conformant output value.',
      },
      {
        name: 'schema',
        reason: 'generic-type-parameter',
        required: true,
        description: 'JSON Schema object used to render and validate the form.',
      },
      {
        name: 'value',
        reason: 'unknown-shape',
        description:
          'Initial form value. Missing fields are seeded from the schema where possible.\n\n**Seed-only — value changes do not reset form state.** After mount the\nconsumer owns the form state. Changing `value` with the same `schema` does\nNOT reset the form (formValue, errors, rawDrafts). Only changing `schema`\ncauses a remount and resets form state. This is intentional: the form is an\nediting surface and resetting it on every external value change would\nsilently discard in-progress user edits.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
