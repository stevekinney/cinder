import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    status: {
      enum: ['online', 'offline', 'warning', 'danger', 'pending', 'neutral', 'success', 'accent'],
      description:
        'Semantic status. Drives color via `data-cinder-status`; defaults to a neutral dot or derives from `connectionState`. `success` maps to `--cinder-success`; `accent` maps to `--cinder-accent`.',
    },
    connectionState: {
      enum: ['connected', 'connecting', 'disconnected', 'error'],
      description:
        'Realtime connection preset. Sets status, default label, and live-region semantics.',
    },
    label: {
      type: 'string',
      description:
        'Optional human label. Rendered visibly when `showLabel` is true; used as the accessible name either way.',
    },
    showLabel: {
      type: 'boolean',
      description: 'Whether to render the visible label.',
      default: true,
    },
    live: {
      type: 'boolean',
      description:
        'Use role="status" with polite live-region attributes. Defaults true when connectionState is provided.',
    },
    size: {
      enum: ['sm', 'md'],
      description: 'Dot size.',
      default: 'md',
    },
    class: {
      type: 'string',
      description: 'Extra classes appended to the root element.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
