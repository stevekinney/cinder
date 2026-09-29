import type { ComponentSchema } from '../../schema-types.ts';

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
        name: 'annotationSelection',
        reason: 'unknown-shape',
        description:
          'Controlled current annotation selection. Distinct from ordinary diff\nnavigation and view-mode state: setting or clearing it never affects\nwhich lines are shown.',
      },
      {
        name: 'fileAnnotation',
        reason: 'function-or-snippet',
        description:
          'Rendered once alongside the front-matter section, whenever the document\nhas front matter. Front matter offers file-level comments only (its\nchanges aren’t cleanly attributable to one selectable line), so this\nsnippet receives the changed field names as context rather than a line\nanchor. Unlike `lineAnnotation`, it renders regardless of whether\n`onAnnotationSelectionChange` is supplied.',
      },
      {
        name: 'hunks',
        reason: 'unknown-shape',
        description:
          'Bindable: reactive access to computed hunks.\nParent components can bind to this to reactively access hunk data.',
      },
      {
        name: 'lineAnnotation',
        reason: 'function-or-snippet',
        description:
          'Rendered next to each commentable row’s add-comment control. Like that\ncontrol, it only appears when `onAnnotationSelectionChange` is also\nsupplied -- pass both to render per-line annotation markers.',
      },
      {
        name: 'onAnnotationSelectionChange',
        reason: 'function-or-snippet',
        description: 'Called when the user commits, extends, or clears an annotation\nselection.',
      },
      {
        name: 'onRevertAll',
        reason: 'function-or-snippet',
        description: 'Called when user wants to revert all changes',
      },
      {
        name: 'onRevertHunk',
        reason: 'function-or-snippet',
        description: 'Called when user wants to revert a specific hunk',
      },
      {
        name: 'ref',
        reason: 'unknown-shape',
        description: 'Programmatic handle for `focusAnchor`.',
      },
      {
        name: 'toolbar',
        reason: 'function-or-snippet',
        description:
          'Override the entire toolbar for advanced customization.\nWhen provided, replaces the default toolbar completely.',
      },
      {
        name: 'toolbarActions',
        reason: 'function-or-snippet',
        description:
          'Additional toolbar actions rendered in the toolbar-right section.\nUse this to inject custom buttons (e.g., export actions) without\nreplacing the entire toolbar.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
