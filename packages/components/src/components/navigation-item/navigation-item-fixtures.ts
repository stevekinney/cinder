/**
 * Visual-regression fixtures for NavigationItem.
 */
export default [
  {
    name: 'active-link',
    host: './navigation-item.fixture.svelte',
    props: {
      active: true,
    },
  },
  {
    name: 'focused-link',
    host: './navigation-item.fixture.svelte',
    props: {
      active: false,
    },
    interact: [{ action: 'focus', target: { role: 'link', name: 'Dashboard' } }],
  },
];
