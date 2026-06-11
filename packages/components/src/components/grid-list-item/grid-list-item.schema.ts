import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
    },
    href: {
      type: 'string',
    },
    rel: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
        description:
          'Action buttons. This wrapper is lifted above the stretched-link overlay\nvia `position: relative; z-index: 1` so buttons remain clickable.',
      },
      {
        name: 'image',
        reason: 'function-or-snippet',
        description: 'Optional image region (avatar, thumbnail).',
      },
      {
        name: 'meta',
        reason: 'function-or-snippet',
        description: 'Tertiary metadata (badges, supplementary text).',
      },
      {
        name: 'subtitle',
        reason: 'function-or-snippet',
        description: 'Secondary description.',
      },
      {
        name: 'target',
        reason: 'unknown-shape',
        description:
          'When `target` matches `"_blank"` (case-insensitive), the component\nautomatically composes `rel="noopener noreferrer"` with any\nconsumer-supplied `rel` tokens to prevent reverse-tabnapping.',
      },
      {
        name: 'title',
        reason: 'function-or-snippet',
        description:
          'Primary label. Provides the accessible name for the stretched link when `href` is set.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
