/**
 * Visual-regression fixtures for Button.
 */
export default [
  {
    name: 'primary',
    props: {
      label: 'Save changes',
      variant: 'primary',
    },
  },
  {
    name: 'danger',
    props: {
      label: 'Delete project',
      variant: 'danger',
    },
  },
  {
    name: 'focused',
    props: {
      label: 'Save changes',
      variant: 'primary',
    },
    interact: [{ action: 'focus', target: { role: 'button', name: 'Save changes' } }],
  },
  {
    name: 'hovered',
    props: {
      label: 'Delete project',
      variant: 'danger',
    },
    interact: [{ action: 'hover', target: { role: 'button', name: 'Delete project' } }],
  },
];
