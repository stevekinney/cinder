import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'bun:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isModuleNotFoundError } from './mcp.ts';

const cliDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(cliDirectory, '../..');
const cliEntrypoint = join(cliDirectory, 'index.ts');

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function textContent(result: unknown): string {
  if (!isRecord(result) || !Array.isArray(result['content'])) return '';
  const item = result['content'].find(
    (entry): entry is { type: 'text'; text: string } =>
      isRecord(entry) && entry['type'] === 'text' && typeof entry['text'] === 'string',
  );
  return item?.text ?? '';
}

async function readResourceError(client: Client, uri: string): Promise<McpError> {
  try {
    await client.readResource({ uri });
  } catch (error: unknown) {
    if (error instanceof McpError) return error;
    throw error;
  }
  throw new Error(`Expected ${uri} to fail.`);
}

function errorData(error: McpError): Record<string, unknown> {
  const { data } = error;
  if (!isRecord(data) || !isRecord(data['error'])) {
    throw new Error('Expected MCP error data to contain an error payload.');
  }
  return data['error'];
}

describe('cinder MCP server', () => {
  it('serves tools, resources, and prompts over stdio without stderr noise', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [cliEntrypoint, 'mcp'],
      cwd: packageRoot,
      env: { ...Bun.env, TZ: 'UTC', LANG: 'en_US.UTF-8' },
      stderr: 'pipe',
    });
    const stderrChunks: string[] = [];
    transport.stderr?.on('data', (chunk) => {
      stderrChunks.push(String(chunk));
    });

    const client = new Client({ name: 'cinder-cli-test', version: '0.0.0' });
    await client.connect(transport);

    try {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((tool) => tool.name);
      toolNames.sort();
      expect(toolNames).toEqual([
        'compare_components',
        'get_best_practices',
        'get_component',
        'search_components',
      ]);

      const resources = await client.listResources();
      const resourceUris = resources.resources.map((resource) => resource.uri);
      expect(resourceUris).toContain('cinder://manifest');
      expect(resourceUris).toContain('cinder://component/button');

      const resourceTemplates = await client.listResourceTemplates();
      const templateUris = resourceTemplates.resourceTemplates.map(
        (template) => template.uriTemplate,
      );
      expect(templateUris).toContain('cinder://component/{id}/schema');
      expect(templateUris).toContain('cinder://component/{id}/variables');
      expect(templateUris).toContain('cinder://component/{id}/examples');
      expect(templateUris).toContain('cinder://component/{id}/constraints');

      const prompts = await client.listPrompts();
      const promptNames = prompts.prompts.map((prompt) => prompt.name);
      promptNames.sort();
      expect(promptNames).toEqual(['choose_cinder_component', 'review_cinder_usage']);

      const search = await client.callTool({
        name: 'search_components',
        arguments: { query: 'modal', limit: 5 },
      });
      expect(textContent(search)).toContain('"id": "modal"');

      const component = await client.readResource({ uri: 'cinder://component/button' });
      const firstComponent = component.contents[0];
      expect(firstComponent && 'text' in firstComponent ? firstComponent.text : '').toContain(
        '"id": "button"',
      );

      const missingComponent = await readResourceError(client, 'cinder://component/buton');
      expect(missingComponent.code).toBe(ErrorCode.InvalidParams);
      const missingComponentData = errorData(missingComponent);
      expect(missingComponentData['code']).toBe('COMPONENT_NOT_FOUND');
      expect(missingComponentData['message']).toBe('Unknown Cinder component "buton".');
      expect(missingComponentData['suggestions']).toContain('button');

      const missingArtifact = await readResourceError(
        client,
        'cinder://component/access-gate/constraints',
      );
      expect(missingArtifact.code).toBe(ErrorCode.InvalidParams);
      const missingArtifactData = errorData(missingArtifact);
      expect(missingArtifactData['code']).toBe('ARTIFACT_NOT_FOUND');
      expect(missingArtifactData['message']).toBe(
        'access-gate does not ship a constraints artifact.',
      );
      expect(missingArtifactData['suggestions']).toContain('access-gate');
    } finally {
      await client.close();
    }

    expect(stderrChunks.join('').trim()).toBe('');
  });
});

// zod and @modelcontextprotocol/sdk moved to optional peerDependencies
// (package-boundaries.md, Phase 0): every consumer of the component library
// no longer has to install them, only users of the `mcp` CLI command do. If
// they're missing, `loadMcpDependencies` should rewrite the raw
// module-resolution error into one actionable message rather than letting a
// "Cannot find package 'zod'" stack trace reach the user. This can't be
// exercised end-to-end without actually uninstalling a workspace
// devDependency, so it tests the classifier that decision hinges on
// directly, against both the codes and message shapes Bun/Node use for a
// missing module.
describe('isModuleNotFoundError', () => {
  it('recognises Node/Bun module-not-found error codes', () => {
    const error = new Error("Cannot find package 'zod' imported from mcp.ts");
    (error as NodeJS.ErrnoException).code = 'ERR_MODULE_NOT_FOUND';
    expect(isModuleNotFoundError(error)).toBe(true);
  });

  it('recognises the legacy MODULE_NOT_FOUND code', () => {
    const error = new Error("Cannot find module '@modelcontextprotocol/sdk/server/mcp.js'");
    (error as NodeJS.ErrnoException).code = 'MODULE_NOT_FOUND';
    expect(isModuleNotFoundError(error)).toBe(true);
  });

  it('falls back to message sniffing when no error code is set', () => {
    expect(isModuleNotFoundError(new Error("Cannot find package 'zod'"))).toBe(true);
    expect(isModuleNotFoundError(new Error("Cannot find module './missing.ts'"))).toBe(true);
  });

  it('does not misclassify unrelated errors', () => {
    expect(isModuleNotFoundError(new Error('zod threw while parsing input'))).toBe(false);
    expect(isModuleNotFoundError(new TypeError('unexpected token'))).toBe(false);
    expect(isModuleNotFoundError('not an Error instance')).toBe(false);
    expect(isModuleNotFoundError(undefined)).toBe(false);
  });
});
