import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve as resolvePath, sep } from 'node:path';
import { parseExpectedReport, type ShardIdentity } from './static-playground-evidence.ts';
import { runStaticPlaywright } from './static-playground-runner.ts';
import {
  headerRules,
  startStaticServer,
  type StaticVercelConfig,
} from './static-playground-server.ts';
export { playwrightArguments, runStaticPlaywright } from './static-playground-runner.ts';

export type StaticManifestEntry = { path: string; bytes: number; sha256: string };
type StaticExportInventory = { version: 1; sourceSha: string; routes: string[] };
type StaticExportMetadata = {
  version: 1;
  sourceSha: string;
  exportDurationMs: number;
  rssBytes: number;
  rssMiB: number;
  rssSample: 'export-completion';
};

function isStaticExportInventory(value: unknown): value is StaticExportInventory {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = Object.fromEntries(Object.entries(value));
  return (
    candidate['version'] === 1 &&
    typeof candidate['sourceSha'] === 'string' &&
    Array.isArray(candidate['routes']) &&
    candidate['routes'].every((route) => typeof route === 'string')
  );
}

function isStaticExportMetadata(value: unknown): value is StaticExportMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = Object.fromEntries(Object.entries(value));
  return (
    candidate['version'] === 1 &&
    typeof candidate['sourceSha'] === 'string' &&
    typeof candidate['exportDurationMs'] === 'number' &&
    typeof candidate['rssBytes'] === 'number' &&
    typeof candidate['rssMiB'] === 'number' &&
    candidate['rssSample'] === 'export-completion'
  );
}

const isStaticVercelConfig = (value: unknown): value is StaticVercelConfig =>
  typeof value === 'object' && value !== null;

export type VerifyStaticArtifactOptions = {
  directory: string;
  vercelConfig: StaticVercelConfig;
  origin: string;
  reportPath?: string;
};

const isExternal = (url: string): boolean => /^(?:[a-z]+:|#|data:|mailto:)/i.test(url);

async function filesUnder(directory: string, current = directory): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(directory, path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function manifestFor(directory: string): Promise<StaticManifestEntry[]> {
  const entries: StaticManifestEntry[] = [];
  const files = await filesUnder(directory);
  for (const file of files.sort()) {
    const bytes = await readFile(file);
    entries.push({
      path: `/${relative(directory, file).split(sep).join('/')}`,
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  return entries;
}

async function readInventory(directory: string): Promise<StaticExportInventory> {
  const path = join(directory, 'static-inventory.json');
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!isStaticExportInventory(value))
    throw new Error('[static-playground] static export inventory is missing or invalid');
  return value;
}
async function readExportDuration(
  directory: string,
  inventory: StaticExportInventory,
): Promise<StaticExportMetadata> {
  const metadataPath =
    process.env['PLAYGROUND_STATIC_METADATA'] ??
    join(directory, '..', 'static-export-metadata.json');
  const metadata: unknown = JSON.parse(await readFile(metadataPath, 'utf8'));
  if (
    !isStaticExportMetadata(metadata) ||
    metadata.sourceSha !== inventory.sourceSha ||
    !Number.isFinite(metadata.exportDurationMs) ||
    !Number.isFinite(metadata.rssBytes) ||
    !Number.isFinite(metadata.rssMiB)
  ) {
    throw new Error('[static-playground] static export metadata is missing or mismatched');
  }
  return metadata;
}
function requiredAssetPaths(html: string): string[] {
  const urls = [...html.matchAll(/\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]!);
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const relation = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (!relation || !/(?:^|\s)(?:stylesheet|modulepreload|preload|icon)(?:\s|$)/.test(relation))
      continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href) urls.push(href);
  }
  return [
    ...new Set(
      urls
        .filter((url) => url.startsWith('/') && !isExternal(url))
        .map((url) => url.split(/[?#]/, 1)[0]!),
    ),
  ];
}

async function documentHeadingCount(html: string): Promise<number> {
  let count = 0;
  const rewriter = new HTMLRewriter().on('h1', {
    element() {
      count += 1;
    },
  });
  await rewriter.transform(new Response(html)).arrayBuffer();
  return count;
}

function documentRoutes(manifest: readonly StaticManifestEntry[]): string[] {
  return manifest
    .map((entry) => entry.path)
    .filter((path) => path === '/index.html' || /^\/page\/[^/]+\/index\.html$/.test(path))
    .map((path) => (path === '/index.html' ? '/' : path.replace(/\/index\.html$/, '')))
    .sort();
}

export async function verifyStaticArtifact(options: VerifyStaticArtifactOptions) {
  const directory = resolvePath(options.directory);
  const manifest = await manifestFor(directory);
  const inventory = await readInventory(directory);
  const metadata = await readExportDuration(directory, inventory);
  const revision = {
    sourceSha: Bun.spawnSync(['git', 'rev-parse', 'HEAD']).stdout.toString().trim() || 'unknown',
    dirty: Bun.spawnSync(['git', 'status', '--porcelain']).stdout.toString().trim().length > 0,
  };
  if (inventory.sourceSha !== revision.sourceSha)
    throw new Error(
      `[static-playground] export source SHA ${inventory.sourceSha} does not match checked-out source ${revision.sourceSha}`,
    );
  if (process.env['GITHUB_SHA'] !== undefined && process.env['GITHUB_SHA'] !== inventory.sourceSha)
    throw new Error('[static-playground] export source SHA does not match GITHUB_SHA');
  const routes = inventory.routes;
  if (routes.length < 2 || new Set(routes).size !== routes.length || routes[0] !== '/')
    throw new Error('[static-playground] export inventory is empty or invalid');
  const discoveredRoutes = documentRoutes(manifest);
  if (JSON.stringify(discoveredRoutes) !== JSON.stringify([...routes].sort()))
    throw new Error('[static-playground] export inventory route count or contents drifted');
  const files = new Set(manifest.map((entry) => entry.path));
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const route of routes) {
    const file =
      route === '/' ? join(directory, 'index.html') : join(directory, route.slice(1), 'index.html');
    const html = await readFile(file, 'utf8');
    if (!html.trim())
      throw new Error(`[static-playground] ${route}: prerendered document is empty`);
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    const description = html
      .match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?.trim();
    if (!title || titles.has(title))
      throw new Error(`[static-playground] ${route}: missing or duplicate title`);
    if (!description || descriptions.has(description))
      throw new Error(`[static-playground] ${route}: missing or duplicate description`);
    titles.add(title);
    descriptions.add(description);
    const canonical = `${options.origin}${route}`;
    if (
      (html.match(/<link[^>]+rel=["']canonical["']/gi) ?? []).length !== 1 ||
      !html.includes(`href="${canonical}"`)
    ) {
      throw new Error(`[static-playground] ${route}: canonical metadata is invalid`);
    }
    if ((await documentHeadingCount(html)) !== 1)
      throw new Error(`[static-playground] ${route}: expected exactly one document-owned h1`);
    for (const asset of requiredAssetPaths(html)) {
      const candidate = asset === '/' ? '/index.html' : asset;
      if (!files.has(candidate) && !files.has(`${candidate}/index.html`)) {
        throw new Error(`[static-playground] ${route}: missing required asset ${asset}`);
      }
    }
  }
  const server = await startStaticServer(directory, options.vercelConfig);
  try {
    const root = await fetch(`${server.origin}/`);
    const rootBody = await root.text();
    if (
      root.status !== 200 ||
      !rootBody.includes('<html') ||
      !root.headers.get('content-type')?.startsWith('text/html')
    )
      throw new Error('[static-playground] root probe failed');
    for (const header of headerRules(options.vercelConfig, '/')) {
      if (root.headers.get(header.key) !== header.value)
        throw new Error(`[static-playground] root header ${header.key} does not match vercel.json`);
    }
    const canonical = await fetch(`${server.origin}/page/button`);
    if (canonical.status !== 200) throw new Error('[static-playground] clean URL probe failed');
    const redirect = await fetch(`${server.origin}/c/button`, { redirect: 'manual' });
    if (redirect.status !== 301 || redirect.headers.get('location') !== '/page/button')
      throw new Error('[static-playground] redirect probe failed');
    const missingRedirect = await fetch(`${server.origin}/c/nonexistent-example`, {
      redirect: 'manual',
    });
    if (
      missingRedirect.status !== 301 ||
      missingRedirect.headers.get('location') !== '/page/nonexistent-example'
    )
      throw new Error('[static-playground] missing redirect probe failed');
    const missingPage = await fetch(`${server.origin}/page/nonexistent-example`);
    if (missingPage.status !== 404)
      throw new Error('[static-playground] missing clean URL must return 404');
    const unknown = await fetch(`${server.origin}/unknown`);
    if (unknown.status !== 404)
      throw new Error('[static-playground] unknown paths must return 404');
    for (const [pathname, response] of [
      ['/c/button', redirect],
      ['/c/nonexistent-example', missingRedirect],
      ['/page/nonexistent-example', missingPage],
      ['/unknown', unknown],
    ] as const) {
      for (const header of headerRules(options.vercelConfig, pathname)) {
        if (response.headers.get(header.key) !== header.value)
          throw new Error(
            `[static-playground] ${pathname} header ${header.key} does not match vercel.json`,
          );
      }
      await response.arrayBuffer();
    }
    const asset = manifest.find((entry) => entry.path.startsWith('/assets/'));
    if (asset) {
      const response = await fetch(`${server.origin}${asset.path}`);
      if (response.status !== 200)
        throw new Error(`[static-playground] asset probe failed for ${asset.path}`);
      for (const header of headerRules(options.vercelConfig, asset.path)) {
        if (response.headers.get(header.key) !== header.value)
          throw new Error(
            `[static-playground] asset header ${header.key} does not match vercel.json`,
          );
      }
      const missingAsset = await fetch(`${server.origin}${asset.path}.missing`);
      if (missingAsset.status !== 404)
        throw new Error('[static-playground] missing asset must return 404');
      const expectedType = asset.path.endsWith('.js')
        ? 'text/javascript'
        : asset.path.endsWith('.css')
          ? 'text/css'
          : undefined;
      if (expectedType && !response.headers.get('content-type')?.startsWith(expectedType))
        throw new Error(`[static-playground] ${asset.path} has the wrong Content-Type`);
    }
    for (const [extension, expectedType] of [
      ['.js', 'text/javascript'],
      ['.css', 'text/css'],
    ] as const) {
      const representative = manifest.find(
        (entry) => entry.path.startsWith('/assets/') && entry.path.endsWith(extension),
      );
      if (representative) {
        const response = await fetch(`${server.origin}${representative.path}`);
        if (!response.headers.get('content-type')?.startsWith(expectedType))
          throw new Error(`[static-playground] ${representative.path} has the wrong Content-Type`);
      }
    }
    const traversal = await fetch(`${server.origin}/%2e%2e%2findex.html`);
    if (traversal.status !== 404) throw new Error('[static-playground] traversal probe failed');
  } finally {
    await server.close();
  }
  const artifactDigest = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  const report = {
    sourceSha: revision.sourceSha,
    dirty: revision.dirty,
    artifactDigest,
    exportDurationMs: metadata.exportDurationMs,
    rssBytes: metadata.rssBytes,
    rssMiB: metadata.rssMiB,
    rssSample: metadata.rssSample,
    routes,
    manifest,
  };
  if (options.reportPath)
    await Bun.write(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const occurrences = (flag: string): string[] =>
    args.flatMap((arg, index) => {
      if (arg === flag)
        return args[index + 1] && !args[index + 1]!.startsWith('--') ? [args[index + 1]!] : [];
      if (arg.startsWith(`${flag}=`)) return [arg.slice(flag.length + 1)];
      return [];
    });
  const valueFor = (flag: string): string | undefined => {
    const values = occurrences(flag);
    if (values.length > 1) throw new Error(`[static-playground] duplicate flag ${flag}`);
    if (values.length === 1 && values[0]!.length === 0)
      throw new Error(`[static-playground] empty value for ${flag}`);
    return values[0];
  };
  if (args.filter((arg) => arg === '--verify-only').length > 1)
    throw new Error('[static-playground] duplicate flag --verify-only');
  const knownFlags = new Set([
    '--directory',
    '--metadata',
    '--expected-report',
    '--shard',
    '--evidence-directory',
    '--verify-only',
  ]);
  const valueFlags = new Set([
    '--directory',
    '--metadata',
    '--expected-report',
    '--shard',
    '--evidence-directory',
  ]);
  for (const arg of args) {
    if (
      !arg.startsWith('--') ||
      knownFlags.has(arg) ||
      [...knownFlags].some((flag) => arg.startsWith(`${flag}=`))
    )
      continue;
    throw new Error(`[static-playground] unknown flag ${arg}`);
  }
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg.startsWith('--')) continue;
    const previous = args[index - 1]?.split('=', 1)[0];
    if (!previous || !valueFlags.has(previous))
      throw new Error(`[static-playground] unexpected argument ${arg}`);
  }
  for (const flag of knownFlags) {
    if (
      flag !== '--verify-only' &&
      args.some(
        (arg, index) => arg === flag && (!args[index + 1] || args[index + 1]!.startsWith('--')),
      )
    )
      throw new Error(`[static-playground] ${flag} requires a value`);
  }
  const directory = valueFor('--directory');
  if (!directory)
    throw new Error('usage: check-static-playground.ts --directory <public-directory>');
  const artifactDirectory = resolvePath(directory);
  const metadata = valueFor('--metadata');
  if (metadata) process.env['PLAYGROUND_STATIC_METADATA'] = resolvePath(metadata);
  const shardValue = valueFor('--shard');
  let shard: ShardIdentity = { index: 1, total: 1 };
  if (shardValue) {
    const match = shardValue.match(/^(\d+)\/(\d+)$/);
    if (!match) throw new Error('[static-playground] --shard must be INDEX/TOTAL');
    shard = { index: Number(match[1]), total: Number(match[2]) };
    if (
      !Number.isSafeInteger(shard.index) ||
      !Number.isSafeInteger(shard.total) ||
      shard.total < 1 ||
      shard.index < 1 ||
      shard.index > shard.total
    )
      throw new Error('[static-playground] --shard is out of range');
  }
  const evidenceDirectory = valueFor('--evidence-directory');
  if (evidenceDirectory && shard.total < 1)
    throw new Error('[static-playground] invalid evidence shard');
  const verifyOnly = args.includes('--verify-only');
  if (verifyOnly && (shardValue || evidenceDirectory))
    throw new Error(
      '[static-playground] --verify-only cannot be combined with --shard or --evidence-directory',
    );
  if (args.some((arg) => arg.startsWith('--verify-only=')))
    throw new Error('[static-playground] --verify-only does not take a value');
  const expectedReportPath = valueFor('--expected-report');
  const expectedReport = expectedReportPath
    ? await Bun.file(resolvePath(expectedReportPath))
        .json()
        .catch(() => {
          throw new Error('[static-playground] expected producer report is missing or malformed');
        })
    : undefined;
  const parsedConfig: unknown = JSON.parse(
    await Bun.file(join(import.meta.dirname, '../../playground/vercel.json')).text(),
  );
  if (!isStaticVercelConfig(parsedConfig))
    throw new Error('[static-playground] vercel.json must contain an object');
  const report = await verifyStaticArtifact({
    directory: artifactDirectory,
    vercelConfig: parsedConfig,
    origin: 'https://cinder.website',
    ...(expectedReportPath
      ? {}
      : { reportPath: join(artifactDirectory, '..', 'static-playground-report.json') }),
  });
  if (expectedReportPath) {
    const expected = parseExpectedReport(expectedReport);
    if (
      expected.sourceSha !== report.sourceSha ||
      expected.artifactDigest !== report.artifactDigest ||
      JSON.stringify(expected.routes) !== JSON.stringify(report.routes) ||
      JSON.stringify(expected.manifest) !== JSON.stringify(report.manifest)
    )
      throw new Error(
        '[static-playground] producer report identity does not match downloaded artifact',
      );
  }
  console.log(
    `[static-playground] verified ${report.routes.length} routes, ${report.manifest.length} files, digest ${report.artifactDigest}`,
  );
  if (verifyOnly) return;
  const producerReportPath = expectedReportPath
    ? resolvePath(expectedReportPath)
    : join(artifactDirectory, '..', 'static-playground-report.json');
  const browserExit = await runStaticPlaywright(
    artifactDirectory,
    producerReportPath,
    parsedConfig,
    shard,
    evidenceDirectory,
  );
  if (browserExit !== 0) process.exitCode = browserExit;
}
if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
