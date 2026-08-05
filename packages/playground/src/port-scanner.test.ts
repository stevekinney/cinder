import { afterEach, describe, expect, it } from 'bun:test';

import { createHttpServerOnAvailablePort, resolvePreferredPort } from './port-scanner.ts';

const temporaryServers: ReturnType<typeof Bun.serve>[] = [];

afterEach(async () => {
  const servers = temporaryServers.splice(0);
  await Promise.all(servers.map((server) => server.stop(true)));
});

function reservePort(start: number): ReturnType<typeof Bun.serve> {
  for (let port = start; port < start + 100; port++) {
    try {
      return Bun.serve({
        port,
        fetch: () => new Response('reserved'),
      });
    } catch (error) {
      const errorWithCode = error as Error & { code?: unknown };
      if (errorWithCode.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`Could not reserve a test port starting at ${start}`);
}

function tryReservePort(port: number): ReturnType<typeof Bun.serve> | null {
  try {
    return Bun.serve({
      port,
      fetch: () => new Response('reserved'),
    });
  } catch (error) {
    const errorWithCode = error as Error & { code?: unknown };
    if (errorWithCode.code === 'EADDRINUSE') return null;
    throw error;
  }
}

/** Run `fn` with `Bun.env.PORT` set to `value` (or deleted, for `undefined`), restoring the original value afterward. */
function withPortEnv<T>(value: string | undefined, fn: () => T): T {
  const original = Bun.env['PORT'];
  if (value === undefined) delete Bun.env['PORT'];
  else Bun.env['PORT'] = value;
  try {
    return fn();
  } finally {
    if (original === undefined) delete Bun.env['PORT'];
    else Bun.env['PORT'] = original;
  }
}

describe('port selection', () => {
  it('defaults to port 5555 when PORT is unset', () => {
    withPortEnv(undefined, () => expect(resolvePreferredPort()).toBe(5555));
  });

  it('defaults to port 5555 when PORT is blank', () => {
    withPortEnv('   ', () => expect(resolvePreferredPort()).toBe(5555));
  });

  it('uses PORT from the environment when set', () => {
    withPortEnv('4321', () => expect(resolvePreferredPort()).toBe(4321));
  });

  it('trims surrounding whitespace from PORT', () => {
    withPortEnv('  4321  ', () => expect(resolvePreferredPort()).toBe(4321));
  });

  it('falls back to 5555 when PORT is not a valid number', () => {
    withPortEnv('not-a-port', () => expect(resolvePreferredPort()).toBe(5555));
  });

  it('falls back to 5555 when PORT has trailing non-numeric characters', () => {
    withPortEnv('5555abc', () => expect(resolvePreferredPort()).toBe(5555));
  });

  it('falls back to 5555 when PORT is outside the valid TCP port range', () => {
    // PORT=0 specifically: Bun.serve({ port: 0 }) binds an ephemeral free
    // port rather than failing, but createHttpServerOnAvailablePort logs and
    // returns the REQUESTED port, not the bound one — accepting 0 verbatim
    // would report the wrong address to preview/CI launchers. Rejecting it
    // here (rather than special-casing 0 downstream) keeps that contract simple.
    withPortEnv('0', () => expect(resolvePreferredPort()).toBe(5555));
    withPortEnv('70000', () => expect(resolvePreferredPort()).toBe(5555));
  });

  it('uses the next available port when the preferred port is taken', async () => {
    const reserved = tryReservePort(resolvePreferredPort()) ?? reservePort(56_000);
    temporaryServers.push(reserved);
    const reservedPort = reserved.port;
    if (reservedPort === undefined) throw new Error('Reserved test server did not expose a port');

    const { port: serverPort, server } = createHttpServerOnAvailablePort(
      reservedPort,
      () => new Response('fallback'),
    );
    temporaryServers.push(server);

    expect(serverPort).toBeGreaterThan(reservedPort);
    const response = await fetch(`http://127.0.0.1:${serverPort}`);
    expect(await response.text()).toBe('fallback');
  });

  it('never scans past the valid TCP port ceiling of 65535', () => {
    // Bun.serve() silently clamps out-of-range ports to 65535 rather than
    // throwing, so scanning past the ceiling wastes attempts re-probing the
    // same clamped port and reports a bogus upper bound (e.g. 65599, which
    // isn't a valid TCP port) in the failure message. Reserve every port from
    // 65500 through the ceiling so the scan is guaranteed to exhaust without
    // ever succeeding, then assert the reported range stops at 65535.
    const start = 65_500;
    for (let port = start; port <= 65_535; port++) {
      const server = tryReservePort(port);
      if (server) temporaryServers.push(server);
    }

    expect(() => createHttpServerOnAvailablePort(start, () => new Response('unreachable'))).toThrow(
      /through 65535/,
    );
  });
});
