import { loadCinderKnowledge } from '@lostgradient/cinder/knowledge';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerPrompts } from './prompts.js';
import { registerResources } from './resources.js';
import { registerTools } from './tools.js';

const packageDirectory = dirname(fileURLToPath(import.meta.url));

/**
 * `dist/server.js` and `src/server.ts` are both one directory below the
 * package root, so this resolves correctly whether the caller loaded the
 * built module or (inside this workspace) the source directly.
 */
function readOwnPackageVersion(): string {
  const packageJsonPath = join(packageDirectory, '..', 'package.json');
  const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    typeof (parsed as { version: unknown }).version !== 'string'
  ) {
    throw new Error(`${packageJsonPath} is missing a string "version" field.`);
  }
  return (parsed as { version: string }).version;
}

/** Build the Cinder MCP server: load knowledge, register tools/resources/prompts. */
export async function createMcpServer(): Promise<McpServer> {
  const knowledge = await loadCinderKnowledge();
  const server = new McpServer({
    name: 'cinder',
    version: readOwnPackageVersion(),
  });
  registerTools(server, knowledge);
  registerResources(server, knowledge);
  registerPrompts(server);
  return server;
}

/** Connect the Cinder MCP server over stdio and keep it running until stdin closes. */
export async function runMcpServer(): Promise<void> {
  const server = await createMcpServer();
  await server.connect(new StdioServerTransport());
  await new Promise<void>((resolve) => {
    const close = () => {
      process.stdin.off('close', close);
      process.stdin.off('end', close);
      resolve();
    };
    process.stdin.once('close', close);
    process.stdin.once('end', close);
  });
}
