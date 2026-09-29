import { expect, test } from 'bun:test';
import { decodeChatStreamEvent, encodeChatStreamEvent } from './stream-event-codec';
import { decodeRunEvent, decodeToolEvent } from './stream-event-codec-decoding-tool-run.ts';

test.each(['stream:unknown', 'tool.unknown'])(
  'rejects unsupported %s encoder discriminators even with valid family fields',
  (type) => {
    const event = Object.create(
      null,
      Object.getOwnPropertyDescriptors({
        type,
        error: 'failure',
        toolCallId: 'call-1',
        toolName: 'tool-1',
        wireVersion: 1,
        sequence: 0,
      }),
    );
    expect(() => encodeChatStreamEvent(event)).toThrow('unsupported type');
  },
);

function inheritedDecoder() {
  return { type: 'stream:error', error: 'inherited decoder', wireVersion: 1, sequence: 0 };
}

test('ignores inherited decoder names when rejecting an unsupported stream event', () => {
  const type = 'stream:unknown';
  const objectPrototype = Object.getPrototypeOf({});
  const previous = Object.getOwnPropertyDescriptor(objectPrototype, type);
  Object.defineProperty(objectPrototype, type, { value: inheritedDecoder, configurable: true });
  try {
    expect(() => decodeChatStreamEvent({ type, wireVersion: 1, sequence: 0 })).toThrow(
      'Invalid chat stream event',
    );
  } finally {
    if (previous === undefined) Reflect.deleteProperty(objectPrototype, type);
    else Object.defineProperty(objectPrototype, type, previous);
  }
});

test.each([
  ['stream:usage', { usage: { inputTokens: 'many' } }],
  ['stream:complete', { state: 'finished-ish' }],
  ['stream:error', { error: () => 'not JSON' }],
])('rejects %s whose terminal payload does not validate', (type, fields) => {
  expect(() => decodeChatStreamEvent({ type, ...fields, wireVersion: 1, sequence: 0 })).toThrow(
    'Invalid chat stream event',
  );
});

// The versioned router hands each family decoder only its own types; these pin
// the decoders' own rejection so a router list that drifts cannot slip a
// foreign type through as a malformed event of the wrong family.
test('the tool family decoder rejects a type outside its family', () => {
  expect(() => decodeToolEvent('run.completed', {}, { wireVersion: 1, sequence: 0 })).toThrow(
    'Invalid chat stream event',
  );
});

test('the run family decoder rejects a type outside its family', () => {
  expect(() => decodeRunEvent('tool.started', {}, { wireVersion: 1, sequence: 0 })).toThrow(
    'Invalid chat stream event',
  );
});
