import type { ComponentSchema } from '../../schema-types.ts';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    readonly: {
      type: 'boolean',
      description:
        'Disables create/edit/delete/resolve/reopen and review-note editing.\nViewing and filtering remain available.',
      default: false,
    },
    defaultFilter: {
      enum: ['all', 'unresolved'],
      description:
        'Initial comment filter. Uncontrolled after mount — the person can change it locally.',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'onNavigate',
        reason: 'function-or-snippet',
        description:
          "Called when a person activates a CURRENT comment's \"Go to\" action --\nnever for an outdated or removed one, which instead moves focus to that\ncomment's own captured-detail text in place. The host uses this to\nfocus the comment's anchor in whichever diff viewer it owns (through\nthat viewer's own public `focusAnchor`/`focusFile`, e.g.\n`DiffReview`'s internal `DiffReviewRenderer`, or a standalone viewer's\nown `ref` in a host that composes this panel next to one directly).",
      },
      {
        name: 'onStateChange',
        reason: 'function-or-snippet',
        required: true,
        description:
          "Called whenever a comment/review-note action succeeds. Named `onStateChange`\n(camelCase) rather than the cross-package contract's lowercase\n`onstatechange`: this repository's `check-prop-conventions` gate\nstructurally bans a non-native-passthrough lowercase `on*` prop (see\n`@lostgradient/cinder`'s `SourceDiffViewer.onFilesChange` for the same,\nearlier translation) — the field name and payload are otherwise exactly\nthe contract's.",
      },
      {
        name: 'state',
        reason: 'unknown-shape',
        required: true,
        description: 'Controlled diff-review session state. Never mutated directly.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
