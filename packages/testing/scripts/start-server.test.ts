import { describe, expect, test } from 'bun:test';

import { parsePlaygroundListeningPort } from './start-server.ts';

describe('parsePlaygroundListeningPort', () => {
  test('reads the playground port from direct server output', () => {
    expect(parsePlaygroundListeningPort('[playground] Listening at http://localhost:5555')).toBe(
      5555,
    );
  });

  test('reads the playground port from package-runner-prefixed output', () => {
    expect(
      parsePlaygroundListeningPort(
        '@cinder/playground dev: [playground] Listening at http://localhost:5556',
      ),
    ).toBe(5556);
  });

  test('returns null when output does not include a playground listening line', () => {
    expect(parsePlaygroundListeningPort('[playground] Pre-built 63/63 page bundles')).toBeNull();
  });
});
