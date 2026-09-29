/**
 * Pure extraction of channel rows from an `asyncapi.json` document (plan
 * §9.7 T7.3: "rendered ... AsyncAPI viewers"). Kept minimal — just enough to
 * list the channels this engine advertises, matching the same "browse what
 * the document says" level of detail as the OpenAPI/OpenRPC viewers.
 */

export interface AsyncApiChannelRow {
  readonly channel: string;
  readonly address: string | undefined;
  readonly title: string | undefined;
  readonly description: string | undefined;
  readonly messageCount: number;
}

interface AsyncApiChannelObject {
  readonly address?: string;
  readonly title?: string;
  readonly description?: string;
  readonly messages?: Readonly<Record<string, unknown>>;
}

export interface AsyncApiDocumentLike {
  readonly channels?: Readonly<Record<string, AsyncApiChannelObject>>;
}

function compareCodepoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function extractAsyncApiChannels(
  document: AsyncApiDocumentLike | null | undefined,
): readonly AsyncApiChannelRow[] {
  const channels = document?.channels ?? {};
  return Object.entries(channels)
    .map(([channel, entry]): AsyncApiChannelRow => ({
      channel,
      address: entry.address,
      title: entry.title,
      description: entry.description,
      messageCount: entry.messages ? Object.keys(entry.messages).length : 0,
    }))
    .toSorted((a, b) => compareCodepoint(a.channel, b.channel));
}
