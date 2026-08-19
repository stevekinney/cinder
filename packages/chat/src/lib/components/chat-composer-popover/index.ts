import './chat-composer-popover.css';
import ChatComposerPopover from './chat-composer-popover.svelte';

export default ChatComposerPopover;
export {
  deserializeChatComposerMention,
  parseChatComposerMentions,
  serializeChatComposerMention,
  type ChatComposerMention,
  type ChatComposerMentionParseResult,
  type ChatComposerMentionRange,
} from './chat-composer-mention.ts';
export {
  filterFuzzySubsequence,
  fuzzySubsequenceScore,
  type FuzzyFilterItem,
  type FuzzyFilterResult,
} from './chat-composer-popover-filter.ts';
export type {
  ChatComposerPopoverComposerProps,
  ChatComposerPopoverItem,
  ChatComposerPopoverItemSnippetContext,
  ChatComposerPopoverProps,
  ChatComposerPopoverSelection,
  ChatComposerPopoverTriggerMatch,
} from './chat-composer-popover.types.ts';
export { ChatComposerPopover };
