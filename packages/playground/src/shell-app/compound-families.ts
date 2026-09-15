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
 * Keep an authored part example when one exists. Compose-only parts without
 * their own examples use the parent's authored composition instead.
 */
export async function resolvePreviewSourceComponentName(
  componentName: string,
  hasAuthoredExamples: (componentName: string) => Promise<boolean>,
): Promise<string> {
  if (COMPOUND_COMPONENT_PARENTS[componentName] === undefined) return componentName;
  if (await hasAuthoredExamples(componentName)) return componentName;
  return COMPOUND_COMPONENT_PARENTS[componentName] ?? componentName;
}
