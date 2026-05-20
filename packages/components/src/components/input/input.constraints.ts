import { defineConstraints } from '../../_internal/constraints.ts';

export default defineConstraints({
  component: 'input',
  summary:
    'Input requires an accessible name via the label prop (which renders a programmatically-associated <label> element). When type is "password", setting autocomplete is strongly recommended so password managers and browser autofill can recognize the field.',
  rules: [
    {
      id: 'accessible-name',
      severity: 'error',
      description:
        'Input must have an accessible name: provide a non-empty label prop which renders a <label> element associated via the id prop',
      kind: 'requires',
      of: [{ prop: 'label', nonEmpty: true }],
    },
    {
      id: 'password-autocomplete',
      severity: 'warning',
      description:
        'Password inputs should set autocomplete ("current-password" for sign-in, "new-password" for registration) so password managers recognize the field',
      kind: 'requires',
      when: { prop: 'type', equals: 'password' },
      of: [{ prop: 'autocomplete', nonEmpty: true }],
    },
  ],
  examples: {
    valid: [
      {
        title: 'Labeled text input',
        code: '<Input id="name" label="Full name" bind:value={name} />',
      },
      {
        title: 'Password input with autocomplete',
        code: '<Input id="password" label="Password" type="password" autocomplete="current-password" bind:value={password} />',
      },
      {
        title: 'Email input',
        code: '<Input id="email" label="Email address" type="email" autocomplete="email" bind:value={email} />',
      },
      {
        title: 'New password input with correct autocomplete',
        code: '<Input id="new-password" label="New password" type="password" autocomplete="new-password" bind:value={newPassword} />',
      },
    ],
    invalid: [
      {
        title: 'Input with no label',
        code: '<Input id="name" bind:value={name} />',
        violates: 'accessible-name',
      },
      {
        title: 'Password input without autocomplete',
        code: '<Input id="password" label="Password" type="password" bind:value={password} />',
        violates: 'password-autocomplete',
      },
    ],
  },
});
