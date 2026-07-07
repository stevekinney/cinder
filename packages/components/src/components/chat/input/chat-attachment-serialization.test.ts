/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import {
  serializeChatAttachment,
  serializeChatAttachments,
} from './chat-attachment-serialization.ts';
import type { ChatAttachment } from './chat-attachment.ts';

function createAttachment(
  bytes: Uint8Array<ArrayBuffer>,
  options: {
    name?: string;
    type?: string;
    kind?: ChatAttachment['kind'];
    id?: string;
  } = {},
): ChatAttachment {
  const file = new File([bytes], options.name ?? 'attachment.txt', {
    type: options.type ?? 'text/plain',
  });

  return {
    id: options.id ?? options.name ?? 'attachment',
    file,
    previewUrl: '',
    kind: options.kind ?? 'document',
    status: 'ready',
  };
}

function expectedBase64(bytes: Uint8Array<ArrayBuffer>): string {
  return Buffer.from(bytes).toString('base64');
}

describe('chat attachment serialization', () => {
  test('serializes attachment metadata and base64 file content', async () => {
    const bytes = new TextEncoder().encode('hello from cinder');
    const attachment = createAttachment(bytes, {
      name: 'hello.txt',
      type: 'application/x-typescript',
      kind: 'code',
    });

    await expect(serializeChatAttachment(attachment)).resolves.toEqual({
      name: 'hello.txt',
      mimeType: 'application/x-typescript',
      kind: 'code',
      content: expectedBase64(bytes),
    });
  });

  test('serializes multiple attachments in input order', async () => {
    const firstBytes = new TextEncoder().encode('first');
    const secondBytes = new TextEncoder().encode('second');

    await expect(
      serializeChatAttachments([
        createAttachment(firstBytes, {
          name: 'first.txt',
          type: 'application/pdf',
          kind: 'document',
        }),
        createAttachment(secondBytes, { name: 'second.png', type: 'image/png', kind: 'image' }),
      ]),
    ).resolves.toEqual([
      {
        name: 'first.txt',
        mimeType: 'application/pdf',
        kind: 'document',
        content: expectedBase64(firstBytes),
      },
      {
        name: 'second.png',
        mimeType: 'image/png',
        kind: 'image',
        content: expectedBase64(secondBytes),
      },
    ]);
  });

  test('encodes large files without spreading the full byte array onto the stack', async () => {
    const bytes = new Uint8Array(1_000_000);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = index % 251;
    }

    expect(() => String.fromCharCode(...bytes)).toThrow();

    const serialized = await serializeChatAttachment(
      createAttachment(bytes, {
        name: 'large.bin',
        type: 'application/octet-stream',
        kind: 'document',
      }),
    );

    expect(serialized).toEqual({
      name: 'large.bin',
      mimeType: 'application/octet-stream',
      kind: 'document',
      content: expectedBase64(bytes),
    });
  });
});
