import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';
import { DEFAULT_PLAYGROUND_URL, isLocalDefaultPlaygroundUrl } from './playground-server-url';
import {
  isFingerprintStale,
  newestSourceMtimeMs,
  type PlaygroundFreshnessFingerprint,
} from './source-fingerprint.ts';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolvePath(here, '..');
const repoRoot = resolvePath(here, '../../..');
const playgroundRoot = resolvePath(repoRoot, 'packages/playground');
const playgroundBundleDependencyPackages = [
  '@cinder/diff',
  '@cinder/markdown',
  '@cinder/commentary',
  '@lostgradient/cinder',
  '@lostgradient/chat',
] as const;
// Probe the cheap liveness endpoint first. `/api/manifest` does real work and
// can lag behind initial server readiness, which makes local startup look hung
// even though the playground is already accepting requests.
const livenessPath = '/ping';
const warmReadinessPath = '/ready';
const reuseOptOut = process.env['PLAYWRIGHT_REUSE_SERVER'] === '0';
let targetPlaygroundUrl = PLAYGROUND_URL;
const PLAYGROUND_PORT_PROBE_TIMEOUT_MS = 500;
const PLAYGROUND_READY_TIMEOUT_MS = 240_000;
const PLAYGROUND_WARM_READINESS_STABLE_READS = 2;
const PLAYGROUND_WARM_READINESS_DELAY_MS = 500;
const CHILD_PROCESS_TERMINATION_GRACE_MS = 5_000;

type PlaygroundPathProbeResult = {
  ok: boolean;
  status: number | null;
};

export type ManagedChildProcess = {
  childProcess: ChildProcess;
  name: string;
  killProcessGroup: boolean;
};

export function playgroundUrlForPath(
  path: string,
  playgroundUrl: string = targetPlaygroundUrl,
): string {
  const url = new URL(playgroundUrl);
  const basePath = url.pathname.replace(/\/+$/, '');
  const probePath = path.startsWith('/') ? path : `/${path}`;

  url.pathname = `${basePath}${probePath}`;
  url.search = '';
  url.hash = '';

  return url.toString();
}

async function probePlaygroundPath(
  path: string,
  playgroundUrl: string = targetPlaygroundUrl,
): Promise<PlaygroundPathProbeResult> {
  try {
    const response = await fetch(playgroundUrlForPath(path, playgroundUrl), {
      signal: AbortSignal.timeout(PLAYGROUND_PORT_PROBE_TIMEOUT_MS),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: null };
  }
}

async function playgroundPathResponds(
  path: string,
  playgroundUrl: string = targetPlaygroundUrl,
): Promise<boolean> {
  const result = await probePlaygroundPath(path, playgroundUrl);
  return result.ok;
}

async function ping(playgroundUrl: string = targetPlaygroundUrl): Promise<boolean> {
  return playgroundPathResponds(livenessPath, playgroundUrl);
}

const PLAYGROUND_FINGERPRINT_HEADER = 'X-Cinder-Playground-Fingerprint';

export function parsePlaygroundFingerprintHeader(
  headerValue: string | null,
): PlaygroundFreshnessFingerprint | null {
  if (headerValue === null) return null;
  try {
    const parsed: unknown = JSON.parse(headerValue);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'startedAtMs' in parsed &&
      'newestSourceMtimeMs' in parsed &&
      typeof (parsed as { startedAtMs: unknown }).startedAtMs === 'number' &&
      (typeof (parsed as { newestSourceMtimeMs: unknown }).newestSourceMtimeMs === 'number' ||
        (parsed as { newestSourceMtimeMs: unknown }).newestSourceMtimeMs === null)
    ) {
      return parsed as PlaygroundFreshnessFingerprint;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchRunningServerFingerprint(
  playgroundUrl: string = targetPlaygroundUrl,
): Promise<PlaygroundFreshnessFingerprint | null> {
  try {
    const response = await fetch(playgroundUrlForPath(warmReadinessPath, playgroundUrl), {
      signal: AbortSignal.timeout(PLAYGROUND_PORT_PROBE_TIMEOUT_MS),
    });
    return parsePlaygroundFingerprintHeader(response.headers.get(PLAYGROUND_FINGERPRINT_HEADER));
  } catch {
    return null;
  }
}

export function stalePlaygroundServerMessage(playgroundUrl: string): string {
  return (
    `Playground server at ${playgroundUrl} is running stale code from a previous session ` +
    '(source files have changed since it started). Refusing to reuse it. Stop it with ' +
    '`bun run kill:playground` (in packages/testing) and rerun, or set ' +
    'PLAYWRIGHT_REUSE_SERVER=0 to always start a fresh server.'
  );
}

/**
 * Decide whether an already-running playground server is safe to reuse.
 *
 * Compares the fingerprint the running server reported at its own startup
 * against the newest source mtime in the CURRENT checkout. If the checkout
 * has files newer than what that server saw when it started, the server is
 * running stale code — refuse reuse rather than silently testing against it
 * (stale servers have produced both false passes and false fails).
 *
 * This is only called for the local default playground URL, i.e. a server
 * this wrapper is entitled to distrust and restart. A `null` fingerprint
 * there does not mean "nothing to compare, assume fresh" — it means the
 * running server predates the fingerprint header entirely (a server left
 * over from before this freshness check existed), which is exactly the
 * stale-reuse case this guard exists to catch. Treat it as stale rather than
 * fresh.
 *
 * Pure function over already-fetched inputs so it is unit-testable without a
 * live server.
 */
export function shouldRefuseStaleServerReuse(
  runningServerFingerprint: PlaygroundFreshnessFingerprint | null,
  currentNewestSourceMtimeMs: number | null,
): boolean {
  if (runningServerFingerprint === null) return true;
  return isFingerprintStale(runningServerFingerprint, currentNewestSourceMtimeMs);
}

export function localPlaygroundUrlForReportedPort(port: number | null): string | null {
  return port === null ? null : localPlaygroundUrlForPort(port);
}

function localPlaygroundUrlForPort(port: number): string {
  return `http://localhost:${port}`;
}

async function readPlaygroundPortFile(path: string): Promise<number | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  const text = await file.text();
  const port = Number(text.trim());
  return Number.isInteger(port) && port > 0 ? port : null;
}

export function parsePlaygroundListeningPort(output: string): number | null {
  const matches = [...output.matchAll(/\[playground\] Listening at http:\/\/localhost:(\d+)/g)];
  const match = matches.at(-1);
  if (!match) return null;
  const port = Number(match[1]);
  return Number.isInteger(port) && port > 0 ? port : null;
}

export function appendServerOutputBuffer(
  currentBuffer: string,
  output: string,
  portHasBeenReported: boolean,
): string {
  const nextBuffer = `${currentBuffer}${output}`;
  if (!portHasBeenReported) return nextBuffer;
  return nextBuffer.length > 4096 ? nextBuffer.slice(-4096) : nextBuffer;
}

function waitForExit(childProcess: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    // Listen for both `exit` and `error`. If `spawn()` fails (ENOENT,
    // EACCES, etc.) the child emits `error` and may never emit `exit`,
    // which would hang the script indefinitely.
    childProcess.once('exit', (code) => resolve(code ?? 1));
    childProcess.once('error', (error) => {
      console.error('Child process error:', error);
      resolve(1);
    });
  });
}

export function childProcessHasFinished(
  childProcess: Pick<ChildProcess, 'pid' | 'exitCode' | 'signalCode'>,
): boolean {
  return (
    childProcess.pid === undefined ||
    childProcess.exitCode !== null ||
    childProcess.signalCode !== null
  );
}

export function finalPlaywrightExitCode(
  playwrightExitCode: number,
  shutdownExitCode: number | null,
): number {
  return shutdownExitCode ?? playwrightExitCode;
}

export function shutdownExitCodeAfterRequest(
  currentExitCode: number | null,
  requestedExitCode: number,
): number {
  if (currentExitCode === null) return requestedExitCode;
  if (currentExitCode >= 128) return currentExitCode;
  return requestedExitCode >= 128 ? requestedExitCode : currentExitCode;
}

export function shouldStartManagedChildProcess(shutdownExitCode: number | null): boolean {
  return shutdownExitCode === null;
}

/**
 * Register SIGINT/SIGTERM handlers that run `cleanup` at most once, then
 * exit with the signal's conventional exit code (130 for SIGINT, 143 for
 * SIGTERM). Shared by every wrapper script that spawns children of its own
 * so an interrupt always tears down the child before the wrapper exits,
 * instead of leaving it orphaned.
 */
export function installSignalCleanupHandlers(runCleanup: () => Promise<void>): void {
  let cleanupPromise: Promise<void> | null = null;

  const cleanupOnce = async (): Promise<void> => {
    cleanupPromise ??= runCleanup();
    await cleanupPromise;
  };

  const exitAfterCleanup = async (code: number): Promise<never> => {
    try {
      await cleanupOnce();
    } catch (error) {
      console.error('Cleanup failed during shutdown:', error);
    }
    process.exit(code);
  };

  process.on('SIGINT', () => {
    void exitAfterCleanup(130);
  });
  process.on('SIGTERM', () => {
    void exitAfterCleanup(143);
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function waitForExitOrTimeout(
  childProcess: ChildProcess,
  timeoutMs: number,
): Promise<boolean> {
  if (childProcessHasFinished(childProcess)) return true;

  const abortController = new AbortController();
  const exitPromise = once(childProcess, 'exit', { signal: abortController.signal }).then(
    () => 'exited' as const,
    (error: unknown) => (isAbortError(error) ? 'aborted' : 'exited'),
  );
  const errorPromise = once(childProcess, 'error', { signal: abortController.signal }).then(
    ([error]) => {
      console.error('Child process error:', error);
      return 'exited' as const;
    },
    (error: unknown) => (isAbortError(error) ? 'aborted' : 'exited'),
  );
  const timeoutPromise = delay(timeoutMs, 'timeout' as const, {
    signal: abortController.signal,
  }).catch((error: unknown) => {
    if (isAbortError(error)) return 'aborted' as const;
    throw error;
  });

  const result = await Promise.race([exitPromise, errorPromise, timeoutPromise]);
  abortController.abort();

  return result === 'exited' || childProcessHasFinished(childProcess);
}

function signalChildProcess(
  managedChildProcess: ManagedChildProcess,
  signal: NodeJS.Signals,
): void {
  const { childProcess, killProcessGroup, name } = managedChildProcess;
  const processId = childProcess.pid;
  if (processId === undefined || childProcessHasFinished(childProcess)) return;

  try {
    if (killProcessGroup && process.platform !== 'win32') {
      process.kill(-processId, signal);
    } else {
      childProcess.kill(signal);
    }
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code !== 'ESRCH') {
      console.error(`Failed to send ${signal} to ${name}:`, error);
    }
  }
}

/**
 * SIGTERM a managed child process, escalating to SIGKILL if it does not exit
 * within `CHILD_PROCESS_TERMINATION_GRACE_MS`. Exported so other wrapper
 * scripts (run-browser-docker.ts, update-snapshots.ts,
 * update-snapshots-docker.ts) can give their own spawned children the same
 * SIGINT/SIGTERM cleanup this script relies on, rather than reimplementing
 * the escalation policy.
 */
export async function terminateChildProcess(
  managedChildProcess: ManagedChildProcess,
): Promise<void> {
  const { childProcess, name } = managedChildProcess;
  if (childProcessHasFinished(childProcess)) return;

  signalChildProcess(managedChildProcess, 'SIGTERM');
  if (await waitForExitOrTimeout(childProcess, CHILD_PROCESS_TERMINATION_GRACE_MS)) return;

  console.error(`${name} did not exit after SIGTERM; sending SIGKILL.`);
  signalChildProcess(managedChildProcess, 'SIGKILL');
  if (!(await waitForExitOrTimeout(childProcess, CHILD_PROCESS_TERMINATION_GRACE_MS))) {
    console.error(`${name} did not exit after SIGKILL; continuing cleanup.`);
  }
}

async function cleanup(
  children: ManagedChildProcess[],
  playgroundPortFile: string | null,
): Promise<void> {
  await Promise.all(children.map((child) => terminateChildProcess(child)));
  if (playgroundPortFile !== null) rmSync(playgroundPortFile, { force: true });
}

export function playgroundBundleDependencyBuildArguments(packageName: string): string[] {
  return ['run', `--filter=${packageName}`, 'build'];
}

export function playgroundBundleDependencyBuildProcess(
  childProcess: ChildProcess,
  packageName: string,
): ManagedChildProcess {
  return {
    childProcess,
    name: `${packageName} build`,
    killProcessGroup: process.platform !== 'win32',
  };
}

export function playgroundServerArguments(): string[] {
  return ['run', 'src/playground-server.ts'];
}

export function playgroundServerWorkingDirectory(): string {
  return playgroundRoot;
}

export function playgroundBundleDependencyBuildPackages(): readonly string[] {
  return playgroundBundleDependencyPackages;
}

export function playgroundWarmReadinessEndpointPath(): string {
  return warmReadinessPath;
}

export function playgroundWarmReadinessMissingEndpointMessage(playgroundUrl: string): string {
  return (
    `Playground server at ${playgroundUrl} responded to ${livenessPath} but returned 404 for ` +
    `${warmReadinessPath}. This usually means a stale playground server is already running; ` +
    'stop the stale server before rerunning the test wrapper. To avoid reusing an already-running ' +
    'server after that, run with PLAYWRIGHT_REUSE_SERVER=0.'
  );
}

async function waitForWarmPlayground(): Promise<void> {
  const startedAt = Date.now();
  const deadline = startedAt + PLAYGROUND_READY_TIMEOUT_MS;
  let stableReadinessReads = 0;
  let lastLog = startedAt;

  while (Date.now() < deadline) {
    const readiness = await probePlaygroundPath(warmReadinessPath);
    if (readiness.ok) {
      stableReadinessReads += 1;
      if (stableReadinessReads >= PLAYGROUND_WARM_READINESS_STABLE_READS) return;
    } else {
      if (readiness.status === 404) {
        throw new Error(playgroundWarmReadinessMissingEndpointMessage(targetPlaygroundUrl));
      }
      stableReadinessReads = 0;
    }

    if (Date.now() - lastLog >= 10_000) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`Waiting for warm playground bundle cache (${elapsed}s elapsed)...`);
      lastLog = Date.now();
    }

    await new Promise<void>((resolve) => setTimeout(resolve, PLAYGROUND_WARM_READINESS_DELAY_MS));
  }

  throw new Error(
    `Playground server did not report a warm bundle cache within ${Math.round(
      PLAYGROUND_READY_TIMEOUT_MS / 1000,
    )}s at ${targetPlaygroundUrl}${warmReadinessPath}.`,
  );
}

async function buildPlaygroundBundleDependencies(
  registerChildProcess: (managedChildProcess: ManagedChildProcess) => void,
  shouldContinueStartingChildProcesses: () => boolean,
): Promise<void> {
  console.log('Building playground bundle dependencies...');
  for (const packageName of playgroundBundleDependencyPackages) {
    if (!shouldContinueStartingChildProcesses()) return;

    const buildProcess = spawn('bun', playgroundBundleDependencyBuildArguments(packageName), {
      cwd: repoRoot,
      detached: process.platform !== 'win32',
      stdio: 'inherit',
      env: process.env,
    });
    registerChildProcess(playgroundBundleDependencyBuildProcess(buildProcess, packageName));
    const buildCode = await waitForExit(buildProcess);
    if (!shouldContinueStartingChildProcesses()) return;
    if (buildCode !== 0) {
      throw new Error(`${packageName} build exited with code ${buildCode}`);
    }
  }
}

const isLocalDefault = isLocalDefaultPlaygroundUrl(PLAYGROUND_URL);

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let serverProcess: ReturnType<typeof spawn> | null = null;
  let playgroundPortFile: string | null = null;
  const children: ManagedChildProcess[] = [];
  let cleanupPromise: Promise<void> | null = null;
  let shutdownExitCode: number | null = null;

  const cleanupOnce = async (): Promise<void> => {
    cleanupPromise ??= cleanup(children, playgroundPortFile);
    await cleanupPromise;
  };

  const exitAfterCleanup = async (code: number): Promise<never> => {
    const exitCode = shutdownExitCodeAfterRequest(shutdownExitCode, code);
    shutdownExitCode = exitCode;
    try {
      await cleanupOnce();
    } catch (error) {
      console.error('Cleanup failed during shutdown:', error);
    }
    process.exit(shutdownExitCode ?? exitCode);
  };

  const exitIfShuttingDown = async (): Promise<void> => {
    if (shutdownExitCode !== null) {
      await exitAfterCleanup(shutdownExitCode);
    }
  };

  process.on('SIGINT', () => {
    void exitAfterCleanup(130);
  });
  process.on('SIGTERM', () => {
    void exitAfterCleanup(143);
  });

  const alreadyUp = await ping();

  if (alreadyUp && reuseOptOut) {
    console.error(
      `Playground server already responding at ${targetPlaygroundUrl}, but PLAYWRIGHT_REUSE_SERVER=0 is set. Stop the running server or unset that variable.`,
    );
    process.exit(1);
  }

  if (alreadyUp && isLocalDefault) {
    // Only the local default server is ours to distrust here — a custom
    // PLAYGROUND_URL points at something we did not start and have no
    // fingerprint contract with.
    const runningServerFingerprint = await fetchRunningServerFingerprint();
    const currentNewestSourceMtimeMs = newestSourceMtimeMs(repoRoot);
    if (shouldRefuseStaleServerReuse(runningServerFingerprint, currentNewestSourceMtimeMs)) {
      console.error(stalePlaygroundServerMessage(targetPlaygroundUrl));
      process.exit(1);
    }
  }

  if (alreadyUp) {
    console.log(`Reusing playground server at ${targetPlaygroundUrl}.`);
  } else if (!isLocalDefault) {
    // The local playground server starts from the local default port and scans
    // upward. Starting it cannot satisfy readiness for a custom `PLAYGROUND_URL`.
    // Fail fast with an actionable message rather than spinning for 120s.
    console.error(
      `Playground server not responding at ${targetPlaygroundUrl}, and it differs from the local default (${DEFAULT_PLAYGROUND_URL}). Start the target server manually before running the suite, or unset PLAYGROUND_URL.`,
    );
    process.exit(1);
  } else {
    console.log(`Starting playground server (target: ${targetPlaygroundUrl})...`);
    await buildPlaygroundBundleDependencies(
      (childProcess) => children.push(childProcess),
      () => shouldStartManagedChildProcess(shutdownExitCode),
    );
    await exitIfShuttingDown();
    playgroundPortFile = resolvePath(repoRoot, 'tmp', `playground-port-${process.pid}.txt`);
    let reportedPlaygroundPort: number | null = null;
    mkdirSync(resolvePath(repoRoot, 'tmp'), { recursive: true });
    rmSync(playgroundPortFile, { force: true });
    serverProcess = spawn('bun', playgroundServerArguments(), {
      cwd: playgroundServerWorkingDirectory(),
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, PLAYGROUND_PORT_FILE: playgroundPortFile },
    });
    children.push({
      childProcess: serverProcess,
      name: 'playground server',
      killProcessGroup: process.platform !== 'win32',
    });

    let serverOutputBuffer = '';
    serverProcess.stdout?.on('data', (chunk: string | Uint8Array) => {
      process.stdout.write(chunk);
      const output = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      serverOutputBuffer = appendServerOutputBuffer(
        serverOutputBuffer,
        output,
        reportedPlaygroundPort !== null,
      );
      reportedPlaygroundPort =
        parsePlaygroundListeningPort(serverOutputBuffer) ?? reportedPlaygroundPort;
      serverOutputBuffer = appendServerOutputBuffer(serverOutputBuffer, '', true);
    });

    const startedAt = Date.now();
    const deadline = startedAt + PLAYGROUND_READY_TIMEOUT_MS;
    let lastLog = startedAt;
    while (Date.now() < deadline) {
      const selectedPort =
        (await readPlaygroundPortFile(playgroundPortFile)) ?? reportedPlaygroundPort;
      const selectedPlaygroundUrl = localPlaygroundUrlForReportedPort(selectedPort);
      if (selectedPlaygroundUrl !== null) {
        targetPlaygroundUrl = selectedPlaygroundUrl;
        if (await ping(selectedPlaygroundUrl)) break;
      } else if (await ping(targetPlaygroundUrl)) {
        // Local runs can start successfully on the default port without writing
        // the file or logging the selected port. Accept direct readiness at the
        // target URL so the wrapper does not hang despite a healthy server.
        break;
      }
      if (Date.now() - lastLog >= 10_000) {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        console.log(
          `Waiting for playground to report its selected port or become ready (${elapsed}s elapsed)...`,
        );
        lastLog = Date.now();
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }

    if (!(await ping())) {
      console.error(
        `Playground server did not become ready within ${Math.round(
          PLAYGROUND_READY_TIMEOUT_MS / 1000,
        )}s at ${targetPlaygroundUrl}.`,
      );
      await exitAfterCleanup(1);
    }
  }

  await exitIfShuttingDown();
  const prep = spawn('bun', ['run', 'scripts/prepare-manifest.ts'], {
    cwd: packageRoot,
    stdio: 'inherit',
    env: { ...process.env, PLAYGROUND_URL: targetPlaygroundUrl },
  });
  children.push({ childProcess: prep, name: 'manifest preparation', killProcessGroup: false });
  const prepCode = await waitForExit(prep);
  await exitIfShuttingDown();
  if (prepCode !== 0) {
    await exitAfterCleanup(prepCode);
  }

  try {
    await waitForWarmPlayground();
  } catch (error) {
    await exitIfShuttingDown();
    await cleanupOnce();
    throw error;
  }
  await exitIfShuttingDown();

  const playwright = spawn('bunx', ['playwright', 'test', ...args], {
    cwd: packageRoot,
    stdio: 'inherit',
    env: { ...process.env, PLAYGROUND_URL: targetPlaygroundUrl },
  });
  children.push({ childProcess: playwright, name: 'Playwright', killProcessGroup: false });
  const playwrightCode = await waitForExit(playwright);
  await exitIfShuttingDown();

  const summary = spawn('bun', ['run', 'scripts/summarize-axe.ts'], {
    cwd: packageRoot,
    stdio: 'inherit',
    env: { ...process.env, PLAYGROUND_URL: targetPlaygroundUrl },
  });
  children.push({ childProcess: summary, name: 'axe summary', killProcessGroup: false });
  const summaryCode = await waitForExit(summary);
  if (summaryCode !== 0) {
    console.error(
      `summarize-axe exited with code ${summaryCode}. Suite exit code reflects Playwright only.`,
    );
  }

  await exitIfShuttingDown();
  await cleanupOnce();
  await exitIfShuttingDown();
  // Summary generation is advisory — only Playwright's result drives the
  // suite exit code so a green run never goes red because of summary
  // failures unless the wrapper received an interrupt signal.
  process.exit(finalPlaywrightExitCode(playwrightCode, shutdownExitCode));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('start-server failed:', error);
    process.exit(1);
  });
}
