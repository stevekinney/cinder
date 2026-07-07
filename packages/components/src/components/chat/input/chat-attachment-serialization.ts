import type { ChatAttachment } from './chat-attachment.ts';

const BASE64_CHUNK_SIZE = 0x8000;

export interface SerializedChatAttachment {
  name: string;
  mimeType: string;
  kind: ChatAttachment['kind'];
  content: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (let start = 0; start < bytes.length; start += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(start, start + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
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
  return Promise.all(attachments.map((attachment) => serializeChatAttachment(attachment)));
}
