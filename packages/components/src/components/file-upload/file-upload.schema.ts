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
    title: {
      type: 'string',
      description: 'Visible title for the dropzone. Default `Click to upload or drop files`.',
    },
    maxSize: {
      type: 'number',
      description: 'Maximum allowed file size in bytes.',
    },
    maxFiles: {
      type: 'number',
      description: 'Maximum number of files allowed. Files beyond this limit are rejected.',
    },
    class: {
      type: 'string',
      description: 'Additional classes merged with `.cinder-file-upload`.',
    },
    description: {
      type: 'string',
      description:
        'Visible description below the title. Defaults to a summary derived from `accept`.',
    },
    draggingLabel: {
      type: 'string',
      description:
        'Visible label shown while files are dragged over the dropzone. Default `Drop to add`.',
    },
    browseLabel: {
      type: 'string',
      description: 'Visible text for the browse button. Default `Browse files`.',
    },
    borderBeamVisible: {
      type: 'boolean',
      description: 'Adds focus and drag-active border emphasis to the dropzone. Default `true`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'dragActive',
        reason: 'function-or-snippet',
        description: 'Replaces the default drag-active dropzone body.',
      },
      {
        name: 'fileList',
        reason: 'function-or-snippet',
        description: 'Replaces the default file-list renderer. Receives the resolved rows.',
      },
      {
        name: 'files',
        reason: 'unknown-shape',
        description: 'Consumer-driven file rows, including upload progress and error states.',
      },
      {
        name: 'idle',
        reason: 'function-or-snippet',
        description: 'Replaces the default resting-state dropzone body.',
      },
      {
        name: 'onFilesAccepted',
        reason: 'function-or-snippet',
        description: 'Fires with accepted files after local validation passes.',
      },
      {
        name: 'onFilesChange',
        reason: 'function-or-snippet',
        description: 'Fires with the full resolved entry list after local validation changes it.',
      },
      {
        name: 'onReject',
        reason: 'function-or-snippet',
        description: 'Fires with rejected files and reasons after local validation runs.',
      },
      {
        name: 'onRetry',
        reason: 'function-or-snippet',
        description: 'Called when the retry button is activated for a failed file.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
