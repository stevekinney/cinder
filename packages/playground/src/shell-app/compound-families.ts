/** Browser-safe compound component relationships used by the playground shell. */
export const COMPOUND_COMPONENT_FAMILIES: Readonly<Record<string, readonly string[]>> = {
  accordion: [],
  'bento-grid': [],
  card: [],
  table: [],
  chat: ['chat-composer-popover', 'chat-conversation-header', 'chat-conversation-list'],
};

export const COMPOUND_COMPONENT_PARENTS: Readonly<Record<string, string>> = {
  'accordion-item': 'accordion',
  'bento-cell': 'bento-grid',
  'table-body': 'table',
  'table-cell': 'table',
  'table-header': 'table',
  'table-header-cell': 'table',
  'table-row': 'table',
  'chat-composer-popover': 'chat',
  'chat-conversation-header': 'chat',
  'chat-conversation-list': 'chat',
};
