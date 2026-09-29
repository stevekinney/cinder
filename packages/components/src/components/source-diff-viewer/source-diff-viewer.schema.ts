import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    patch: {
      type: 'string',
      description: 'Unified patch text to parse and render.',
    },
    ariaLabel: {
      type: 'string',
      description: 'Accessible label for the diff region.',
    },
    maxLines: {
      type: 'integer',
      description: 'Maximum number of diff rows to render before truncating.',
      minimum: 0,
      default: 1000,
    },
    lineNumbers: {
      type: 'boolean',
      description: 'Whether old and new line-number gutters are rendered.',
      default: true,
    },
    class: {
      type: 'string',
      description: 'Additional CSS classes merged with `.cinder-source-diff-viewer`.',
    },
    activeFileOccurrence: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Controlled zero-based file occurrence to render exclusively. Absent\n(the default) renders every file, matching prior behavior.',
    },
  },
  additionalProperties: false,
  required: ['patch'],
  metadata: {
    unsupportedProps: [
      {
        name: 'annotationSelection',
        reason: 'unknown-shape',
        description:
          'Controlled current annotation selection. Distinct from ordinary diff\nnavigation: setting or clearing it never affects which rows are shown.',
      },
      {
        name: 'empty',
        reason: 'function-or-snippet',
        description:
          'Rendered when the patch is empty or contains no displayable diff rows.\nFalls back to a default "No patch lines to display." message — matching\nthe `empty` snippet the chart/command families expose.',
      },
      {
        name: 'fileAnnotation',
        reason: 'function-or-snippet',
        description:
          "Rendered next to each file's header, alongside its file-level annotation controls.",
      },
      {
        name: 'lineAnnotation',
        reason: 'function-or-snippet',
        description:
          "Rendered next to each commentable row's add-comment control. Like that\ncontrol, it only appears when `onAnnotationSelectionChange` is also\nsupplied — pass both to render per-line annotation markers.",
      },
      {
        name: 'onAnnotationSelectionChange',
        reason: 'function-or-snippet',
        description:
          "Called when the user commits, extends, or clears an annotation\nselection. See `onFilesChange` above for why this repository spells the\ncontract's `onannotationselectionchange` as camelCase.",
      },
      {
        name: 'onFilesChange',
        reason: 'function-or-snippet',
        description:
          "Called with a descriptor for every recognized file whenever the parsed\npatch changes. Named `onFilesChange` (camelCase) rather than the\nlowercase `onfileschange` the cross-package diff-review contract uses\nelsewhere: this repository's `check-prop-conventions` gate structurally\nbans a non-native-passthrough lowercase `on*` prop, so the callback\ncasing is translated to this repository's house style while every field\nname and the payload shape stay exactly as specified.",
      },
      {
        name: 'ref',
        reason: 'unknown-shape',
        description: 'Programmatic handle for `focusFile`/`focusAnchor`.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
