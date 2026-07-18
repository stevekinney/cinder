import { beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import type { GenerateExamplesResult } from '../../components/scripts/generate-component-examples.ts';
import { checkChatExamplesDrift, generateChatExamples } from './generate-component-artifacts.ts';

let generatedExamples: GenerateExamplesResult;

beforeAll(async () => {
  generatedExamples = await generateChatExamples();
});

describe('Chat example artifacts', () => {
  test('regenerates every committed sidecar from playground source examples', async () => {
    expect(generatedExamples.errors).toEqual([]);
    expect(generatedExamples.exclusions).toEqual([]);
    expect(
      generatedExamples.exampleSets.map((exampleSet) => ({
        component: exampleSet.component,
        import: exampleSet.import,
        examples: exampleSet.examples.map((example) => example.id),
      })),
    ).toEqual([
      {
        component: 'chat',
        import: '@lostgradient/chat',
        examples: [
          'adapter-streaming',
          'basic',
          'density-and-variant',
          'full-height-layout',
          'interactive-harness',
          'streaming',
          'with-reasoning-and-steps',
          'with-suggestions',
          'with-tool-approval',
          'with-tool-calls',
        ],
      },
      {
        component: 'chat-composer-popover',
        import: '@lostgradient/chat/composer-popover',
        examples: ['slash-commands'],
      },
      {
        component: 'chat-conversation-header',
        import: '@lostgradient/chat/conversation-header',
        examples: ['basic'],
      },
      {
        component: 'chat-conversation-list',
        import: '@lostgradient/chat/conversation-list',
        examples: ['basic'],
      },
    ]);
    expect(await checkChatExamplesDrift(generatedExamples)).toEqual([]);
  });

  test('reports stale output when generated example content changes', async () => {
    const changedExamples = structuredClone(generatedExamples);
    changedExamples.exampleSets[0]!.examples[0]!.description += ' Changed.';

    expect(await checkChatExamplesDrift(changedExamples)).toEqual([
      'chat/chat.examples.json (stale)',
    ]);
  });

  test('reports a sidecar in an entirely orphaned component directory', async () => {
    const orphanDirectory = join(import.meta.dir, 'fixtures', 'retired-chat');
    const issues = await checkChatExamplesDrift(generatedExamples, {
      listComponentDirectories: async () => [orphanDirectory],
      readDirectory: async () => ['retired-chat.examples.json'],
    });

    expect(issues).toEqual([
      'orphan artifact (no corresponding source example): retired-chat/retired-chat.examples.json',
    ]);
  });
});
