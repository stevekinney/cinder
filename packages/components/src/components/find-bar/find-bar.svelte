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
  import { onDestroy } from 'svelte';
  import FormField from '@lostgradient/cinder/form-field';
  import Input from '@lostgradient/cinder/input';
  import Button from '@lostgradient/cinder/button';
  import X from 'lucide-svelte/icons/x';
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import { classNames } from '../../utilities/class-names.ts';
  import type { FindBarProps } from './find-bar.types.ts';
  let {
    value = $bindable(''),
    matchCount = $bindable(null),
    activeIndex = $bindable(0),
    minQueryLength = 3,
    debounceMs = 250,
    onQueryChange,
    onPrevious,
    onNext,
    onDismiss,
    label = 'Find',
    class: customClassName,
    id,
    ...rest
  }: FindBarProps = $props();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const generatedId = $props.id();
  const inputId = $derived(id ?? generatedId);
  let lastKeystroke = 0;
  let inputNode = $state<HTMLInputElement | null>(null);
  let queryWasEligible = false;
  let lastObservedValue = '';
  const inputAttachment: Attachment<HTMLInputElement> = (element) => {
    inputNode = element;
    return () => {
      if (inputNode === element) inputNode = null;
    };
  };
  function handleInput(event: Event) {
    value = (event.currentTarget as HTMLInputElement).value;
    lastObservedValue = value;
    matchCount = null;
    activeIndex = 0;
    lastKeystroke = Date.now();
    if (timer) clearTimeout(timer);
    const eligible = value.trim().length >= minQueryLength;
    if (!eligible && queryWasEligible) {
      queryWasEligible = false;
      onQueryChange?.('');
    }
    timer = setTimeout(() => {
      timer = undefined;
      if (value.trim().length >= minQueryLength) {
        queryWasEligible = true;
        onQueryChange?.(value);
      }
    }, debounceMs);
  }
  $effect(() => {
    const nextValue = value;
    const eligible = nextValue.trim().length >= minQueryLength;
    if (nextValue === lastObservedValue && eligible === queryWasEligible) return;
    lastObservedValue = nextValue;
    if (!eligible && queryWasEligible) {
      queryWasEligible = false;
      onQueryChange?.('');
    } else if (eligible) {
      queryWasEligible = true;
    }
  });
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (value.trim().length < minQueryLength || !matchCount) return;
      event.preventDefault();
      (event.shiftKey ? onPrevious : onNext)?.();
    }
  }
  function handleInputFocus() {
    if (Date.now() - lastKeystroke > 400) {
      inputNode?.focus();
      inputNode?.select();
    }
  }
  const status = $derived(
    value.trim().length < minQueryLength || matchCount === null
      ? ''
      : matchCount === 0
        ? 'No matches'
        : `${activeIndex + 1} of ${matchCount}`,
  );
  onDestroy(() => {
    if (timer) clearTimeout(timer);
  });
</script>

<div class={classNames('cinder-find-bar', customClassName)} {...rest}>
  <FormField id={inputId} {label} labelVisible={false}
    >{#snippet children()}<Input
        id={inputId}
        type="search"
        {value}
        {inputAttachment}
        aria-describedby={`${inputId}-description`}
        oninput={handleInput}
        onfocus={handleInputFocus}
        onkeydown={handleKeydown}
        placeholder="Find in page"
      />{/snippet}</FormField
  >
  <span id={`${inputId}-description`} class="cinder-sr-only"
    >Type at least {minQueryLength} characters to search.</span
  ><span class="cinder-find-bar__status" role="status" aria-live="polite">{status}</span>
  {#if onPrevious || onNext || onDismiss}
    <div class="cinder-find-bar__actions">
      {#if onPrevious}<Button
          size="sm"
          variant="ghost"
          aria-label="Previous match"
          disabled={!matchCount}
          iconOnly
          onclick={onPrevious}><ChevronLeft /></Button
        >{/if}
      {#if onNext}<Button
          size="sm"
          variant="ghost"
          aria-label="Next match"
          disabled={!matchCount}
          iconOnly
          onclick={onNext}><ChevronRight /></Button
        >{/if}
      {#if onDismiss}<Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label="Close find bar"
          onclick={onDismiss}><X /></Button
        >{/if}
    </div>
  {/if}
</div>
