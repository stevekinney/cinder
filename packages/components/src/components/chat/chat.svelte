<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status domain-suite
   * @purpose Opinionated conversation surface bundling message list, composer, attachments, and scroll affordances for AI or support transcripts.
   * @tag chat
   * @tag conversation
   * @tag domain-suite
   * @useWhen Shipping a full chat surface with composer, scroll-anchor, unread indicator, and attachments bundled as one heavyweight drop-in.
   * @useWhen Building an AI assistant or support thread where conversation state is modeled as a transcript of role-tagged messages.
   * @avoidWhen Rendering a one-off message list — compose lighter primitives directly instead of pulling the full suite.
   * @avoidWhen The transcript is read-only and needs no composer — a simple list of message bubbles is a better fit.
   * @related markdown-editor
   */
  export type { ChatProps } from './chat.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import ChatImplementation from './container/chat.svelte';
  import type { ChatProps } from './chat.types.ts';

  let { class: className, ...rest }: ChatProps = $props();

  const mergedClassName = $derived(classNames(className));

  // The inner implementation owns the imperative streaming + scroll API. The
  // public wrapper forwards it so consumers using `@lostgradient/cinder/chat` can drive
  // streaming through a `bind:this` to <Chat> (the inner component is not
  // exported).
  // Plain `let` (not `$state`): the instance ref is only read inside the
  // imperative forwarders, never in the template or a derivation, so it needs
  // no reactivity.
  let impl: ReturnType<typeof ChatImplementation> | undefined;

  /**
   * Begin streaming content into an existing assistant message. No-op until the
   * component is mounted (a call via a stale ref after teardown is safe).
   */
  export function beginStreaming(messageId: string): void {
    impl?.beginStreaming(messageId);
  }

  /** Append a token to the active streaming buffer. No-op until mounted. */
  export function pushToken(token: string): void {
    impl?.pushToken(token);
  }

  /** End the active streaming session. No-op until mounted. */
  export function endStreaming(): void {
    impl?.endStreaming();
  }

  /** Scroll the message viewport to the bottom. No-op until mounted. */
  export function scrollToBottom(): void {
    impl?.scrollToBottom();
  }

  /** Scroll the message viewport to the top. No-op until mounted. */
  export function scrollToTop(): void {
    impl?.scrollToTop();
  }

  /** Focus the composer input. No-op until mounted. */
  export function focusInput(): void {
    impl?.focusInput();
  }

  /** Clear the composer's current content. No-op until mounted. */
  export function clearInput(): void {
    impl?.clearInput();
  }

  /** Read the composer's current plain-text value. Returns '' until mounted. */
  export function getComposerValue(): string {
    return impl?.getComposerValue() ?? '';
  }

  /** Read the composer textarea element. Returns null until mounted. */
  export function getEditorElement(): HTMLTextAreaElement | null {
    return impl?.getEditorElement() ?? null;
  }
</script>

<ChatImplementation bind:this={impl} class={mergedClassName} {...rest} />
