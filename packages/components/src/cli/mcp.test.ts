import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'bun:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    } finally {
      await client.close();
    }

    expect(stderrChunks.join('').trim()).toBe('');
  });
});
