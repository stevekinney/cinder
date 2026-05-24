import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';
import { DEFAULT_PLAYGROUND_URL, isLocalDefaultPlaygroundUrl } from './playground-server-url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolvePath(here, '..');
const repoRoot = resolvePath(here, '../../..');
// Probe the cheap liveness endpoint first. `/api/manifest` does real work and
// can lag behind initial server readiness, which makes local startup look hung
// even though the playground is already accepting requests.
const readinessPath = '/ping';
const reuseOptOut = process.env['PLAYWRIGHT_REUSE_SERVER'] === '0';
let targetPlaygroundUrl = PLAYGROUND_URL;
const PLAYGROUND_PORT_PROBE_TIMEOUT_MS = 500;
const PLAYGROUND_READY_TIMEOUT_MS = 240_000;

async function ping(playgroundUrl: string = targetPlaygroundUrl): Promise<boolean> {
  try {
    const response = await fetch(playgroundUrl + readinessPath, {
      signal: AbortSignal.timeout(PLAYGROUND_PORT_PROBE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
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

function waitForExit(childProcess: ReturnType<typeof spawn>): Promise<number> {
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

const isLocalDefault = isLocalDefaultPlaygroundUrl(PLAYGROUND_URL);

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let serverProcess: ReturnType<typeof spawn> | null = null;
  let playgroundPortFile: string | null = null;
  const alreadyUp = await ping();

  if (alreadyUp && reuseOptOut) {
    console.error(
      `Playground server already responding at ${targetPlaygroundUrl}, but PLAYWRIGHT_REUSE_SERVER=0 is set. Stop the running server or unset that variable.`,
    );
    process.exit(1);
  }

  if (alreadyUp) {
    console.log(`Reusing playground server at ${targetPlaygroundUrl}.`);
  } else if (!isLocalDefault) {
    // The local `bun run --filter=@cinder/playground dev` server starts from
    // the local default port and scans upward. Starting it cannot satisfy
    // readiness for a custom `PLAYGROUND_URL`. Fail fast with an actionable
    // message rather than spinning for 120s.
    console.error(
      `Playground server not responding at ${targetPlaygroundUrl}, and it differs from the local default (${DEFAULT_PLAYGROUND_URL}). Start the target server manually before running the suite, or unset PLAYGROUND_URL.`,
    );
    process.exit(1);
  } else {
    console.log(`Starting playground server (target: ${targetPlaygroundUrl})...`);
    playgroundPortFile = resolvePath(repoRoot, 'tmp', `playground-port-${process.pid}.txt`);
    let reportedPlaygroundPort: number | null = null;
    mkdirSync(resolvePath(repoRoot, 'tmp'), { recursive: true });
    rmSync(playgroundPortFile, { force: true });
    serverProcess = spawn('bun', ['run', '--filter=@cinder/playground', 'dev'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, PLAYGROUND_PORT_FILE: playgroundPortFile },
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
        // `bun --watch` should preserve PLAYGROUND_PORT_FILE, but local
        // runs can start successfully on the default port without writing the
        // file or logging the selected port. Accept direct readiness at the
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
      try {
        serverProcess.kill('SIGTERM');
      } catch (error) {
        console.error('Failed to kill unready server process:', error);
      }
      console.error(
        `Playground server did not become ready within ${Math.round(
          PLAYGROUND_READY_TIMEOUT_MS / 1000,
        )}s at ${targetPlaygroundUrl}.`,
      );
      if (playgroundPortFile !== null) rmSync(playgroundPortFile, { force: true });
      process.exit(1);
    }
  }

  const children: Array<ReturnType<typeof spawn>> = [];
  if (serverProcess !== null) children.push(serverProcess);

  const cleanup = (): void => {
    for (const child of children) {
      // Skip already-exited processes (exitCode/signalCode set) and wrap
      // kill() in try/catch — ChildProcess.kill() can throw ESRCH if the
      // PID has been reaped between the check and the call, and an
      // uncaught throw would block cleanup of the remaining children.
      if (child.killed || child.exitCode !== null || child.signalCode !== null) continue;
      try {
        child.kill('SIGTERM');
      } catch (error) {
        console.error('Failed to kill child process:', error);
      }
    }
    if (playgroundPortFile !== null) rmSync(playgroundPortFile, { force: true });
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  const prep = spawn('bun', ['run', 'scripts/prepare-manifest.ts'], {
    cwd: packageRoot,
    stdio: 'inherit',
    env: { ...process.env, PLAYGROUND_URL: targetPlaygroundUrl },
  });
  children.push(prep);
  const prepCode = await waitForExit(prep);
  if (prepCode !== 0) {
    cleanup();
    process.exit(prepCode);
  }

  const playwright = spawn('bunx', ['playwright', 'test', ...args], {
    cwd: packageRoot,
    stdio: 'inherit',
    env: { ...process.env, PLAYGROUND_URL: targetPlaygroundUrl },
  });
  children.push(playwright);
  const playwrightCode = await waitForExit(playwright);

  const summary = spawn('bun', ['run', 'scripts/summarize-axe.ts'], {
    cwd: packageRoot,
    stdio: 'inherit',
    env: { ...process.env, PLAYGROUND_URL: targetPlaygroundUrl },
  });
  children.push(summary);
  const summaryCode = await waitForExit(summary);
  if (summaryCode !== 0) {
    console.error(
      `summarize-axe exited with code ${summaryCode}. Suite exit code reflects Playwright only.`,
    );
  }

  cleanup();
  // Summary generation is advisory — only Playwright's result drives the
  // suite exit code so a green run never goes red because of summary
  // failures.
  process.exit(playwrightCode);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('start-server failed:', error);
    process.exit(1);
  });
}
