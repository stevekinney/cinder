/**
 * Browser-only Chat regressions. This host is deliberately absent from
 * `chat.examples.json`: published examples remain concise, while the
 * implementation exercises its full interaction matrix in private CI.
 */
export default [
  {
    name: 'private-harness',
    host: './chat-private-harness.fixture.svelte',
    category: 'interaction-state',
  },
  {
    name: 'private-history-prepend-stress',
    host: './chat-private-history-prepend-stress.fixture.svelte',
    category: 'interaction-state',
  },
];
