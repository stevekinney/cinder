import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, relative, resolve as resolvePath, sep } from 'node:path';

export type StaticHeaderRule = { source: string; headers?: Array<{ key: string; value: string }> };
export type StaticRedirectRule = { source: string; destination: string; statusCode: number };
export type StaticVercelConfig = {
  cleanUrls?: boolean;
  rewrites?: Array<{ source: string; destination: string }>;
  redirects?: StaticRedirectRule[];
  headers?: StaticHeaderRule[];
};

type StaticServer = { origin: string; close: () => Promise<void> };

async function routeFile(
  directory: string,
  pathname: string,
  cleanUrls: boolean,
): Promise<string | undefined> {
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return;
  }
  if (
    !decodedPathname.startsWith('/') ||
    decodedPathname.includes('\0') ||
    decodedPathname.split('/').includes('..')
  )
    return;
  const cleanPath = decodedPathname === '/' ? '/index.html' : decodedPathname;
  const candidates = cleanUrls
    ? [
        cleanPath,
        `${cleanPath.replace(/\/$/, '')}/index.html`,
        `${cleanPath.replace(/\/$/, '')}.html`,
      ]
    : [cleanPath];
  for (const candidate of candidates) {
    const path = resolvePath(directory, `.${candidate}`);
    const relativePath = relative(resolvePath(directory), path);
    if (relativePath.startsWith(`..${sep}`) || relativePath === '..') return;
    const pathStat = await stat(path).catch(() => undefined);
    if (!pathStat?.isFile()) continue;
    const rootReal = await realpath(directory);
    const candidateReal = await realpath(path);
    const relativeCandidate = relative(rootReal, candidateReal);
    if (
      relativeCandidate === '..' ||
      relativeCandidate.startsWith(`..${sep}`) ||
      relativeCandidate.includes(`${sep}..${sep}`)
    )
      return;
    return path;
  }
  return;
}

export function headerRules(
  config: StaticVercelConfig,
  pathname: string,
): Array<{ key: string; value: string }> {
  return (config.headers ?? [])
    .filter((rule) => {
      if (rule.source === '/(.*)') return true;
      if (rule.source === '/assets/(.*)') return pathname.startsWith('/assets/');
      return false;
    })
    .flatMap((rule) => rule.headers ?? []);
}

function redirectFor(config: StaticVercelConfig, pathname: string): StaticRedirectRule | undefined {
  return (config.redirects ?? []).find((rule) => {
    if (rule.source === '/c/:name') {
      return /^\/c\/[^/]+$/.test(pathname);
    }
    return pathname === rule.source;
  });
}

function assertSupportedConfig(config: StaticVercelConfig): void {
  if (
    JSON.stringify(config.rewrites ?? []) !==
    JSON.stringify([{ source: '/', destination: '/index.html' }])
  )
    throw new Error('[static-playground] unsupported rewrite configuration');
  if (
    (config.redirects ?? []).some(
      (rule) =>
        rule.source !== '/c/:name' || rule.destination !== '/page/:name' || rule.statusCode !== 301,
    )
  )
    throw new Error('[static-playground] unsupported redirect configuration');
  if ((config.headers ?? []).some((rule) => !['/(.*)', '/assets/(.*)'].includes(rule.source)))
    throw new Error('[static-playground] unsupported header configuration');
}

export async function startStaticServer(
  directory: string,
  config: StaticVercelConfig,
): Promise<StaticServer> {
  assertSupportedConfig(config);
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const pathname = new URL(request.url ?? '/', 'http://static.test').pathname;
    const redirect = redirectFor(config, pathname);
    if (redirect) {
      const name = pathname.split('/').at(-1)!;
      response.writeHead(redirect.statusCode, {
        ...Object.fromEntries(headerRules(config, pathname).map(({ key, value }) => [key, value])),
        Location: redirect.destination.replace(':name', name),
      });
      response.end();
      return;
    }
    const candidate = await routeFile(directory, pathname, config.cleanUrls === true);
    const target =
      candidate === undefined ? undefined : await stat(candidate).catch(() => undefined);
    if (candidate === undefined || !target?.isFile()) {
      response.writeHead(
        404,
        Object.fromEntries(headerRules(config, pathname).map(({ key, value }) => [key, value])),
      );
      response.end('Not Found');
      return;
    }
    const body = await readFile(candidate);
    const headers = Object.fromEntries(
      headerRules(config, pathname).map(({ key, value }) => [key, value]),
    );
    const contentTypes: Record<string, string> = {
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.woff2': 'font/woff2',
    };
    headers['Content-Type'] ??=
      contentTypes[extname(candidate).toLowerCase()] ?? 'application/octet-stream';
    response.writeHead(200, headers);
    response.end(body);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('static checker could not bind a port');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        let settled = false;
        server.close((error) => {
          if (settled) return;
          settled = true;
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
