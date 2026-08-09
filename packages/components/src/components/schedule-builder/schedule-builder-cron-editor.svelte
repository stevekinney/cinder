<script lang="ts">
  import Input from '../input/input.svelte';
  import Grid from '../grid/grid.svelte';
  import NumberInput from '../number-input/number-input.svelte';
  import Select from '../select/select.svelte';
  import { ChevronDown } from '@lostgradient/cinder/icons';
  import { CRON_FIELDS, validateCronField } from './schedule-builder.utilities.ts';
  import { cronExpressionForEditor, type CronEditor } from './schedule-builder-cron-editor.ts';

  interface Props {
    baseId: string;
    cronFields: string[];
    cronEditors: CronEditor[];
    onModeChange: (index: number, event: Event) => void;
    onEditorChange: (index: number, patch: Partial<CronEditor>) => void;
    onRawChange: (index: number, value: string) => void;
  }

  let { baseId, cronFields, cronEditors, onModeChange, onEditorChange, onRawChange }: Props =
    $props();
</script>

<Grid class="cinder-schedule-builder__cron-fields" minItemWidth="12rem" gap="var(--cinder-space-3)">
  {#each CRON_FIELDS as field, index (field.name)}
    {@const editor = cronEditors[index]!}
    {@const structuredError =
      editor.mode === 'advanced'
        ? undefined
        : (validateCronField(cronExpressionForEditor(editor), index) ??
          validateCronField(cronFields[index] ?? '*', index))}
    <div class="cinder-schedule-builder__cron-field">
      <Select
        id={`${baseId}-cron-field-${index}-mode`}
        label={`${field.name} pattern`}
        options={[
          { value: 'every', label: 'Every value (*)' },
          { value: 'specific', label: 'Specific value' },
          { value: 'range', label: 'Range' },
          { value: 'step', label: 'Step (every N)' },
          { value: 'advanced', label: 'Advanced raw expression' },
        ]}
        value={editor.mode}
        onchange={(event) => onModeChange(index, event)}
      />
      {#if editor.mode === 'specific'}
        <NumberInput
          id={`${baseId}-cron-field-${index}-value`}
          label={`${field.name} value`}
          min={field.min}
          max={field.max}
          step={1}
          value={editor.value}
          {...structuredError ? { error: structuredError } : {}}
          onValueChange={(next) => onEditorChange(index, { value: next ?? field.min })}
        />
      {:else if editor.mode === 'range'}
        <Grid class="cinder-schedule-builder__cron-range" columns={2} gap="var(--cinder-space-2)">
          <NumberInput
            id={`${baseId}-cron-field-${index}-start`}
            label={`${field.name} start`}
            min={field.min}
            max={field.max}
            step={1}
            value={editor.start}
            {...structuredError ? { error: structuredError } : {}}
            onValueChange={(next) => onEditorChange(index, { start: next ?? field.min })}
          />
          <NumberInput
            id={`${baseId}-cron-field-${index}-end`}
            label={`${field.name} end`}
            min={field.min}
            max={field.max}
            step={1}
            value={editor.end}
            {...structuredError ? { error: structuredError } : {}}
            onValueChange={(next) => onEditorChange(index, { end: next ?? field.max })}
          />
        </Grid>
      {:else if editor.mode === 'step'}
        <NumberInput
          id={`${baseId}-cron-field-${index}-step`}
          label={`${field.name} step`}
          min={1}
          max={field.max}
          step={1}
          value={editor.step}
          {...structuredError ? { error: structuredError } : {}}
          onValueChange={(next) => onEditorChange(index, { step: next ?? 1 })}
        />
      {/if}
      <details class="cinder-schedule-builder__cron-advanced">
        <summary>
          <span>Advanced raw expression</span>
          <ChevronDown class="cinder-schedule-builder__cron-advanced-chevron cinder-icon-sm" />
        </summary>
        <Input
          id={`${baseId}-cron-field-${index}-raw`}
          label={field.name}
          description={field.hint}
          value={cronFields[index] ?? '*'}
          oninput={(event) => onRawChange(index, (event.currentTarget as HTMLInputElement).value)}
          error={validateCronField(cronFields[index] ?? '*', index) ?? ''}
        />
      </details>
    </div>
  {/each}
</Grid>
