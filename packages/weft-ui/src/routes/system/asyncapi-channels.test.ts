import { describe, expect, test } from 'bun:test';

import { extractAsyncApiChannels } from './asyncapi-channels.ts';

describe('extractAsyncApiChannels', () => {
  test('empty for a missing document or missing channels', () => {
    expect(extractAsyncApiChannels(null)).toEqual([]);
    expect(extractAsyncApiChannels({})).toEqual([]);
  });

  test('extracts and sorts channel rows, counting messages', () => {
    const rows = extractAsyncApiChannels({
      channels: {
        'weft/events/subscribe': {
          address: '/api/jsonrpc',
          title: 'JSON-RPC events subscription',
          messages: { subscribeAck: {}, eventDeliver: {} },
        },
        'weft/events/sse': {
          address: '/api/v1/events/sse',
          description: 'Fleet SSE stream.',
          messages: { pingEvent: {} },
        },
      },
    });

    expect(rows.map((row) => row.channel)).toEqual(['weft/events/sse', 'weft/events/subscribe']);
    expect(rows[0]).toMatchObject({ address: '/api/v1/events/sse', messageCount: 1 });
    expect(rows[1]).toMatchObject({ title: 'JSON-RPC events subscription', messageCount: 2 });
  });
});
