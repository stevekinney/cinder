/**
 * Visual-regression fixtures for Accordion.
 *
 * The `children` snippet (the AccordionItem list) is supplied by the
 * playground's fixture adapter — this file declares only the configuration
 * props that affect rendered state.
 */
export default [
  {
    name: 'collapsed',
    props: {
      multiple: false,
      expandedIds: [],
    },
  },
  {
    name: 'single-expanded',
    props: {
      multiple: false,
      expandedIds: ['item-1'],
    },
  },
  {
    name: 'multiple-expanded',
    props: {
      multiple: true,
      expandedIds: ['item-1', 'item-3'],
    },
  },
];
