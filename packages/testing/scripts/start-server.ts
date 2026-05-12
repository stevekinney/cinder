import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const repoRoot = resolve(here, '../../..');
const serverUrl = 'http://localhost:4173';
const readinessPath = '/api/manifest';

async function ping(): Promise<boolean> {
  try {
    const response = await fetch(serverUrl + readinessPath);
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
  const reuseServer = process.env['PLAYWRIGHT_REUSE_SERVER'] === '1';

  let serverProcess: ReturnType<typeof spawn> | null = null;
  const alreadyUp = await ping();

  if (alreadyUp && !reuseServer) {
    console.error(
      'Port 4173 is already in use. Stop the running server or set PLAYWRIGHT_REUSE_SERVER=1 to reuse it.',
    );
    process.exit(1);
  }

  if (!alreadyUp) {
    serverProcess = spawn('bun', ['run', '--filter=@cinder/playground', 'dev'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (await ping()) break;
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }

    if (!(await ping())) {
      serverProcess.kill('SIGTERM');
      console.error('Playground server did not become ready within 120s.');
      process.exit(1);
    }
  }

  const cleanup = (): void => {
    if (serverProcess !== null && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
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
  const playwrightCode = await waitForExit(playwright);

  const summary = spawn('bun', ['run', 'scripts/summarize-axe.ts'], {
    cwd: packageRoot,
    stdio: 'inherit',
  });
  await waitForExit(summary);

  cleanup();
  process.exit(playwrightCode);
}

main().catch((error: unknown) => {
  console.error('start-server failed:', error);
  process.exit(1);
});
