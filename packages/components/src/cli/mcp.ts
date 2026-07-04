import * as z from 'zod/v4';

import { CinderKnowledgeError, loadCinderKnowledge, type CinderKnowledge } from './knowledge.ts';
import type { BestPracticeTopic } from './types.ts';

type McpServerModule = typeof import('@modelcontextprotocol/sdk/server/mcp.js');
type McpTypesModule = typeof import('@modelcontextprotocol/sdk/types.js');
type McpErrorDependencies = {
  ErrorCode: McpTypesModule['ErrorCode'];
  McpError: McpTypesModule['McpError'];
};

function textResult(text: string, structuredContent?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent,
  };
}

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function errorPayload(error: unknown) {
  return {
    code: error instanceof CinderKnowledgeError ? error.code : 'UNEXPECTED_ERROR',
    message: error instanceof Error ? error.message : String(error),
    suggestions: error instanceof CinderKnowledgeError ? error.suggestions : [],
  };
}

function toolError(error: unknown) {
  const payload = errorPayload(error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: payload.message }],
    structuredContent: { error: payload },
  };
}

function resourceError(error: unknown, dependencies: McpErrorDependencies): never {
  const payload = errorPayload(error);
  const protocolCode =
    error instanceof CinderKnowledgeError
      ? dependencies.ErrorCode.InvalidParams
      : dependencies.ErrorCode.InternalError;
  throw new dependencies.McpError(protocolCode, payload.message, { error: payload });
}

function firstVariable(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
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

async function readJsonResource(
  uri: URL,
  read: () => Promise<unknown>,
  dependencies: McpErrorDependencies,
) {
  try {
    return jsonResource(uri.href, await read());
  } catch (error: unknown) {
    resourceError(error, dependencies);
  }
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

function searchOptionsFromArgs(args: {
  category?: string | undefined;
  status?: string | undefined;
  tag?: string | undefined;
  limit?: number | undefined;
}) {
  const options: {
    category?: string;
    status?: string;
    tag?: string;
    limit?: number;
  } = {};
  if (args.category !== undefined) options.category = args.category;
  if (args.status !== undefined) options.status = args.status;
  if (args.tag !== undefined) options.tag = args.tag;
  if (args.limit !== undefined) options.limit = args.limit;
  return options;
}

function registerTools(
  server: InstanceType<McpServerModule['McpServer']>,
  knowledge: CinderKnowledge,
): void {
  server.registerTool(
    'search_components',
    {
      title: 'Search Cinder components',
      description:
        'Search Cinder components by purpose, id, tag, category, guidance, or overlap family.',
      inputSchema: z.object({
        query: z.string().min(1),
        category: z.string().optional(),
        status: z.string().optional(),
        tag: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    },
    async (args) => {
      try {
        const data = knowledge.search(args.query, searchOptionsFromArgs(args));
        return textResult(jsonText(data), { results: data });
      } catch (error: unknown) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_component',
    {
      title: 'Get Cinder component',
      description:
        'Return manifest guidance plus schema, variables, examples, and constraints for one component.',
      inputSchema: z.object({ id: z.string().min(1) }),
    },
    async ({ id }) => {
      try {
        const data = await knowledge.show(id);
        return textResult(jsonText(data), { component: data });
      } catch (error: unknown) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'compare_components',
    {
      title: 'Compare Cinder components',
      description:
        'Compare two or more Cinder components using manifest useWhen, avoidWhen, and overlap guidance.',
      inputSchema: z.object({ ids: z.array(z.string().min(1)).min(2).max(12) }),
    },
    async ({ ids }) => {
      try {
        const data = knowledge.compare(ids);
        return textResult(jsonText(data), { comparison: data });
      } catch (error: unknown) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_best_practices',
    {
      title: 'Get Cinder best practices',
      description: 'Return Cinder import, style, metadata, and overlap decision guidance.',
      inputSchema: z.object({
        topic: z.enum(['imports', 'styles', 'metadata', 'overlap', 'all']).optional(),
      }),
    },
    async ({ topic }) => {
      try {
        const selectedTopic = (topic ?? 'all') as BestPracticeTopic;
        const data = knowledge.bestPractices(selectedTopic);
        return textResult(jsonText(data), { sections: data });
      } catch (error: unknown) {
        return toolError(error);
      }
    },
  );
}

function registerResources(
  server: InstanceType<McpServerModule['McpServer']>,
  knowledge: CinderKnowledge,
  ResourceTemplate: McpServerModule['ResourceTemplate'],
  dependencies: McpErrorDependencies,
): void {
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
      readJsonResource(uri, () => knowledge.show(firstVariable(variables['id'])), dependencies),
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
        readJsonResource(
          uri,
          () => knowledge.artifact(firstVariable(variables['id']), artifact),
          dependencies,
        ),
    );
  }
}

function registerPrompts(server: InstanceType<McpServerModule['McpServer']>): void {
  server.registerPrompt(
    'choose_cinder_component',
    {
      title: 'Choose a Cinder component',
      description: 'Guide an agent to choose an appropriate Cinder component before writing UI.',
      argsSchema: {
        goal: z.string().optional(),
        constraints: z.string().optional(),
      },
    },
    ({ goal, constraints }) => {
      const constraintsLine = constraints ? `Constraints: ${constraints}\n` : '';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text:
                `Choose the best @lostgradient/cinder component for this UI task: ${goal ?? 'unspecified task'}.\n` +
                constraintsLine +
                'Use search_components first, then compare_components for close alternatives, and read get_component before recommending code.',
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    'review_cinder_usage',
    {
      title: 'Review Cinder usage',
      description:
        'Review code for Cinder import, style, metadata, and component-choice best practices.',
      argsSchema: {
        code: z.string(),
        componentId: z.string().optional(),
      },
    },
    ({ code, componentId }) => {
      const componentLine = componentId ? `Focus component: ${componentId}\n` : '';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text:
                'Review this code for @lostgradient/cinder usage. Check component choice, imports, styles, constraints, and accessibility guidance.\n' +
                componentLine +
                `\n${code}`,
            },
          },
        ],
      };
    },
  );
}

export async function createMcpServer() {
  const [{ McpServer, ResourceTemplate }, { ErrorCode, McpError }, knowledge] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/mcp.js'),
    import('@modelcontextprotocol/sdk/types.js'),
    loadCinderKnowledge(),
  ]);
  const server = new McpServer({
    name: 'cinder',
    version: knowledge.package.version,
  });
  registerTools(server, knowledge);
  registerResources(server, knowledge, ResourceTemplate, { ErrorCode, McpError });
  registerPrompts(server);
  return server;
}

export async function runMcpServer(): Promise<void> {
  const [{ StdioServerTransport }, server] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/stdio.js'),
    createMcpServer(),
  ]);
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
