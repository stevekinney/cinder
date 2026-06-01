/**
 * Visual-regression fixtures for Accordion.
 *
 * Accordion requires composed Accordion.Item children, so these variants render
 * through a host fixture and keep the state knobs as JSON props.
 */
export default [
  {
    name: 'collapsed',
    host: './accordion.fixture.svelte',
    props: {
      multiple: false,
      expandedIds: [],
    },
  },
  {
    name: 'single-expanded',
    host: './accordion.fixture.svelte',
    props: {
      multiple: false,
      expandedIds: ['item-1'],
    },
  },
  {
    name: 'multiple-expanded',
    host: './accordion.fixture.svelte',
    props: {
      multiple: true,
      expandedIds: ['item-1', 'item-3'],
    },
  },
];
