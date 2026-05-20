/**
 * Visual-regression fixtures for Input.
 *
 * The required `id` prop is included in each variant so the rendered DOM is
 * deterministic across runs. Snippet props (leading/trailing) are added by
 * the playground's fixture adapter when required.
 */
export default [
  {
    name: 'empty',
    props: {
      id: 'input-empty',
      value: '',
      placeholder: 'Type here',
    },
  },
  {
    name: 'filled',
    props: {
      id: 'input-filled',
      value: 'Hello world',
    },
  },
  {
    name: 'disabled',
    props: {
      id: 'input-disabled',
      value: 'Disabled value',
      disabled: true,
    },
  },
  {
    name: 'invalid',
    props: {
      id: 'input-invalid',
      value: 'invalid@',
      'aria-invalid': true,
    },
  },
];
