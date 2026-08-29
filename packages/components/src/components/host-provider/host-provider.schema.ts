import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    platform: {
      enum: ['web', 'macos', 'windows', 'linux'],
      description: 'Host platform. Defaults to `web`, where desktop chrome behavior is inert.',
    },
    safeHeaderLeft: {
      type: 'string',
      description: 'Inline-start titlebar inset supplied by the desktop host. Defaults to `0px`.',
    },
    safeHeaderRight: {
      type: 'string',
      description: 'Inline-end titlebar inset supplied by the desktop host. Defaults to `0px`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Descendant application surface.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
