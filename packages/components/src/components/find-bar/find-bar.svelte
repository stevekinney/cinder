<script lang="ts" module>
  /** @cinder
   * @category navigation
   * @status beta
   * @purpose Docked, backend-agnostic find controls with debounced query notifications and match navigation.
   * @tag find-bar
   * @useWhen Providing find-in-document controls backed by a host search implementation.
   * @avoidWhen Building a general search field with suggestions — use SearchField or Combobox.
   * @related input, form-field, button
   */
  export type { FindBarProps } from './find-bar.types.ts';
</script>

<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import FormField from '../form-field/form-field.svelte';
  import Input from '../input/input.svelte';
  import Button from '../button/button.svelte';
  import X from 'lucide-svelte/icons/x';
  import { classNames } from '../../utilities/class-names.ts';
  import type { FindBarProps } from './find-bar.types.ts';
  let {
    query = $bindable(''),
    total = $bindable(),
    match = $bindable(),
    minQueryLength = 3,
    debounceMs = 250,
    onQueryChange,
    onPrevious,
    onNext,
    onClose,
    label = 'Find',
    class: customClassName,
    id,
    ...rest
  }: FindBarProps = $props();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastKeystroke = 0;
  let inputNode = $state<HTMLInputElement | null>(null);
  const inputAttachment: Attachment<HTMLInputElement> = (element) => {
    inputNode = element;
    return () => {
      if (inputNode === element) inputNode = null;
    };
  };
  function handleInput(event: Event) {
    query = (event.currentTarget as HTMLInputElement).value;
    total = undefined;
    match = undefined;
    lastKeystroke = Date.now();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (query.trim().length >= minQueryLength) onQueryChange?.(query);
    }, debounceMs);
  }
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.shiftKey ? onPrevious : onNext)?.();
    }
  }
  function refocus() {
    if (Date.now() - lastKeystroke > 400) {
      inputNode?.focus();
      inputNode?.select();
    }
  }
  const status = $derived(
    total === undefined ? '' : total === 0 ? 'No matches' : `${match ?? 1} of ${total}`,
  );
</script>

<div class={classNames('cinder-find-bar', customClassName)} {...rest} onfocusin={refocus}>
  <FormField {id} {label} labelVisible={false}
    >{#snippet children()}<Input
        {id}
        type="search"
        value={query}
        {inputAttachment}
        aria-describedby={`${id ?? 'find'}-description`}
        oninput={handleInput}
        onkeydown={handleKeydown}
        placeholder="Find in page"
      />{/snippet}</FormField
  >
  <span id={`${id ?? 'find'}-description`} class="cinder-sr-only"
    >Type at least {minQueryLength} characters to search.</span
  ><span class="cinder-find-bar__status" role="status" aria-live="polite">{status}</span>
  <div class="cinder-find-bar__actions">
    <Button
      size="sm"
      variant="ghost"
      aria-label="Previous match"
      disabled={!total}
      onclick={onPrevious}>‹</Button
    ><Button size="sm" variant="ghost" aria-label="Next match" disabled={!total} onclick={onNext}
      >›</Button
    ><Button size="sm" variant="ghost" iconOnly aria-label="Close find bar" onclick={onClose}
      ><X /></Button
    >
  </div>
</div>
