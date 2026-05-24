import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    accept: {
      type: 'string',
      description: 'Native file accept filter.',
    },
    disabled: {
      type: 'boolean',
      description: 'Disables the file picker and drag-and-drop surface.',
    },
    multiple: {
      type: 'boolean',
      description: 'Allow more than one file. Default `false`.',
    },
    name: {
      type: 'string',
      description: 'Native input name used for form submission.',
    },
    id: {
      type: 'string',
      description: 'Stable id for the native file input. Required when composing with `FormField`.',
    },
    maxSize: {
      type: 'number',
      description: 'Maximum allowed file size in bytes.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
        reason: 'unknown-shape',
      },
      {
        name: 'dragActive',
        reason: 'function-or-snippet',
      },
      {
        name: 'fileList',
        reason: 'function-or-snippet',
      },
      {
        name: 'files',
        reason: 'unknown-shape',
      },
      {
        name: 'idle',
        reason: 'function-or-snippet',
      },
      {
        name: 'onchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onreject',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
