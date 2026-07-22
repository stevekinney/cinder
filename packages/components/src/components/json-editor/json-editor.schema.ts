import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    rows: {
      type: 'number',
      description: 'Number of visible text rows. Defaults to 8.',
    },
    id: {
      type: 'string',
      description: 'Unique identifier used for the label and feedback relationships.',
    },
    value: {
      type: 'string',
      description: 'Controlled JSON source text.',
    },
    label: {
      type: 'string',
      description: 'Visible label associated with the native textarea.',
    },
    description: {
      type: 'string',
      description: 'Supporting text announced with the editor.',
    },
    error: {
      type: 'string',
      description: 'External validation error. Takes precedence over JSON parse feedback.',
    },
    showValidFeedback: {
      type: 'boolean',
      description:
        'Whether valid JSON should render an announced success message. Defaults to true.',
    },
    class: {
      type: 'string',
      description: 'Extra class names merged onto the field wrapper.',
    },
  },
  additionalProperties: false,
  required: ['id', 'label', 'value'],
  metadata: {
    unsupportedProps: [
      {
        name: 'onValueChange',
        reason: 'function-or-snippet',
        description: 'Called with the proposed JSON source whenever the user edits the textarea.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
