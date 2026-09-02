/**
 * Markers that prove a bundled consumer still carries the global stylesheets
 * that the `@lostgradient/chat` component barrels import for their side
 * effects (CIN-514). Each marker is a rule that only the named sidecar
 * defines, so a client build that lacks it is a client build that lost the
 * file. Shared by `validate-consumer.ts` (the packed artifact) and the
 * chat-room lab's `check-client-styles.ts` (the SvelteKit client output) so
 * the two gates cannot drift apart.
 */
export type StyleMarker = { marker: string; source: string };

/**
 * One marker per component stylesheet — every barrel under
 * `packages/chat/src/lib/components` that imports its own `.css` sidecar is
 * listed, because each one is bypassed the same way when its `sideEffects`
 * marker is lost. The `chat.css` markers are two because the `@property`
 * registration is what the token-override Playwright spec proves.
 */
export const REQUIRED_STYLE_MARKERS: readonly StyleMarker[] = [
  { marker: '.cinder-chat .message-content-preview', source: '@lostgradient/chat chat.css' },
  { marker: '@property --cinder-chat-message-max-width', source: '@lostgradient/chat chat.css' },
  {
    marker: '.cinder-command-menu.chat-composer-popover',
    source: '@lostgradient/chat chat-composer-popover.css',
  },
  {
    marker: '.cinder-chat-conversation-header__main',
    source: '@lostgradient/chat chat-conversation-header.css',
  },
  {
    marker: '.cinder-chat-conversation-list__items',
    source: '@lostgradient/chat chat-conversation-list.css',
  },
  { marker: '.chat-navigation-rail-row', source: '@lostgradient/chat chat-navigation-rail.css' },
  { marker: '.chat-sub-session-viewport', source: '@lostgradient/chat chat-sub-session.css' },
];

/** Returns every required marker that no stylesheet contains. */
export function findMissingStyleMarkers(
  stylesheets: ReadonlyMap<string, string>,
  markers: readonly StyleMarker[] = REQUIRED_STYLE_MARKERS,
): StyleMarker[] {
  const contents = [...stylesheets.values()];
  return markers.filter(({ marker }) => !contents.some((css) => css.includes(marker)));
}
