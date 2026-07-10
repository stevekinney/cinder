import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    status: {
      enum: ['connecting', 'live', 'reconnecting', 'polling', 'stale', 'closed'],
      description:
        'Current connection lifecycle state. Drives icon, text, and color via `data-cinder-status`.',
    },
    label: {
      type: 'string',
      description:
        'Optional human label override. Replaces the default text for `status` (and the "Connection: …" accessible name).',
    },
    class: {
      type: 'string',
      description: 'Extra classes appended to the root element.',
    },
  },
  additionalProperties: false,
  required: ['status'],
  metadata: {
    unsupportedProps: [
      {
        name: 'attempt',
        reason: 'function-or-snippet',
        description:
          'Attempt-count content rendered next to the label when `status` is `\'reconnecting\'`, e.g. "attempt 3 of 5". Ignored for other states.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
