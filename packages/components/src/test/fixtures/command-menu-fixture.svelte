<script lang="ts">
  import CommandItem from '../../components/command-item/command-item.svelte';
  import CommandMenu from '../../components/command-menu/command-menu.svelte';

  type Item = {
    value: string;
    label: string;
    disabled?: boolean;
    onselect?: () => void;
  };

  type Props = {
    initialValue?: string;
    initialQuery?: string;
    initialOpen?: boolean;
    items?: Item[];
    onSelected?: (value: string, query: string) => void;
    onDismissed?: () => void;
    onStateChanged?: (activeItemId: string | null, listboxId: string) => void;
  };

  const props: Props = $props();
  const initialValue = props.initialValue ?? '/a';
  const initialQuery = props.initialQuery ?? '';
  const initialOpen = props.initialOpen ?? true;
  const commandItems = $derived(
    props.items ?? [
      { value: 'alpha', label: 'Alpha' },
      { value: 'beta', label: 'Beta' },
      { value: 'disabled', label: 'Disabled', disabled: true },
    ],
  );
  const onSelected = $derived(props.onSelected ?? (() => {}));
  const onDismissed = $derived(props.onDismissed ?? (() => {}));
  const onStateChanged = $derived(props.onStateChanged ?? (() => {}));

  let value = $state(initialValue);
  let query = $state(initialQuery);
  let open = $state(initialOpen);
  let caretIndex = $state(initialValue.length);
  let textareaElement: HTMLTextAreaElement | null = $state(null);
</script>

<textarea bind:this={textareaElement} bind:value data-testid="anchor"></textarea>
<button type="button" data-testid="empty-query" onclick={() => (query = 'zzz')}>
  Empty query
</button>
<button type="button" data-testid="close" onclick={() => (open = false)}>Close</button>
<button type="button" data-testid="outside">Outside</button>

<CommandMenu
  bind:open
  bind:query
  anchor={textareaElement}
  {caretIndex}
  onselect={(selection) => onSelected(selection.value, selection.query)}
  ondismiss={onDismissed}
  onstatechange={(state) => onStateChanged(state.activeItemId, state.listboxId)}
>
  {#snippet items({ query: menuQuery })}
    {#each commandItems.filter((item) => item.label
        .toLowerCase()
        .includes(menuQuery.toLowerCase())) as item (item.value)}
      {#if item.onselect}
        <CommandItem value={item.value} disabled={item.disabled === true} onselect={item.onselect}>
          {item.label}
        </CommandItem>
      {:else}
        <CommandItem value={item.value} disabled={item.disabled === true}>
          {item.label}
        </CommandItem>
      {/if}
    {/each}
  {/snippet}

  {#snippet empty()}
    No commands
  {/snippet}
</CommandMenu>
