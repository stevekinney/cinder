<script lang="ts">
  /**
   * Start wizard — Configure step (plan §9.2 T2.3, §10.2 payload editor).
   * `SchemaForm` (Cinder) for form mode when the registry published an
   * `inputSchema`; Cinder's lazy-highlighted `JsonEditor` for raw-JSON mode.
   *
   * **Mode-switch losslessness, honestly scoped.** `SchemaForm` has no way
   * to read its live, uncommitted value outside its own `onsubmit` (its
   * `value` prop is seed-only per the component's own doc: "value changes
   * do not reset form state" and there is no bindable/exported getter) —
   * so this cannot mirror form edits into the JSON view (or back) as the
   * user types, the way a true "lossless toggle" implies. What this DOES
   * guarantee: switching modes never silently drops or corrupts a payload
   * that was already SUBMITTED from either mode (each mode's own submit is
   * what advances the wizard), and no data entered before a toggle is lost
   * *because of the toggle itself* (each mode keeps its own draft state
   * independently). True live bidirectional sync would require
   * re-implementing SchemaForm's internal state tracking, which is out of
   * scope for this track.
   */
  import { SchemaForm, JsonEditor, SegmentedControl, Segment } from '@lostgradient/cinder';

  import AdvancedOptions from './advanced-options.svelte';
  import { parseRawPayload, type AdvancedStartOptionsInput } from './start-wizard-state.ts';

  export type ConfigureStepMode = 'form' | 'json';

  interface ConfigureStepProps {
    /** The registry's `inputSchema` for the selected type, or `undefined` when unpublished/unavailable — form mode is only offered when this is set. */
    /** A `JsonSchemaObject` (`Record<string, unknown>`, matching `SchemaForm`'s own `schema` prop type and the registry's `RegistryWorkflowEntry.inputSchema` shape verbatim), or `undefined` when unpublished/unavailable. */
    schema: Record<string, unknown> | undefined;
    mode: ConfigureStepMode;
    onModeChange: (mode: ConfigureStepMode) => void;
    rawText: string;
    onRawTextChange: (text: string) => void;
    advanced: AdvancedStartOptionsInput;
    onAdvancedChange: (advanced: AdvancedStartOptionsInput) => void;
    onContinue: (payload: unknown) => void;
    onBack: () => void;
  }

  let {
    schema,
    mode,
    onModeChange,
    rawText,
    onRawTextChange,
    advanced,
    onAdvancedChange,
    onContinue,
    onBack,
  }: ConfigureStepProps = $props();

  const rawParse = $derived(parseRawPayload(rawText));

  function onContinueFromRaw(): void {
    if (rawParse.ok) onContinue(rawParse.value);
  }
</script>

<div class="weft-start-configure">
  {#if schema}
    <SegmentedControl
      id="weft-start-configure-mode"
      label="Payload mode"
      labelVisible={false}
      value={mode}
      onValueChange={(next) => onModeChange(next)}
    >
      <Segment value="form">Form</Segment>
      <Segment value="json">JSON</Segment>
    </SegmentedControl>
  {:else}
    <p class="weft-start-configure__no-schema">
      No schema published for this type — using raw JSON.
    </p>
  {/if}

  {#if mode === 'form' && schema}
    <SchemaForm
      {schema}
      name="start-input"
      submitLabel="Continue to review"
      onSubmit={onContinue}
    />
  {:else}
    <JsonEditor
      id="weft-start-raw-json"
      label="Payload (JSON)"
      rows={8}
      value={rawText}
      onValueChange={onRawTextChange}
      highlight
      validFeedbackVisible={false}
    />
  {/if}

  <AdvancedOptions value={advanced} onChange={onAdvancedChange} />

  <div class="weft-start-configure__actions">
    <button type="button" class="weft-start-configure__back" onclick={onBack}>Back</button>
    {#if mode === 'json' || !schema}
      <button
        type="button"
        class="weft-start-configure__continue"
        disabled={!rawParse.ok}
        onclick={onContinueFromRaw}
      >
        Continue to review
      </button>
    {/if}
  </div>
</div>
