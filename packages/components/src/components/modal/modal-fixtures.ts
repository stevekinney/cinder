/**
 * Visual-regression fixtures for Modal.
 *
 * Snippet props (`children`, `footer`) are provided by the playground's
 * fixture adapter — these JSON entries declare only the non-snippet
 * configuration each variant needs.
 */
export default [
  {
    name: 'open',
    props: {
      open: true,
      title: 'Open dialog',
    },
  },
  {
    name: 'open-with-description',
    props: {
      open: true,
      title: 'Open dialog with description',
      describedById: 'modal-description',
    },
  },
  {
    name: 'closed',
    props: {
      open: false,
      title: 'Closed dialog',
    },
  },
];
