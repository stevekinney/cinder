/**
 * Visual-regression fixtures for Modal.
 *
 * Modal requires children/footer snippets, so these variants render through a
 * host fixture and keep the non-snippet configuration as JSON props.
 */
export default [
  {
    name: 'open',
    host: './modal.fixture.svelte',
    props: {
      open: true,
      title: 'Open dialog',
    },
  },
  {
    name: 'open-with-description',
    host: './modal.fixture.svelte',
    props: {
      open: true,
      title: 'Open dialog with description',
      describedById: 'modal-description',
    },
  },
  {
    name: 'closed',
    host: './modal.fixture.svelte',
    props: {
      open: false,
      title: 'Closed dialog',
    },
  },
];
