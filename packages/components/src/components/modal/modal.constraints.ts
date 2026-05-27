import { defineConstraints } from '../../_internal/constraints.ts';

export default defineConstraints({
  component: 'modal',
  summary:
    'Modal requires a non-empty title prop to provide an accessible name for the dialog element via aria-labelledby. When describedById is provided it must reference a real id — never pass an empty string.',
  rules: [
    {
      id: 'accessible-title',
      severity: 'error',
      description:
        'Modal requires a non-empty title prop — it is rendered as an <h2> and referenced by aria-labelledby on the <dialog>, giving screen readers the accessible name on open',
      kind: 'requires',
      of: [{ prop: 'title', nonEmpty: true }],
    },
    {
      id: 'described-by-non-empty',
      severity: 'error',
      description:
        'describedById must be a non-empty string id when provided — passing an empty string emits aria-describedby="" which is invalid',
      kind: 'requires',
      when: { prop: 'describedById', exists: true },
      of: [{ prop: 'describedById', nonEmpty: true }],
    },
    {
      id: 'alertdialog-description',
      severity: 'error',
      description:
        'Modal role="alertdialog" requires describedById so assistive technology receives both the urgent condition and required action',
      kind: 'requires',
      when: { prop: 'role', equals: 'alertdialog' },
      of: [{ prop: 'describedById', nonEmpty: true }],
    },
  ],
  examples: {
    valid: [
      {
        title: 'Modal with a descriptive title',
        code: '<Modal title="Confirm deletion" bind:open={isOpen}>\n  <p>Are you sure you want to delete this item?</p>\n</Modal>',
      },
      {
        title: 'Modal with describedById for a summary paragraph',
        code: '<Modal title="Settings" describedById="settings-desc" bind:open={isOpen}>\n  <p id="settings-desc">Adjust your account preferences below.</p>\n</Modal>',
      },
      {
        title: 'Alert dialog role with a description',
        code: '<Modal role="alertdialog" title="Session expired" describedById="session-desc" bind:open={isOpen}>\n  <p id="session-desc">Sign in again before continuing.</p>\n</Modal>',
      },
      {
        title: 'Modal without describedById (omit entirely when not needed)',
        code: '<Modal title="Upload file" bind:open={isOpen}>\n  <FileUpload />\n</Modal>',
      },
    ],
    invalid: [
      {
        title: 'Modal with empty title',
        code: '<Modal title="" bind:open={isOpen}><p>Content</p></Modal>',
        violates: 'accessible-title',
      },
      {
        title: 'Modal with empty-string describedById',
        code: '<Modal title="Settings" describedById="" bind:open={isOpen}><p>Content</p></Modal>',
        violates: 'described-by-non-empty',
      },
      {
        title: 'Alert dialog role without a description',
        code: '<Modal role="alertdialog" title="Session expired" bind:open={isOpen}><p>Sign in again.</p></Modal>',
        violates: 'alertdialog-description',
      },
    ],
  },
});
