import type { BestPracticeTopic, CinderKnowledge } from '@lostgradient/cinder/knowledge';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { toolError } from './errors.js';

function textResult(text: string, structuredContent?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent,
  };
}

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
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

/** Register the four read-only Cinder discovery tools on `server`. */
export function registerTools(server: McpServer, knowledge: CinderKnowledge): void {
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
        const selectedTopic: BestPracticeTopic = topic ?? 'all';
        const data = knowledge.bestPractices(selectedTopic);
        return textResult(jsonText(data), { sections: data });
      } catch (error: unknown) {
        return toolError(error);
      }
    },
  );
}
