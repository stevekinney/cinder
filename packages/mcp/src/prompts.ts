import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/** Register the two Cinder-usage guidance prompts on `server`. */
export function registerPrompts(server: McpServer): void {
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
