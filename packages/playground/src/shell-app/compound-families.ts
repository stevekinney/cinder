/**
 * Browser-safe compound component relationships used by the playground shell.
 *
 * Hand-maintained rather than derived from `COMPOSE_ONLY_COMPONENTS`
 * (`../discover.ts`) — the leaf → root mapping is not mechanically derivable
 * from naming alone (`segment` → `segmented-control`, `tab` → `tabs`,
 * `command-item` → `command-menu` don't share a prefix), so a generator would
 * have nothing reliable to generate from. `compound-families.test.ts` guards
 * this file's completeness against `COMPOSE_ONLY_COMPONENTS` and against
 * internal drift between the two exports below.
 */
export const COMPOUND_COMPONENT_FAMILIES: Readonly<Record<string, readonly string[]>> = {
  accordion: ['accordion-item'],
  'bento-grid': ['bento-cell'],
  chat: ['chat-composer-popover', 'chat-conversation-header', 'chat-conversation-list'],
  'choice-grid': ['choice-grid-item'],
  'command-menu': ['command-item'],
  'context-menu': ['context-menu-trigger'],
  dropdown: [
    'dropdown-trigger',
    'dropdown-menu',
    'dropdown-item',
    'dropdown-label',
    'dropdown-separator',
    'dropdown-group',
  ],
  feed: ['feed-event', 'feed-boundary'],
  grid: ['grid-item'],
  'grid-list': ['grid-list-item'],
  'segmented-control': ['segment'],
  'side-navigation': ['side-navigation-group', 'side-navigation-item'],
  'speed-dial': ['speed-dial-action'],
  'statistic-group': ['statistic'],
  table: ['table-body', 'table-cell', 'table-header', 'table-header-cell', 'table-row'],
  tabs: ['tab-list', 'tab', 'tab-panel'],
  tree: ['tree-item'],
};

export const COMPOUND_COMPONENT_PARENTS: Readonly<Record<string, string>> = {
  'accordion-item': 'accordion',
  'bento-cell': 'bento-grid',
  'chat-composer-popover': 'chat',
  'chat-conversation-header': 'chat',
  'chat-conversation-list': 'chat',
  'choice-grid-item': 'choice-grid',
  'command-item': 'command-menu',
  'context-menu-trigger': 'context-menu',
  'dropdown-trigger': 'dropdown',
  'dropdown-menu': 'dropdown',
  'dropdown-item': 'dropdown',
  'dropdown-label': 'dropdown',
  'dropdown-separator': 'dropdown',
  'dropdown-group': 'dropdown',
  'feed-boundary': 'feed',
  'feed-event': 'feed',
  'grid-item': 'grid',
  'grid-list-item': 'grid-list',
  segment: 'segmented-control',
  'side-navigation-group': 'side-navigation',
  'side-navigation-item': 'side-navigation',
  'speed-dial-action': 'speed-dial',
  statistic: 'statistic-group',
  'table-body': 'table',
  'table-cell': 'table',
  'table-header': 'table',
  'table-header-cell': 'table',
  'table-row': 'table',
  'tab-list': 'tabs',
  tab: 'tabs',
  'tab-panel': 'tabs',
  'tree-item': 'tree',
};

/**
 * Compound parts that read a STRICT context getter at instance-init scope: with
 * no provider ancestor the read throws `missing_context` during `mount()`.
 *
 * This is a strict SUBSET of {@link COMPOUND_COMPONENT_PARENTS}, and the subset
 * is the point. Most family members (`table-row`, `side-navigation-item`,
 * `statistic`, the `chat-*` leaves, …) read context through the optional
 * `tryGet*` accessors and bare-mount perfectly well — gating on family
 * membership alone would take a working live preview away from ~17 components
 * that currently have one, and since compose-only leaves ship no
 * `*.example.svelte` files there is no featured example to fall back to.
 *
 * The playground uses this to skip the bare mount for these parts (see
 * `canBareMount` in `../component-page-live-preview.ts`), which is chosen over
 * auto-wrapping them in a synthesized provider: several need a nesting depth
 * greater than two (`Table > Table.Header > Table.Row > Table.HeaderCell`),
 * their roots have their own required props, and `tab`/`segment`/`choice-grid-item`
 * need registration values matching the root's selection state — a generic
 * `<Root><Part/></Root>` wrapper renders blank or misleading for most of them.
 */
export const CONTEXT_REQUIRED_PARTS: ReadonlySet<string> = new Set([
  'accordion-item',
  'choice-grid-item',
  'command-item',
  'context-menu-trigger',
  'dropdown-item',
  'dropdown-menu',
  'dropdown-trigger',
  'segment',
  'speed-dial-action',
  'tab',
  'tab-list',
  'tab-panel',
  'table-header-cell',
  'tree-item',
]);
