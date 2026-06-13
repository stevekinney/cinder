import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    readonly: {
      type: 'boolean',
      description:
        'When true, renders a readonly summary of each rule instead of editable\ncontrols. Default is false (editable mode).',
    },
    addRuleLabel: {
      type: 'string',
      description: 'Label for the "Add rule" button. Defaults to "Add rule".',
    },
    addConditionLabel: {
      type: 'string',
      description: 'Label for the "Add condition" button. Defaults to "Add condition".',
    },
    addActionLabel: {
      type: 'string',
      description: 'Label for the "Add action" button. Defaults to "Add action".',
    },
    label: {
      type: 'string',
      description: 'Accessible label for the entire rule builder region.',
    },
    class: {
      type: 'string',
      description: 'Additional CSS classes applied to the root element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'actionOptions',
        reason: 'unknown-shape',
        required: true,
        description:
          'Options for the action target selector. Consumer-provided list of\ntargets, e.g. review-agent slugs or step identifiers.',
      },
      {
        name: 'fieldOptions',
        reason: 'unknown-shape',
        required: true,
        description:
          'Options for the condition field selector. Consumer-provided list of\nfields that a condition can test, e.g. "path", "label", "author".',
      },
      {
        name: 'onchange',
        reason: 'function-or-snippet',
        required: true,
        description:
          'Called whenever the user makes any edit. Receives the next rule\narray (pure, not mutated) and a change descriptor. Consumer owns\npersistence, validation, and execution.',
      },
      {
        name: 'operatorOptions',
        reason: 'unknown-shape',
        required: true,
        description:
          'Options for the condition operator selector. Consumer-provided list\nof operators, e.g. "matches", "is", "is-not", "contains".',
      },
      {
        name: 'rules',
        reason: 'unknown-shape',
        required: true,
        description:
          'The current list of automation rules. Controlled — pass the updated\nlist returned from `onchange` back into this prop to commit a change.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
