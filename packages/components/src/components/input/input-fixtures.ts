/**
 * Visual-regression fixtures for Input.
 *
 * The required `id` prop is included in each variant so the rendered DOM is
 * deterministic across runs. Labels keep the interaction fixtures targetable
 * through user-facing accessible names.
 */
export default [
  {
    name: 'empty',
    props: {
      id: 'input-empty',
      label: 'Empty input',
      value: '',
      placeholder: 'Type here',
    },
  },
  {
    name: 'filled',
    props: {
      id: 'input-filled',
      label: 'Filled input',
      value: 'Hello world',
    },
  },
  {
    name: 'disabled',
    props: {
      id: 'input-disabled',
      label: 'Disabled input',
      value: 'Disabled value',
      disabled: true,
    },
  },
  {
    name: 'invalid',
    props: {
      id: 'input-invalid',
      label: 'Invalid input',
      value: 'invalid@',
      'aria-invalid': true,
    },
  },
  {
    name: 'focused',
    props: {
      id: 'input-focused',
      label: 'Focused input',
      value: 'Ready to edit',
    },
    interact: [{ action: 'focus', target: { label: 'Focused input' } }],
  },
];
