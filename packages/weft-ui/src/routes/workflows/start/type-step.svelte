<script lang="ts">
  /**
   * Start wizard — Type step (plan §9.2 T2.3). Reads the registry
   * (`weft.system.registry`, `system:read`) for a searchable list of
   * registered workflow types; degrades to a free-text field when the
   * scope is missing or the request fails — a workflow can still be
   * started by exact type name without ever seeing the registry.
   *
   * **Why `Input`, not `Combobox`, when `knownTypes` is empty.** Cinder's
   * `Combobox` is documented as constrained selection, not free text (its
   * own `@avoidWhen`: "Querying remote data or accepting free-text
   * submissions — use search-field instead" — verified against
   * `combobox.svelte`): any blur/Escape reverts `inputValue` to
   * `committedLabel`, which is only ever set by selecting a real `option`.
   * With zero options there is no way to "commit" typed text, so every
   * blur silently wiped the field back to empty — confirmed via a live
   * browser repro against this exact degraded-registry dev harness state
   * (type text, click elsewhere, the field reverts to the placeholder) —
   * breaking the "start a workflow by exact type name without ever seeing
   * the registry" guarantee this step's own doc comment promises. A plain
   * `Input` has no such commit/revert cycle, so it is used whenever there
   * is nothing to autocomplete against; `Combobox` still handles the
   * has-options case, where typeahead-constrained selection is the
   * intended (and Cinder-documented) UX.
   */
  import { Combobox, Input, type ComboboxOption } from '@lostgradient/cinder';

  interface TypeStepProps {
    knownTypes: readonly string[];
    /** True while the registry itself is still loading — distinct from "no types available," which shows the free-text fallback instead of a spinner-less blank list. */
    registryLoading: boolean;
    value: string;
    onValueChange: (value: string) => void;
    onContinue: () => void;
  }

  let { knownTypes, registryLoading, value, onValueChange, onContinue }: TypeStepProps = $props();

  const options = $derived(
    knownTypes.map((type): ComboboxOption => ({ value: type, label: type })),
  );
  let searchText = $state('');
  const canContinue = $derived(value.trim().length > 0);
</script>

<div class="weft-start-type">
  {#if knownTypes.length > 0}
    <Combobox
      id="weft-start-type-input"
      label="Workflow type"
      placeholder="Search or type a workflow type…"
      {options}
      {value}
      {onValueChange}
      bind:textInputValue={searchText}
    />
  {:else}
    <Input
      id="weft-start-type-input"
      label="Workflow type"
      placeholder="Enter a workflow type…"
      {value}
      oninput={(event) => onValueChange((event.currentTarget as HTMLInputElement).value)}
    />
  {/if}
  {#if registryLoading}
    <p class="weft-start-type__hint">Loading registered types…</p>
  {:else if knownTypes.length === 0}
    <p class="weft-start-type__hint">
      No registry data available — enter the exact workflow type name.
    </p>
  {/if}

  <div class="weft-start-type__actions">
    <button
      type="button"
      class="weft-start-type__continue"
      disabled={!canContinue}
      onclick={onContinue}
    >
      Next: configure
    </button>
  </div>
</div>
