import { describe, expect, it } from 'bun:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(cliDirectory, '../..');
const cliEntrypoint = join(cliDirectory, 'index.ts');

type CliResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

function runCli(args: string[]): CliResult {
  const result = Bun.spawnSync({
    cmd: [process.execPath, cliEntrypoint, ...args],
    cwd: packageRoot,
    env: { ...Bun.env, TZ: 'UTC', LANG: 'en_US.UTF-8' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const decoder = new TextDecoder();
  return {
    exitCode: result.exitCode,
    stdout: decoder.decode(result.stdout),
    stderr: decoder.decode(result.stderr),
  };
}

function parseJson(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

describe('cinder CLI', () => {
  it('prints help without loading MCP or writing stderr', () => {
    const result = runCli(['--help']);

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('cinder search <query>');
    expect(result.stdout).toContain('cinder mcp');
  });

  it('prints search results in the JSON envelope', () => {
    const result = runCli(['search', 'modal', '--json']);
    const payload = parseJson(result.stdout);
    const data = payload['data'];

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(payload['command']).toBe('search');
    expect(isRecord(payload['package']) && payload['package']['name']).toBe('@lostgradient/cinder');
    expect(Array.isArray(data)).toBe(true);
    expect((data as Array<{ id: string }>).some((component) => component.id === 'modal')).toBe(
      true,
    );
  });

  it('prints component details in the JSON envelope', () => {
    const result = runCli(['show', 'button', '--json']);
    const payload = parseJson(result.stdout);
    const data = payload['data'];

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(payload['command']).toBe('show');
    expect(isRecord(data)).toBe(true);
    expect(isRecord(data) && isRecord(data['component']) && data['component']['id']).toBe('button');
    expect(isRecord(data) && data['schema']).toBeDefined();
    expect(isRecord(data) && data['variables']).toBeDefined();
  });

  it('prints best-practice payloads in the JSON envelope', () => {
    const result = runCli(['best-practices', 'styles', '--json']);
    const payload = parseJson(result.stdout);
    const data = payload['data'];

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(payload['command']).toBe('best-practices');
    expect(Array.isArray(data)).toBe(true);
    expect((data as Array<{ topic: string }>)[0]?.topic).toBe('styles');
  });

  it('prints JSON-mode failures to stdout with no stderr noise', () => {
    const result = runCli(['show', 'buton', '--json']);
    const payload = parseJson(result.stdout);
    const error = payload['error'];

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(isRecord(error)).toBe(true);
    expect(isRecord(error) && error['code']).toBe('COMPONENT_NOT_FOUND');
    expect(isRecord(error) && Array.isArray(error['suggestions'])).toBe(true);
  });

  it('rejects non-numeric limit suffixes', () => {
    const result = runCli(['search', 'button', '--limit', '10abc', '--json']);
    const payload = parseJson(result.stdout);
    const error = payload['error'];

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(isRecord(error) && error['code']).toBe('BAD_LIMIT');
  });
});
