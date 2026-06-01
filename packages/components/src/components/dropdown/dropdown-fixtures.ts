/**
 * Visual-regression fixtures for Dropdown.
 */
export default [
  {
    name: 'closed',
    host: './dropdown.fixture.svelte',
    props: {
      open: false,
    },
  },
  {
    name: 'open',
    host: './dropdown.fixture.svelte',
    props: {
      open: true,
    },
  },
  {
    name: 'opened-by-trigger',
    host: './dropdown.fixture.svelte',
    props: {
      open: false,
    },
    interact: [{ action: 'click', target: { role: 'button', name: 'Document actions' } }],
  },
];
