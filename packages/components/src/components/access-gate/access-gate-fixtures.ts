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
    name: 'section-denied',
    host: './access-gate.fixture.svelte',
    props: {
      variant: 'section',
    },
  },
];
