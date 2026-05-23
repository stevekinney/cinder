import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    original: {
      type: 'string',
      description: 'The original/baseline text',
    },
    current: {
      type: 'string',
      description: 'The current/modified text',
    },
    normalizeInputs: {
      type: 'boolean',
      description:
        'Whether to normalize markdown inputs before comparison.\nWhen true (default), both original and current are normalized\nto canonical form before diffing, preventing false positives\nfrom formatting differences.',
    },
    readonly: {
      type: 'boolean',
      description: 'Whether the viewer is read-only (hides revert buttons)',
    },
    viewMode: {
      enum: ['unified', 'final', 'original'],
      description:
        'Bindable: reactive access to current view mode.\nParent components can bind to control or observe the view mode.',
    },
    class: {
      type: 'string',
      description: 'Additional CSS classes',
    },
  },
  additionalProperties: false,
  required: ['current', 'original'],
  metadata: {
    unsupportedProps: [
      {
        name: 'hunks',
        reason: 'unknown-shape',
      },
      {
        name: 'onrevertall',
        reason: 'function-or-snippet',
      },
      {
        name: 'onreverthunk',
        reason: 'function-or-snippet',
      },
      {
        name: 'toolbar',
        reason: 'function-or-snippet',
      },
      {
        name: 'toolbarActions',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
