import { describe, expect, it } from 'bun:test';

import { localPlaygroundUrlForReportedPort, parsePlaygroundListeningPort } from './start-server.ts';

describe('parsePlaygroundListeningPort', () => {
  it('extracts the selected port from playground output', () => {
    expect(parsePlaygroundListeningPort('[playground] Listening at http://localhost:5555\n')).toBe(
      5555,
    );
  });

  it('extracts the selected port when package runner prefixes the output', () => {
    expect(
      parsePlaygroundListeningPort(
        '@cinder/playground dev: [playground] Listening at http://localhost:5556',
      ),
    ).toBe(5556);
  });

  it('returns null when output does not contain the listening message', () => {
    expect(parsePlaygroundListeningPort('Waiting for playground to report its selected port')).toBe(
      null,
    );
  });
});

describe('localPlaygroundUrlForReportedPort', () => {
  it('returns null before the spawned server reports a selected port', () => {
    expect(localPlaygroundUrlForReportedPort(null)).toBe(null);
  });

  it('returns the local playground URL for a reported port', () => {
    expect(localPlaygroundUrlForReportedPort(5556)).toBe('http://localhost:5556');
  });
});
