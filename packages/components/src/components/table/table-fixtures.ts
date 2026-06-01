/**
 * Visual-regression fixtures for Table.
 */
export default [
  {
    name: 'contributors',
    host: './table.fixture.svelte',
  },
  {
    name: 'selected-row',
    host: './table.fixture.svelte',
    interact: [{ action: 'click', target: { label: 'Select Grace Hopper' } }],
  },
  {
    name: 'sorted-name',
    host: './table.fixture.svelte',
    interact: [{ action: 'click', target: { role: 'button', name: 'Name' } }],
  },
];
