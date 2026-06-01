/**
 * Visual-regression fixtures for SideNavigation.
 */
export default [
  {
    name: 'expanded',
    host: './side-navigation.fixture.svelte',
    props: {
      active: 'phoenix',
      projectsExpanded: true,
    },
  },
  {
    name: 'collapsed',
    host: './side-navigation.fixture.svelte',
    props: {
      active: 'phoenix',
      projectsExpanded: true,
    },
    interact: [{ action: 'click', target: { role: 'button', name: 'Projects' } }],
  },
  {
    name: 'focused-link',
    host: './side-navigation.fixture.svelte',
    props: {
      active: 'dashboard',
      projectsExpanded: true,
    },
    interact: [{ action: 'focus', target: { role: 'link', name: 'Dashboard' } }],
  },
];
