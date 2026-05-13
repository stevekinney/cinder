import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const repoRoot = resolve(here, '../../..');
const readinessPath = '/api/manifest';
const reuseOptOut = process.env['PLAYWRIGHT_REUSE_SERVER'] === '0';

async function ping(): Promise<boolean> {
  try {
    const response = await fetch(PLAYGROUND_URL + readinessPath);
    return response.ok;
  } catch {
    return false;
  }
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

const DEFAULT_PLAYGROUND_URL = 'http://localhost:4173';
const isLocalDefault = PLAYGROUND_URL === DEFAULT_PLAYGROUND_URL;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let serverProcess: ReturnType<typeof spawn> | null = null;
  const alreadyUp = await ping();

  if (alreadyUp && reuseOptOut) {
    console.error(
      `Playground server already responding at ${PLAYGROUND_URL}, but PLAYWRIGHT_REUSE_SERVER=0 is set. Stop the running server or unset that variable.`,
    );
    process.exit(1);
  }

  if (alreadyUp) {
    console.log(`Reusing playground server at ${PLAYGROUND_URL}.`);
  } else if (!isLocalDefault) {
    // The local `bun run --filter=@cinder/playground dev` server binds to
    // port 4173 unconditionally — starting it cannot satisfy readiness for
    // a non-default `PLAYGROUND_URL`. Fail fast with an actionable message
    // rather than spinning for 120s.
    console.error(
      `Playground server not responding at ${PLAYGROUND_URL}, and it differs from the local default (${DEFAULT_PLAYGROUND_URL}). Start the target server manually before running the suite, or unset PLAYGROUND_URL.`,
    );
    process.exit(1);
  } else {
    console.log(`Starting playground server (target: ${PLAYGROUND_URL})...`);
    serverProcess = spawn('bun', ['run', '--filter=@cinder/playground', 'dev'], {
      cwd: repoRoot,
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    const startedAt = Date.now();
    const deadline = startedAt + 120_000;
    let lastLog = startedAt;
    while (Date.now() < deadline) {
      if (await ping()) break;
      if (Date.now() - lastLog >= 10_000) {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        console.log(`Waiting for playground at ${PLAYGROUND_URL} (${elapsed}s elapsed)...`);
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
      console.error(`Playground server did not become ready within 120s at ${PLAYGROUND_URL}.`);
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
    env: { ...process.env },
  });
  children.push(playwright);
  const playwrightCode = await waitForExit(playwright);

  const summary = spawn('bun', ['run', 'scripts/summarize-axe.ts'], {
    cwd: packageRoot,
    stdio: 'inherit',
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

main().catch((error: unknown) => {
  console.error('start-server failed:', error);
  process.exit(1);
});
