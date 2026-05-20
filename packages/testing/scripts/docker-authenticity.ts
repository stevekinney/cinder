import { existsSync, readFileSync } from 'node:fs';

export type AuthenticityFailure = {
  check: string;
  expected: string;
  actual: string;
};

export type AuthenticityResult =
  | { ok: true; playwrightVersion: string }
  | { ok: false; failures: AuthenticityFailure[] };

function readPinnedPlaywrightVersion(packageJsonPath: string): string {
  const raw = readFileSync(packageJsonPath, 'utf8');
  const parsed = JSON.parse(raw) as { devDependencies?: Record<string, string> };
  const pinned = parsed.devDependencies?.['@playwright/test'];
  if (!pinned) {
    throw new Error(`@playwright/test is not declared in ${packageJsonPath}`);
  }
  if (/^[\^~]/.test(pinned)) {
    throw new Error(
      `@playwright/test must be exact-pinned (no ^ or ~) in ${packageJsonPath}; got "${pinned}"`,
    );
  }
  return pinned;
}

function readOsReleaseId(): string | undefined {
  if (!existsSync('/etc/os-release')) return undefined;
  const raw = readFileSync('/etc/os-release', 'utf8');
  const match = /^VERSION_CODENAME=(.+)$/m.exec(raw);
  return match?.[1]?.replace(/['"]/g, '').trim();
}

async function readInstalledPlaywrightVersion(): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(['playwright', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exit = await proc.exited;
    if (exit !== 0) return undefined;
    const output = await new Response(proc.stdout).text();
    // Output format: "Version 1.60.0"
    const match = /Version\s+(\S+)/i.exec(output);
    return match?.[1];
  } catch {
    // ENOENT etc. — playwright binary is not on PATH (typical on a dev host
    // without `bunx playwright install`). Treat as missing rather than
    // crashing the authenticity check.
    return undefined;
  }
}

export async function checkDockerAuthenticity(
  packageJsonPath: string,
): Promise<AuthenticityResult> {
  const failures: AuthenticityFailure[] = [];
  const pinned = readPinnedPlaywrightVersion(packageJsonPath);

  // Check 1: OS is Ubuntu jammy (22.04). This is the canonical Playwright image base.
  const codename = readOsReleaseId();
  if (codename !== 'jammy') {
    failures.push({
      check: 'os-release VERSION_CODENAME',
      expected: 'jammy',
      actual: codename ?? '<missing /etc/os-release>',
    });
  }

  // Check 2: installed Playwright matches the package.json pin.
  const installed = await readInstalledPlaywrightVersion();
  if (installed !== pinned) {
    failures.push({
      check: 'playwright --version vs package.json pin',
      expected: pinned,
      actual: installed ?? '<playwright not found>',
    });
  }

  // Check 3: CINDER_PLAYWRIGHT_VERSION env was baked into the image at build,
  // and it matches the pin. This proves the running container was built from
  // *this* repo's Dockerfile, not an arbitrary container the user set
  // PLAYWRIGHT_DOCKER=1 inside.
  const baked = process.env['CINDER_PLAYWRIGHT_VERSION'];
  if (baked !== pinned) {
    failures.push({
      check: 'CINDER_PLAYWRIGHT_VERSION baked at image build',
      expected: pinned,
      actual: baked ?? '<env var unset — likely not inside the cinder-playwright image>',
    });
  }

  if (failures.length > 0) return { ok: false, failures };
  return { ok: true, playwrightVersion: pinned };
}

export function formatFailures(failures: AuthenticityFailure[]): string {
  const lines: string[] = [
    'Refusing to update snapshots: this process is not running inside the canonical cinder-playwright Docker image.',
    '',
    'Failed checks:',
  ];
  for (const failure of failures) {
    lines.push(
      `  - ${failure.check}`,
      `      expected: ${failure.expected}`,
      `      actual:   ${failure.actual}`,
    );
  }
  lines.push(
    '',
    'macOS / Linux dev hosts cannot author baselines — pixel rendering differs from CI.',
    'Run "bun run --filter=@cinder/testing test:browser:update:docker" instead.',
  );
  return lines.join('\n');
}
