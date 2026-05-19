import { describe, expect, it } from 'bun:test';
import { isLocalDefaultPlaygroundUrl } from './playground-server-url';

describe('isLocalDefaultPlaygroundUrl', () => {
  it.each(['http://localhost:5555', 'http://127.0.0.1:5555', 'http://[::1]:5555'])(
    'accepts local default playground URL %s',
    (playgroundUrl) => {
      expect(isLocalDefaultPlaygroundUrl(playgroundUrl)).toBe(true);
    },
  );

  it.each([
    'http://localhost:5556',
    'http://example.com:5555',
    'https://localhost:5555',
    'http://localhost:5555/custom',
  ])('rejects non-default playground URL %s', (playgroundUrl) => {
    expect(isLocalDefaultPlaygroundUrl(playgroundUrl)).toBe(false);
  });
});
