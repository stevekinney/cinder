/**
 * Public prop-shape regression guard for Chat.
 *
 * `ChatProps.conversation` is the published Conversationalist
 * `ConversationHistory` snapshot. This asserts, at the type level and through
 * the PUBLIC `@lostgradient/chat`-equivalent barrel, that:
 *   1. `ConversationHistory` is publicly importable alongside `ChatProps`.
 *   2. The actual `<Chat>` component accepts a `ConversationHistory`-shaped
 *      `conversation` prop (via `ComponentProps<typeof Chat>`), not just
 *      `ChatProps` in isolation.
 *
 * Imports come from `./index.ts` — the chat public barrel that maps to
 * `@lostgradient/chat` — so this tracks the real consumer surface.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps } from 'svelte';

import Chat from './chat.svelte';
import type {
  ChatAnnounceLevel,
  ChatAttachment,
  ChatProps,
  ChatSubmitEvent,
  ConversationHistory,
} from './index.ts';

type Assignable<A, B> = A extends B ? true : false;

// The component's accepted props must include a `conversation` of the published
// ConversationHistory type.
type ChatComponentProps = ComponentProps<typeof Chat>;
const conversationPropIsHistory: Assignable<
  ChatComponentProps['conversation'],
  ConversationHistory
> = true;
const historyAssignableToProp: Assignable<ConversationHistory, ChatComponentProps['conversation']> =
  true;

// A plain ConversationHistory literal satisfies the public prop type.
const conversation = {
  schemaVersion: 4,
  id: 'consumer-conversation',
  status: 'active',
  metadata: {},
  ids: [],
  messages: {},
  createdAt: '2026-06-02T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
} satisfies ConversationHistory;

const props = { id: 'consumer-chat', conversation } satisfies Pick<
  ChatProps,
  'id' | 'conversation'
>;

// With exactOptionalPropertyTypes enabled, explicit undefined must remain a
// supported way to return controlled indicator state to the adapter path.
const explicitlyUncontrolledProps = {
  typingParticipants: undefined,
  readReceipts: undefined,
} satisfies Pick<ChatProps, 'typingParticipants' | 'readReceipts'>;
const explicitlyUncontrolledComponentProps = {
  id: 'consumer-chat',
  conversation,
  typingParticipants: undefined,
  readReceipts: undefined,
} satisfies ChatComponentProps;

// The public Chat wrapper forwards the inner imperative streaming/scroll API
// (beginStreaming/pushToken/endStreaming/scrollToBottom/scrollToTop/focusInput).
// A type-level assertion of that method surface is intentionally NOT made here:
// `ReturnType<typeof Chat>` only resolves the component Exports against the
// generated `.d.ts`, while both this test and the consumer fixtures' `svelte`
// condition resolve `Chat` to the `.svelte` source, where svelte2tsx surfaces a
// legacy fallback instance shape in plain `tsc` (so the assertion would be a
// false negative). Instead the surface is proven two ways: the wrapper itself
// typechecks (`impl?.beginStreaming(...)` etc. compile in chat.svelte), and
// chat.test.ts proves at RUNTIME that the six methods exist on a `bind:this`
// instance, are callable, and no-op safely after unmount. The build emits the
// six signatures into `dist/components/chat/chat.svelte.d.ts`.

test('Chat publicly accepts a ConversationHistory conversation prop', () => {
  expect(conversationPropIsHistory).toBe(true);
  expect(historyAssignableToProp).toBe(true);
  expect(props.conversation.id).toBe('consumer-conversation');
});

test('Chat indicator props explicitly accept undefined', () => {
  expect(explicitlyUncontrolledProps.typingParticipants).toBeUndefined();
  expect(explicitlyUncontrolledProps.readReceipts).toBeUndefined();
  expect(explicitlyUncontrolledComponentProps.typingParticipants).toBeUndefined();
  expect(explicitlyUncontrolledComponentProps.readReceipts).toBeUndefined();
});

// `ChatAttachment` was previously importable only by deriving it from
// `ChatSubmitEvent['attachments'][number]` — the public `./index.ts` barrel
// (the `@lostgradient/chat` entry) did not re-export the type on its
// own. This asserts the two forms are the same type and that `ChatAttachment`
// is directly importable from the public barrel.
type SubmitEventAttachment = ChatSubmitEvent['attachments'][number];
const chatAttachmentMatchesSubmitEventAttachment: Assignable<
  ChatAttachment,
  SubmitEventAttachment
> = true;
const submitEventAttachmentMatchesChatAttachment: Assignable<
  SubmitEventAttachment,
  ChatAttachment
> = true;

test('ChatAttachment is directly importable from the public chat barrel', () => {
  expect(chatAttachmentMatchesSubmitEventAttachment).toBe(true);
  expect(submitEventAttachmentMatchesChatAttachment).toBe(true);

  const attachment = {
    id: 'attachment-1',
    file: new File(['content'], 'note.txt', { type: 'text/plain' }),
    previewUrl: 'blob:attachment-1',
    kind: 'document',
    status: 'ready',
  } satisfies ChatAttachment;

  expect(attachment.id).toBe('attachment-1');
});

test('ChatAnnounceLevel is directly importable from the public chat barrel', () => {
  const polite = 'polite' satisfies ChatAnnounceLevel;
  const assertive = 'assertive' satisfies ChatAnnounceLevel;

  expect(polite).toBe('polite');
  expect(assertive).toBe('assertive');
});
