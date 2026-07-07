import type { ChatAttachment } from './chat-attachment.ts';

const BASE64_CHUNK_SIZE = 0x8000;

type Base64Runtime = typeof globalThis & {
  btoa?: (data: string) => string;
  Buffer?: {
    from: (data: Uint8Array) => { toString: (encoding: 'base64') => string };
  };
};

export interface SerializedChatAttachment {
  name: string;
  mimeType: string;
  kind: ChatAttachment['kind'];
  content: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  const runtime = globalThis as Base64Runtime;

  if (typeof runtime.btoa === 'function') {
    let binary = '';

    for (let start = 0; start < bytes.length; start += BASE64_CHUNK_SIZE) {
      const chunk = bytes.subarray(start, start + BASE64_CHUNK_SIZE);
      binary += String.fromCharCode(...chunk);
    }

    return runtime.btoa(binary);
  }

  if (typeof runtime.Buffer?.from === 'function') {
    return runtime.Buffer.from(bytes).toString('base64');
  }

  throw new Error('serializeChatAttachment requires btoa or Buffer for base64 encoding.');
}

export async function serializeChatAttachment(
  attachment: ChatAttachment,
): Promise<SerializedChatAttachment> {
  const bytes = new Uint8Array(await attachment.file.arrayBuffer());

  return {
    name: attachment.file.name,
    mimeType: attachment.file.type,
    kind: attachment.kind,
    content: bytesToBase64(bytes),
  };
}

export async function serializeChatAttachments(
  attachments: readonly ChatAttachment[],
): Promise<SerializedChatAttachment[]> {
  const serializedAttachments: SerializedChatAttachment[] = [];

  for (const attachment of attachments) {
    serializedAttachments.push(await serializeChatAttachment(attachment));
  }

  return serializedAttachments;
}
