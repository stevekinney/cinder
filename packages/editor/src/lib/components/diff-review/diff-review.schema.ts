import type { ComponentSchema } from '../../schema-types.ts';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    readonly: {
      type: 'boolean',
      description:
        'Disables every mutating control (comments, drafts, Reviewed, review\nnote). Navigation, filtering, and export remain available.',
    },
    reviewTitle: {
      type: 'string',
      description: 'Markdown export heading.',
    },
    class: {
      type: 'string',
      description: 'Additional CSS classes',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'targets',
        reason: 'unknown-shape',
        required: true,
        description:
          'The live content for every target in `state`, in the same shape\n`createDiffReviewState`/the `set-targets` action take.',
      },
      {
        name: 'state',
        reason: 'unknown-shape',
        required: true,
        description: 'Controlled diff-review session state. Never mutated directly.',
      },
      {
        name: 'onStateChange',
        reason: 'function-or-snippet',
        required: true,
        description: 'Called whenever an action succeeds.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
