import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const repoRoot = resolve(here, '../../..');
const playgroundUrl = process.env['PLAYGROUND_URL'] ?? 'http://localhost:4173';
const readinessPath = '/api/manifest';
const reuseOptOut = process.env['PLAYWRIGHT_REUSE_SERVER'] === '0';

async function ping(): Promise<boolean> {
  try {
    const response = await fetch(playgroundUrl + readinessPath);
    return response.ok;
  } catch {
    return false;
  }
}

function waitForExit(childProcess: ReturnType<typeof spawn>): Promise<number> {
  return new Promise((resolve) => {
    childProcess.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let serverProcess: ReturnType<typeof spawn> | null = null;
  const alreadyUp = await ping();

  if (alreadyUp && reuseOptOut) {
    console.error(
      `Playground server already responding at ${playgroundUrl}, but PLAYWRIGHT_REUSE_SERVER=0 is set. Stop the running server or unset that variable.`,
    );
    process.exit(1);
  }

  if (alreadyUp) {
    console.log(`Reusing playground server at ${playgroundUrl}.`);
  } else {
    console.log(`Starting playground server (target: ${playgroundUrl})...`);
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
        console.log(`Waiting for playground at ${playgroundUrl} (${elapsed}s elapsed)...`);
        lastLog = Date.now();
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }

    if (!(await ping())) {
      serverProcess.kill('SIGTERM');
      console.error(`Playground server did not become ready within 120s at ${playgroundUrl}.`);
      process.exit(1);
    }
  }

  const children: Array<ReturnType<typeof spawn>> = [];
  if (serverProcess !== null) children.push(serverProcess);

  const cleanup = (): void => {
    for (const child of children) {
      if (!child.killed) child.kill('SIGTERM');
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
