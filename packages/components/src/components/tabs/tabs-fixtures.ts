/**
 * Visual-regression fixtures for Tabs.
 */
export default [
  {
    name: 'overview',
    host: './tabs.fixture.svelte',
    props: {
      active: 'overview',
    },
  },
  {
    name: 'activity',
    host: './tabs.fixture.svelte',
    props: {
      active: 'activity',
    },
  },
  {
    name: 'keyboard-next',
    host: './tabs.fixture.svelte',
    props: {
      active: 'overview',
    },
    interact: [{ action: 'press', target: { role: 'tab', name: 'Overview' }, key: 'ArrowRight' }],
  },
];
