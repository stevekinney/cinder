import ChatComponent from './components/chat/index.ts';

export default ChatComponent;
export {
  deserializeChatComposerMention,
  parseChatComposerMentions,
  serializeChatComposerMention,
  type ChatComposerMention,
  type ChatComposerMentionParseResult,
  type ChatComposerMentionRange,
} from './components/chat-composer-popover/chat-composer-mention.ts';
export * from './components/chat/index.ts';
