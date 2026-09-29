import type { ConversationHistory } from '../components/chat/conversation-model.ts';

/**
 * Renames one row in place, keeping its position.
 *
 * The controller has to append an assistant placeholder before it has read a
 * single frame — that is what puts a row on screen while the response is
 * still opening. The host's own identifier for that row only arrives with
 * `assistant.step.started`. Renaming is what lets the two be the same row:
 * the alternative is to carry a client id alongside a server id and
 * reconcile them everywhere downstream, which is the mapping this avoids.
 *
 * Returns the history unchanged when there is nothing to do, so a caller can
 * use identity to decide whether anything happened. Refuses to overwrite an
 * existing row: a host that reuses an identifier is a host bug, and merging
 * two rows into one would lose the earlier one's content silently.
 */
export function remapMessageId(
  history: ConversationHistory,
  from: string,
  to: string,
): ConversationHistory {
  const original = history.messages[from];
  if (from === to || original === undefined || history.messages[to] !== undefined) return history;
  const messages = { ...history.messages, [to]: { ...original, id: to } };
  delete messages[from];
  return { ...history, ids: history.ids.map((id) => (id === from ? to : id)), messages };
}

/**
 * Reconciles a run's provisional rows against the authoritative history its
 * terminal frame carried.
 *
 * This is NOT the same operation as adopting a full session snapshot, and
 * the difference is the whole point. A full snapshot replaces membership: the
 * host asked for the conversation and got all of it. A run terminal is
 * narrower — it is authoritative about the rows THIS RUN produced and says
 * nothing about anything else. So the merge replaces only what the run
 * appended and leaves every other row exactly where it was, including turns
 * that arrived from elsewhere while the run was streaming.
 *
 * The canonical rows go back in at the position the first provisional row
 * occupied, not at the end, so a turn that was in the middle of the
 * transcript stays in the middle.
 *
 * The one row that is both provisional and already-accepted history is the
 * user turn that opened the run. When the terminal names it under the same
 * identifier, it is kept rather than deleted and reinserted: approval
 * resolution associates a tool call with the turn that owns it by identifier,
 * and swapping that identifier mid-run would orphan a pending approval.
 */
export function mergeRunHistory(
  current: ConversationHistory,
  terminal: ConversationHistory,
  provisionalIds: ReadonlySet<string>,
  runStartIds: ReadonlySet<string>,
): ConversationHistory {
  const messages = { ...current.messages };
  // Every row that was already on screen when the run started AND that the
  // terminal names under the same identifier. Those keep the CLIENT's message
  // object, not the server's: a prior turn may carry local decoration — a
  // delivery-failure marker, an unsaved-turn annotation — that the server has
  // no idea about and would silently strip if its copy won.
  const retained = new Set([...runStartIds].filter((id) => terminal.messages[id] !== undefined));
  const firstProvisional = current.ids.findIndex(
    (id) => provisionalIds.has(id) && !retained.has(id),
  );
  const insertionIndex = firstProvisional === -1 ? current.ids.length : firstProvisional;
  const ids = current.ids.filter((id) => !provisionalIds.has(id) || retained.has(id));
  for (const id of provisionalIds) {
    if (!retained.has(id)) delete messages[id];
  }
  const canonicalIds = terminal.ids.filter((id) => !retained.has(id));
  for (const id of canonicalIds) {
    const message = terminal.messages[id];
    if (message !== undefined) messages[id] = message;
  }
  ids.splice(
    Math.min(insertionIndex, ids.length),
    0,
    ...canonicalIds.filter((id) => !ids.includes(id)),
  );
  return { ...current, ids, messages };
}
