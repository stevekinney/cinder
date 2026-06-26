import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    rules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier for the rule.',
          },
          label: {
            type: 'string',
            description: 'Display label for the rule.',
          },
          conditions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Identifies the condition row; must be unique within its rule.',
                },
                field: {
                  type: 'string',
                  description: 'The field being tested, e.g. "path" or "label". Consumer-defined.',
                },
                operator: {
                  type: 'string',
                  description: 'The comparison operator, e.g. "matches" or "is". Consumer-defined.',
                },
                value: {
                  type: 'string',
                  description: 'The value being compared against. Consumer-defined.',
                },
              },
              additionalProperties: false,
              required: ['field', 'id', 'operator', 'value'],
            },
            description: 'Zero or more conditions (implicit AND).',
          },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Identifies the action row; must be unique within its rule.',
                },
                target: {
                  type: 'string',
                  description: 'The action target, e.g. a review-agent slug. Consumer-defined.',
                },
              },
              additionalProperties: false,
              required: ['id', 'target'],
            },
            description: 'Zero or more actions to invoke when conditions match.',
          },
        },
        additionalProperties: false,
        required: ['actions', 'conditions', 'id', 'label'],
      },
      description:
        'The current list of automation rules. Controlled — pass the updated\nlist returned from `onchange` back into this prop to commit a change.',
    },
    fieldOptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: {
            type: 'string',
            description: 'The value stored on the condition or action.',
          },
          label: {
            type: 'string',
            description: 'The human-readable label shown in the select.',
          },
        },
        additionalProperties: false,
        required: ['label', 'value'],
      },
      description:
        'Options for the condition field selector. Consumer-provided list of\nfields that a condition can test, e.g. "path", "label", "author".',
    },
    operatorOptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: {
            type: 'string',
            description: 'The value stored on the condition or action.',
          },
          label: {
            type: 'string',
            description: 'The human-readable label shown in the select.',
          },
        },
        additionalProperties: false,
        required: ['label', 'value'],
      },
      description:
        'Options for the condition operator selector. Consumer-provided list\nof operators, e.g. "matches", "is", "is-not", "contains".',
    },
    actionOptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: {
            type: 'string',
            description: 'The value stored on the condition or action.',
          },
          label: {
            type: 'string',
            description: 'The human-readable label shown in the select.',
          },
        },
        additionalProperties: false,
        required: ['label', 'value'],
      },
      description:
        'Options for the action target selector. Consumer-provided list of\ntargets, e.g. review-agent slugs or step identifiers.',
    },
    readonly: {
      const: true,
      description:
        'Must be true for schema-driven usage because editable mode requires\nthe unsupported `onchange` callback. Runtime consumers may omit this\nwhen passing `onchange` directly.',
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
  required: ['actionOptions', 'fieldOptions', 'operatorOptions', 'readonly', 'rules'],
  metadata: {
    unsupportedProps: [
      {
        name: 'onchange',
        reason: 'function-or-snippet',
        description:
          'Called whenever the user makes any edit. Required for editable runtime\nusage; readonly schema-driven usage may omit it because no edit controls\nare rendered. Receives the next rule array (pure, not mutated) and a\nchange descriptor. Consumer owns persistence, validation, and execution.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
