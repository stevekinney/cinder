import { describe, expect, test } from 'bun:test';
import { appendMessages, createConversationHistory } from '../components/chat/builders.ts';
import type { ChatSessionRequest } from './session-controller-support.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

function openGate(): { gate: Promise<void>; release: () => void } {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  return { gate, release };
}

describe('chat session history token', () => {
  test('a freshly captured token is current, and any update retires it', async () => {
    let conversation = createConversationHistory({ id: 'token' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'hi' }]),
    });
    const token = controller.captureHistoryToken();
    expect(token.conversationId).toBe('token');
    expect(controller.isHistoryTokenCurrent(token)).toBe(true);
    await controller.adapter.sendMessage({ role: 'user', content: 'go' }, []);
    expect(controller.isHistoryTokenCurrent(token)).toBe(false);
  });

  test('invalidate, stop and dispose each retire an outstanding token', async () => {
    const build = (): ReturnType<typeof createChatSessionController> => {
      let conversation = createConversationHistory({ id: 'retire' });
      return createChatSessionController({
        getConversation: () => conversation,
        setConversation: (next) => {
          conversation = next;
        },
        transport: async () => events([]),
      });
    };
    const invalidated = build();
    const invalidatedToken = invalidated.captureHistoryToken();
    invalidated.invalidate();
    expect(invalidated.isHistoryTokenCurrent(invalidatedToken)).toBe(false);

    const stopped = build();
    const stoppedToken = stopped.captureHistoryToken();
    await stopped.stop();
    expect(stopped.isHistoryTokenCurrent(stoppedToken)).toBe(false);

    const disposed = build();
    const disposedToken = disposed.captureHistoryToken();
    disposed.dispose();
    expect(disposed.isHistoryTokenCurrent(disposedToken)).toBe(false);
  });

  test('a full snapshot is adopted under a current token and refused under a stale one', () => {
    let conversation = createConversationHistory({ id: 'adopt' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([]),
    });
    const first = appendMessages(createConversationHistory({ id: 'adopt' }), {
      role: 'user',
      content: 'server said this',
    });
    const token = controller.captureHistoryToken();
    expect(controller.adoptHistory(first, token)).toBe(true);
    expect(conversation.ids).toHaveLength(1);

    // The same token a second time: the adoption above already advanced the
    // revision, so this caller is holding a snapshot of a session that has
    // moved on.
    const second = appendMessages(first, { role: 'user', content: 'older answer' });
    expect(controller.adoptHistory(second, token)).toBe(false);
    expect(conversation.ids).toHaveLength(1);
  });

  test('a snapshot for another conversation is refused even under a current token', () => {
    let conversation = createConversationHistory({ id: 'alpha' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([]),
    });
    const token = controller.captureHistoryToken();
    const foreign = appendMessages(createConversationHistory({ id: 'beta' }), {
      role: 'user',
      content: 'another room',
    });
    expect(controller.adoptHistory(foreign, token)).toBe(false);
    expect(conversation.id).toBe('alpha');
    expect(conversation.ids).toHaveLength(0);
  });

  test('a snapshot is refused while a run is in flight', async () => {
    let conversation = createConversationHistory({ id: 'in-flight' });
    const { gate, release } = openGate();
    let adopted: boolean | undefined;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        const token = controller.captureHistoryToken();
        adopted = controller.adoptHistory(
          appendMessages(createConversationHistory({ id: 'in-flight' }), {
            role: 'user',
            content: 'late',
          }),
          token,
        );
        await gate;
        return events([]);
      },
    });
    const sent = controller.adapter.sendMessage({ role: 'user', content: 'go' }, []);
    release();
    await sent;
    expect(adopted).toBe(false);
  });

  test('the transport receives a submission identifier, a token and a currency probe', async () => {
    let conversation = createConversationHistory({ id: 'context' });
    const seen: ChatSessionRequest[] = [];
    let currentDuringRun: boolean | undefined;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async (request) => {
        seen.push(request);
        currentDuringRun = request.isCurrent();
        return events([{ type: 'text', text: 'hi' }]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'go' }, []);
    const request = seen[0];
    expect(request).toBeDefined();
    expect(typeof request?.submissionId).toBe('string');
    expect(request?.submissionId).not.toBe('');
    expect(request?.historyToken.conversationId).toBe('context');
    expect(currentDuringRun).toBe(true);
    // The probe is a live reading, not a value captured at request time: a
    // later submission supersedes this request, and the probe says so.
    await controller.adapter.sendMessage({ role: 'user', content: 'again' }, []);
    expect(request?.isCurrent()).toBe(false);
  });

  test('each submission gets its own identifier', async () => {
    let conversation = createConversationHistory({ id: 'submissions' });
    const submissions: string[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async (request) => {
        submissions.push(request.submissionId);
        return events([{ type: 'text', text: 'hi' }]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'one' }, []);
    await controller.adapter.sendMessage({ role: 'user', content: 'two' }, []);
    expect(submissions).toHaveLength(2);
    expect(submissions[0]).not.toBe(submissions[1]);
  });

  test('a transport resolving after the host navigated never installs its stream', async () => {
    let conversation = createConversationHistory({ id: 'alpha' });
    const { gate, release } = openGate();
    let navigated = false;
    const writesAfterNavigation: string[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        if (navigated) writesAfterNavigation.push(next.id);
        conversation = next;
      },
      transport: async () => {
        await gate;
        return events([{ type: 'text', text: 'stale' }]);
      },
    });
    const sent = controller.adapter.sendMessage({ role: 'user', content: 'go' }, []);
    // The host moved the surface to another conversation while the headers
    // for the previous one were still in flight.
    navigated = true;
    conversation = createConversationHistory({ id: 'beta' });
    release();
    await sent;
    expect(writesAfterNavigation).toEqual([]);
    expect(conversation.id).toBe('beta');
    expect(conversation.ids).toHaveLength(0);
  });

  test('a stream whose body arrives after the host navigated stops installing', async () => {
    let conversation = createConversationHistory({ id: 'alpha' });
    const { gate, release } = openGate();
    let navigated = false;
    const writesAfterNavigation: string[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        if (navigated) writesAfterNavigation.push(next.id);
        conversation = next;
      },
      transport: async () =>
        (async function* (): AsyncGenerator<ChatStreamEvent> {
          yield { type: 'text', text: 'early' };
          await gate;
          yield { type: 'text', text: 'stale' };
        })(),
    });
    const sent = controller.adapter.sendMessage({ role: 'user', content: 'go' }, []);
    await Promise.resolve();
    navigated = true;
    conversation = createConversationHistory({ id: 'beta' });
    release();
    await sent;
    expect(writesAfterNavigation).toEqual([]);
    expect(conversation.id).toBe('beta');
    expect(conversation.ids).toHaveLength(0);
  });
});

describe('cancelling a run still settles its row', () => {
  test('stopping mid-stream finalizes the partial assistant row', async () => {
    let conversation = createConversationHistory({ id: 'stopped' });
    const { gate, release } = openGate();
    // Resolved once the first delta has actually been reduced, so the stop
    // below is reliably a cancellation of a turn with partial output rather
    // than a race with one that has not started producing yet.
    const { gate: streamed, release: sawPartial } = openGate();
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
        if (next.ids.some((id) => next.messages[id]?.content === 'partial')) sawPartial();
      },
      transport: async () =>
        (async function* (): AsyncGenerator<ChatStreamEvent> {
          yield { type: 'text', text: 'partial' };
          await gate;
          yield { type: 'text', text: ' more' };
        })(),
    });
    const sent = controller.adapter.sendMessage({ role: 'user', content: 'go' }, []);
    await streamed;
    // `stop` waits for the run to settle and the run is parked on the gate, so
    // the gate has to open while the stop is pending rather than after it.
    const stopped = controller.stop();
    release();
    await stopped;
    await sent;
    const assistant = conversation.ids.find(
      (id) => conversation.messages[id]?.role === 'assistant',
    );
    expect(assistant).toBeDefined();
    expect(conversation.messages[assistant ?? '']?.content).toBe('partial');
    // A cancelled turn is finished, not perpetually streaming: a row left
    // with the streaming flag renders a live shimmer nothing will ever end.
    expect(conversation.messages[assistant ?? '']?.metadata['__streaming']).not.toBe(true);
  });
});
