import { describe, expect, test } from 'bun:test';
import { createConversationHistory } from '../components/chat/builders.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

/**
 * A resolved tool call is the browser-owned signal to continue: the client
 * drives the next step, so the controller re-invokes the transport. A
 * server-owned run already produced every step inside one response, so a
 * second submission would either duplicate the turn or ask for something the
 * host has nothing to answer with.
 */
describe('chat session execution ownership', () => {
  test('a server-owned multistep run submits exactly once after tools resolve', async () => {
    let conversation = createConversationHistory({ id: 'server-owned' });
    let calls = 0;
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return events([
          { type: 'tool_call', id: 'call', name: 'read', arguments: {} },
          { type: 'tool_result', callId: 'call', outcome: 'success', content: 'ok' },
          { type: 'text', text: 'done' },
        ]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'run' }, []);
    expect(calls).toBe(1);
  });

  test('omitting the option keeps the browser-owned continuation', async () => {
    let conversation = createConversationHistory({ id: 'browser-owned' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return calls === 1
          ? events([
              { type: 'tool_call', id: 'call', name: 'read', arguments: {} },
              { type: 'tool_result', callId: 'call', outcome: 'success', content: 'ok' },
            ])
          : events([{ type: 'text', text: 'done' }]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'run' }, []);
    expect(calls).toBe(2);
  });

  test('an explicit browser owner behaves as the default', async () => {
    let conversation = createConversationHistory({ id: 'explicit-browser' });
    let calls = 0;
    const controller = createChatSessionController({
      executionOwner: 'browser',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return calls === 1
          ? events([
              { type: 'tool_call', id: 'call', name: 'read', arguments: {} },
              { type: 'tool_result', callId: 'call', outcome: 'success', content: 'ok' },
            ])
          : events([{ type: 'text', text: 'done' }]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'run' }, []);
    expect(calls).toBe(2);
  });
});
