/** Browser-safe compound component relationships used by the playground shell. */
export const COMPOUND_COMPONENT_FAMILIES: Readonly<Record<string, readonly string[]>> = {
  accordion: ['accordion-item'],
  'bento-grid': ['bento-cell'],
  card: [],
  table: ['table-body', 'table-cell', 'table-header', 'table-header-cell', 'table-row'],
  chat: ['chat-composer-popover', 'chat-conversation-header', 'chat-conversation-list'],
};
