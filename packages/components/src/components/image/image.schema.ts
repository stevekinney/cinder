import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    placeholder: {
      type: 'string',
      description:
        'Low-resolution image source (typically a base64 data URI) shown as a\npixelated background while the main image loads. Fades out once the\n`<img>` fires `load`.',
    },
    src: {
      type: 'string',
      description: 'Image source URL.',
    },
    alt: {
      type: 'string',
      description:
        'Alternative text. Required with no default — pass `alt=""` explicitly for\ndecorative images so the choice is intentional, not silent.',
    },
    width: {
      type: 'number',
      description: 'Native pixel width.',
    },
    height: {
      type: 'number',
      description: 'Native pixel height.',
    },
    ratio: {
      type: 'string',
      description:
        "CSS aspect-ratio applied to the wrapper (e.g. `'16 / 9'`) so layout is\nstable while the image loads.",
    },
    loading: {
      enum: ['lazy', 'eager'],
      description:
        'Loading strategy. Default `lazy`. Override to `eager` for above-the-fold images.',
    },
    decoding: {
      enum: ['async', 'sync', 'auto'],
      description: 'Decoding hint. Default `async`.',
    },
  },
  additionalProperties: false,
  required: ['alt', 'src'],
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
        reason: 'unknown-shape',
      },
      {
        name: 'fallback',
        reason: 'function-or-snippet',
      },
      {
        name: 'onerror',
        reason: 'function-or-snippet',
      },
      {
        name: 'onload',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
