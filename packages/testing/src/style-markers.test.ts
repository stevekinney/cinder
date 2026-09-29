import { describe, expect, it } from 'bun:test';
import { findMissingStyleMarkers, type StyleMarker } from './style-markers.ts';

const markers: readonly StyleMarker[] = [
  { marker: '.cinder-chat', source: 'chat.css' },
  { marker: '.chat-sub-session-viewport', source: 'chat-sub-session.css' },
];

describe('findMissingStyleMarkers', () => {
  it('reports markers absent from every stylesheet', () => {
    expect(findMissingStyleMarkers(new Map([['chat.css', '.cinder-chat {}']]), markers)).toEqual([
      markers[1]!,
    ]);
  });

  it('accepts markers split across bundled stylesheets', () => {
    expect(
      findMissingStyleMarkers(
        new Map([
          ['chat.css', '.cinder-chat {}'],
          ['session.css', '.chat-sub-session-viewport {}'],
        ]),
        markers,
      ),
    ).toEqual([]);
  });
});
