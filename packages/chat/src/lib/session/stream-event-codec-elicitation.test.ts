import { describe, expect, test } from 'bun:test';
import { decodeChatStreamEvent, encodeChatStreamEvent } from './stream-event-codec.ts';

const completeApprovalAction = {
  type: 'approval' as const,
  message: 'Approve patch?',
  risk: 'high' as const,
  operation: {
    kind: 'patch' as const,
    diff: 'diff --git a/file.ts b/file.ts\n+approved\n',
    filesTouched: ['components/chat/src/lib/session/stream-event-codec-elicitation.test.ts'],
    argsPreview: { hunks: 1 },
  },
  sandbox: {
    provider: 'codex',
    name: 'workspace-write',
    workingDir: '/Users/stevekinney/Developer/corvidae',
  },
  env: ['TZ=UTC', 'LANG=en_US.UTF-8'],
  snapshotId: 'snapshot-elicitation',
  expiresAt: '2026-09-19T20:00:00+00:00',
  editableArgs: true,
  policyVersion: 'approval-policy:elicitation',
  idempotencyKey: 'approval-codec-elicitation',
};

/**
 * The elicitation vocabulary: a question a run is waiting on, and the human's
 * answer to it.
 *
 * `elicitation.resolved` REPORTS THE HUMAN'S RESPONSE, not tool settlement.
 * They are different events and conflating them is the defect this vocabulary
 * exists to avoid — a denial resolves the question and the call still settles
 * afterwards, with its own `tool.settled`/`tool_result` frames saying the tool
 * did not run.
 *
 * REQUEST IDENTITY IS IMMUTABLE: the `requestId` a client is shown in
 * `elicitation.requested` is the identity every answer and every resolution
 * refers to. The codec's job here is to make sure that id survives the wire
 * as a string and is never optional.
 *
 * Version 2 only, like `assistant.step.*`: a version 1 producer cannot
 * construct one at all, which is what keeps the version field meaningful
 * rather than decorative.
 */
describe('elicitation.* frames', () => {
  test('round-trips a requested frame', () => {
    const event = {
      type: 'elicitation.requested',
      requestId: 'elicitation-1',
      toolCallId: 'call-1',
      message: 'Save this note?',
      wireVersion: 2,
      sequence: 2,
    } as const;
    expect(decodeChatStreamEvent(JSON.parse(encodeChatStreamEvent(event)))).toEqual(event);
  });

  test('round-trips a requested frame carrying an action descriptor', () => {
    const event = {
      type: 'elicitation.requested',
      requestId: 'elicitation-1',
      message: 'Save this note?',
      action: {
        type: 'approval',
        message: 'Approve this call',
        risk: 'high',
        operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
        policyVersion: 'test-policy',
        idempotencyKey: 'test-approval',
      },
      wireVersion: 2,
      sequence: 0,
    } as const;
    expect(decodeChatStreamEvent(JSON.parse(encodeChatStreamEvent(event)))).toEqual(event);
  });

  test('preserves complete approval metadata on a requested frame', () => {
    const event = {
      type: 'elicitation.requested',
      requestId: 'elicitation-approval-1',
      toolCallId: 'call-1',
      message: 'Approve patch?',
      action: completeApprovalAction,
      wireVersion: 2,
      sequence: 1,
    } as const;

    expect(decodeChatStreamEvent(JSON.parse(encodeChatStreamEvent(event)))).toEqual(event);
  });

  test('round-trips a resolved frame on both answers', () => {
    for (const accepted of [true, false]) {
      const event = {
        type: 'elicitation.resolved',
        requestId: 'elicitation-1',
        toolCallId: 'call-1',
        accepted,
        wireVersion: 2,
        sequence: 5,
      } as const;
      expect(decodeChatStreamEvent(JSON.parse(encodeChatStreamEvent(event)))).toEqual(event);
    }
  });

  test('omits an absent toolCallId rather than writing it as null', () => {
    const encoded: unknown = JSON.parse(
      encodeChatStreamEvent({
        type: 'elicitation.requested',
        requestId: 'elicitation-1',
        message: 'Save this note?',
        wireVersion: 2,
        sequence: 0,
      }),
    );
    expect(Object.hasOwn(encoded as object, 'toolCallId')).toBe(false);
  });

  test('refuses an elicitation frame at wire version 1', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'elicitation.requested',
        requestId: 'elicitation-1',
        message: 'Save this note?',
        wireVersion: 1,
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
    expect(() =>
      decodeChatStreamEvent({
        type: 'elicitation.resolved',
        requestId: 'elicitation-1',
        accepted: true,
        wireVersion: 1,
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('refuses an elicitation frame with no envelope at all', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'elicitation.requested',
        requestId: 'elicitation-1',
        message: 'Save this note?',
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('refuses a requested frame with a missing or non-string requestId', () => {
    for (const requestId of [undefined, 7, null, {}]) {
      expect(() =>
        decodeChatStreamEvent({
          type: 'elicitation.requested',
          ...(requestId === undefined ? {} : { requestId }),
          message: 'Save this note?',
          wireVersion: 2,
          sequence: 0,
        }),
      ).toThrow('Invalid chat stream event');
    }
  });

  test('refuses a requested frame with a missing or non-string message', () => {
    for (const message of [undefined, 7, null]) {
      expect(() =>
        decodeChatStreamEvent({
          type: 'elicitation.requested',
          requestId: 'elicitation-1',
          ...(message === undefined ? {} : { message }),
          wireVersion: 2,
          sequence: 0,
        }),
      ).toThrow('Invalid chat stream event');
    }
  });

  test('refuses a present but non-string toolCallId', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'elicitation.requested',
        requestId: 'elicitation-1',
        toolCallId: 7,
        message: 'Save this note?',
        wireVersion: 2,
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
  });

  // The SAME rejection `tool_result` applies to its own `action`. A malformed
  // descriptor is not silently dropped to "no descriptor": the producer said
  // something about this question and it did not survive validation.
  test('refuses a malformed action descriptor', () => {
    for (const action of [{ type: 'nonsense' }, { type: 'approval', message: 7 }, 'approval', 7]) {
      expect(() =>
        decodeChatStreamEvent({
          type: 'elicitation.requested',
          requestId: 'elicitation-1',
          message: 'Save this note?',
          action,
          wireVersion: 2,
          sequence: 0,
        }),
      ).toThrow('Invalid chat stream event');
    }
  });

  test('refuses a resolved frame with a missing or non-boolean accepted', () => {
    for (const accepted of [undefined, 'true', 1, null]) {
      expect(() =>
        decodeChatStreamEvent({
          type: 'elicitation.resolved',
          requestId: 'elicitation-1',
          ...(accepted === undefined ? {} : { accepted }),
          wireVersion: 2,
          sequence: 0,
        }),
      ).toThrow('Invalid chat stream event');
    }
  });

  // Symmetric with every other member: the encoder refuses to produce a frame
  // its own decoder would reject, so a producer bug surfaces at the producer.
  test('the encoder refuses a malformed requested frame', () => {
    expect(() =>
      encodeChatStreamEvent({
        type: 'elicitation.requested',
        requestId: 7,
        message: 'Save this note?',
        wireVersion: 2,
        sequence: 0,
      } as never),
    ).toThrow('Invalid chat stream event');
  });

  test('the encoder refuses a resolved frame with a non-boolean accepted', () => {
    expect(() =>
      encodeChatStreamEvent({
        type: 'elicitation.resolved',
        requestId: 'elicitation-1',
        accepted: 'yes',
        wireVersion: 2,
        sequence: 0,
      } as never),
    ).toThrow('Invalid chat stream event');
  });
});
