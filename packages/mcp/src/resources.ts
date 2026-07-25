import type { CinderKnowledge } from '@lostgradient/cinder/knowledge';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

import { resourceError } from './errors.js';

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function jsonResource(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: jsonText(value),
      },
    ],
  };
}

async function readJsonResource(uri: URL, read: () => Promise<unknown>) {
  try {
    return jsonResource(uri.href, await read());
  } catch (error: unknown) {
    resourceError(error);
  }
}

function firstVariable(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function componentResourceList(knowledge: CinderKnowledge, suffix = '') {
  return {
    resources: knowledge
      .list()
      .filter((component) => {
        if (suffix === '/examples') return component.hasExamples;
        if (suffix === '/constraints') return component.hasConstraints;
        return true;
      })
      .map((component) => ({
        uri: `cinder://component/${component.id}${suffix}`,
        name: `${component.id}${suffix.replace('/', '-') || '-component'}`,
        title: `${component.name}${suffix ? ` ${suffix.slice(1)}` : ''}`,
        description: component.purpose,
        mimeType: 'application/json',
      })),
  };
}

/** Register the manifest resource plus the per-component resource templates on `server`. */
export function registerResources(server: McpServer, knowledge: CinderKnowledge): void {
  server.registerResource(
    'manifest',
    'cinder://manifest',
    {
      title: 'Cinder manifest',
      description: 'The full generated Cinder component manifest.',
      mimeType: 'application/json',
    },
    (uri) => jsonResource(uri.href, knowledge.manifest),
  );

  const complete = {
    id: (value: string) =>
      knowledge
        .componentIds()
        .filter((id) => id.startsWith(value))
        .slice(0, 20),
  };

  server.registerResource(
    'component',
    new ResourceTemplate('cinder://component/{id}', {
      list: () => componentResourceList(knowledge),
      complete,
    }),
    {
      title: 'Cinder component',
      description: 'Manifest guidance and generated artifacts for one Cinder component.',
      mimeType: 'application/json',
    },
    async (uri, variables) =>
      readJsonResource(uri, () => knowledge.show(firstVariable(variables['id']))),
  );

  for (const artifact of ['schema', 'variables', 'examples', 'constraints'] as const) {
    server.registerResource(
      `component-${artifact}`,
      new ResourceTemplate(`cinder://component/{id}/${artifact}`, {
        list: () => componentResourceList(knowledge, `/${artifact}`),
        complete,
      }),
      {
        title: `Cinder component ${artifact}`,
        description: `Generated ${artifact} artifact for one Cinder component.`,
        mimeType: 'application/json',
      },
      async (uri, variables) =>
        readJsonResource(uri, () => knowledge.artifact(firstVariable(variables['id']), artifact)),
    );
  }
}
