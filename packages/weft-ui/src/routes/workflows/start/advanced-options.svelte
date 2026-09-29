<script lang="ts">
  /**
   * Start wizard — advanced options (plan §9.2 T2.3: "advanced options
   * (id, idempotencyKey, tags, attributes, deadline)"). A `Collapsible`
   * section on the Configure step; controlled by the parent so its value
   * survives the Form/JSON mode toggle.
   */
  import { Plus, X } from 'lucide-svelte';
  import { Collapsible, Input, TagInput } from '@lostgradient/cinder';

  import type { AdvancedStartOptionsInput } from './start-wizard-state.ts';

  interface AdvancedOptionsProps {
    value: AdvancedStartOptionsInput;
    onChange: (next: AdvancedStartOptionsInput) => void;
    /** Bindable disclosure state (default collapsed). Exposed mainly so a test can render the section already expanded without simulating a click through Cinder's transition-driven trigger. */
    open?: boolean;
  }

  let { value, onChange, open = $bindable(false) }: AdvancedOptionsProps = $props();

  function patch(partial: Partial<AdvancedStartOptionsInput>): void {
    onChange({ ...value, ...partial });
  }

  function addAttributeRow(): void {
    patch({ searchAttributes: [...value.searchAttributes, { key: '', value: '' }] });
  }

  function updateAttributeRow(
    index: number,
    partial: Partial<{ key: string; value: string }>,
  ): void {
    patch({
      searchAttributes: value.searchAttributes.map((row, i) =>
        i === index ? { ...row, ...partial } : row,
      ),
    });
  }

  function removeAttributeRow(index: number): void {
    patch({ searchAttributes: value.searchAttributes.filter((_, i) => i !== index) });
  }
</script>

<Collapsible trigger="Advanced options" class="weft-start-advanced" bind:open>
  <div class="weft-start-advanced__grid">
    <Input
      id="weft-start-id"
      label="Workflow id"
      description="Leave blank to let the engine generate one."
      value={value.id}
      oninput={(event) => patch({ id: (event.currentTarget as HTMLInputElement).value })}
    />
    <Input
      id="weft-start-idempotency-key"
      label="Idempotency key"
      description="A spent key returns a 409 pointing at the existing run."
      value={value.idempotencyKey}
      oninput={(event) =>
        patch({ idempotencyKey: (event.currentTarget as HTMLInputElement).value })}
    />
    <Input
      id="weft-start-execution-timeout"
      label="Execution timeout"
      description={'e.g. "1h", "30m"'}
      value={value.executionTimeout}
      oninput={(event) =>
        patch({ executionTimeout: (event.currentTarget as HTMLInputElement).value })}
    />
  </div>

  <div class="weft-start-advanced__tags">
    <TagInput
      id="weft-start-tags"
      aria-label="Tags"
      placeholder="add tag…"
      value={[...value.tags]}
      onValueChange={(tags: string[]) => patch({ tags })}
    />
  </div>

  <div class="weft-start-advanced__attributes">
    <span class="weft-start-advanced__attributes-label">Search attributes</span>
    {#each value.searchAttributes as row, index (index)}
      <div class="weft-start-advanced__attribute-row">
        <Input
          id={`weft-start-attribute-key-${index}`}
          label={`Attribute ${index + 1} key`}
          labelVisible={false}
          placeholder="key"
          value={row.key}
          oninput={(event) =>
            updateAttributeRow(index, { key: (event.currentTarget as HTMLInputElement).value })}
        />
        <Input
          id={`weft-start-attribute-value-${index}`}
          label={`Attribute ${index + 1} value`}
          labelVisible={false}
          placeholder="value"
          value={row.value}
          oninput={(event) =>
            updateAttributeRow(index, { value: (event.currentTarget as HTMLInputElement).value })}
        />
        <button
          type="button"
          class="weft-start-advanced__remove"
          aria-label={`Remove attribute ${index + 1}`}
          onclick={() => removeAttributeRow(index)}
        >
          <X aria-hidden="true" size={14} />
        </button>
      </div>
    {/each}
    <button type="button" class="weft-start-advanced__add" onclick={addAttributeRow}>
      <Plus aria-hidden="true" size={13} />
      Add attribute
    </button>
  </div>
</Collapsible>
