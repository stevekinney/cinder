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
  {
    name: 'private-lightbox-nested-overlay',
    host: './chat-private-lightbox-nested-overlay.fixture.svelte',
    category: 'interaction-state',
    // Without these, every committed baseline for this fixture only ever
    // captured the CLOSED initial state (the "Open drawer" trigger button,
    // nothing else) — the fixture exists specifically to exercise the
    // nested Drawer + ImageLightbox overlay stack, so a snapshot that never
    // opens either overlay never actually verifies anything about that
    // stack. Two steps, applied in order: open the Drawer first (its own
    // trigger button), then the image viewer nested inside it
    // (`data-testid="open-lightbox"`, since "Open image" is not unique
    // across the whole page once other fixtures render alongside it).
    interact: [
      { action: 'click', target: { role: 'button', name: 'Open drawer' } },
      { action: 'click', target: { testId: 'open-lightbox' } },
    ],
  },
];
