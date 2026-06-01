/**
 * Visual-regression fixtures for SegmentedControl.
 */
export default [
  {
    name: 'rendered',
    host: './segmented-control.fixture.svelte',
    props: {
      selected: 'rendered',
    },
  },
  {
    name: 'diff-selected',
    host: './segmented-control.fixture.svelte',
    props: {
      selected: 'rendered',
    },
    interact: [{ action: 'click', target: { role: 'radio', name: 'Diff' } }],
  },
  {
    name: 'focused',
    host: './segmented-control.fixture.svelte',
    props: {
      selected: 'source',
    },
    interact: [{ action: 'focus', target: { role: 'radio', name: 'Rendered' } }],
  },
];
