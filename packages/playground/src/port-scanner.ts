const DEFAULT_PORT = 5555;

/**
 * Resolve the preferred port from `PORT`, falling back to {@link DEFAULT_PORT}
 * for an unset/blank value, a non-integer string (e.g. "5555abc" — `/^\d+$/`
 * rejects trailing garbage that `Number.parseInt` would silently accept), or
 * a value outside the valid TCP port range (1-65535, which would otherwise
 * reach `Bun.serve()` and throw a non-`EADDRINUSE` error that aborts startup).
 */
export function resolvePreferredPort(): number {
  const fromEnv = Bun.env['PORT']?.trim();
  if (fromEnv === undefined || fromEnv === '') return DEFAULT_PORT;
  if (!/^\d+$/.test(fromEnv)) return DEFAULT_PORT;
  const parsed = Number.parseInt(fromEnv, 10);
  return parsed >= 1 && parsed <= 65535 ? parsed : DEFAULT_PORT;
}

const MAX_PORT_SCAN_ATTEMPTS = 100;
const MAX_VALID_PORT = 65535;

function isAddressInUseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const errorWithCode = error as Error & { code?: unknown };
  return errorWithCode.code === 'EADDRINUSE';
}

type PlaygroundFetchHandler = (request: Request) => Response | Promise<Response>;
type BunServer = ReturnType<typeof Bun.serve>;
type PlaygroundHttpServer = {
  server: BunServer;
  port: number;
};

export function createHttpServerOnAvailablePort(
  preferredPort: number,
  fetchHandler: PlaygroundFetchHandler,
): PlaygroundHttpServer {
  // Bun.serve() silently clamps a port above 65535 to 65535 instead of
  // throwing, so scanning past the ceiling would waste attempts re-probing
  // the same clamped port and report a bogus (invalid) upper bound in the
  // error below. Clamp the scan range itself instead.
  const maxPort = Math.min(preferredPort + MAX_PORT_SCAN_ATTEMPTS - 1, MAX_VALID_PORT);
  for (let port = preferredPort; port <= maxPort; port++) {
    try {
      const server = Bun.serve({
        port,
        fetch(request, requestServer) {
          configureRequestIdleTimeout(request, requestServer);
          return fetchHandler(request);
        },
      });
      return { server, port };
    } catch (error) {
      if (!isAddressInUseError(error)) throw error;
    }
  }

  throw new Error(`[playground] no available port found from ${preferredPort} through ${maxPort}`);
}

type RequestIdleTimeoutController = {
  timeout: (request: Request, seconds: number) => unknown;
};

/**
 * Keep the live-reload event stream open between edits without weakening the
 * timeout for ordinary HTTP requests. Bun applies its default ten-second idle
 * timeout to streaming responses unless the request opts out explicitly.
 */
export function configureRequestIdleTimeout(
  request: Request,
  server: RequestIdleTimeoutController,
): void {
  if (new URL(request.url).pathname === '/events') {
    server.timeout(request, 0);
  }
}
