/**
 * Visual-regression fixtures for AccessGate.
 */
export default [
  {
    name: 'inline-denied',
    host: './access-gate.fixture.svelte',
    props: {
      variant: 'inline',
    },
  },
  {
    name: 'inline-granted',
    host: './access-gate.fixture.svelte',
    props: {
      variant: 'inline-granted',
    },
  },
  {
    name: 'inline-toggle',
    host: './access-gate.fixture.svelte',
    props: {
      variant: 'inline-toggle',
    },
  },
  {
    name: 'section-denied',
    host: './access-gate.fixture.svelte',
    props: {
      variant: 'section',
    },
  },
];
