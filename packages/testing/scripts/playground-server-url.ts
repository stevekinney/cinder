export const DEFAULT_PLAYGROUND_URL = 'http://localhost:5555';
const DEFAULT_PLAYGROUND_PORT = Number(new URL(DEFAULT_PLAYGROUND_URL).port);
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLocalDefaultPlaygroundUrl(playgroundUrl: string): boolean {
  try {
    const url = new URL(playgroundUrl);
    return (
      url.protocol === 'http:' &&
      LOOPBACK_HOSTNAMES.has(url.hostname) &&
      Number(url.port) === DEFAULT_PLAYGROUND_PORT &&
      (url.pathname === '' || url.pathname === '/')
    );
  } catch {
    return false;
  }
}
