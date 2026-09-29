<script lang="ts">
  /**
   * URL-backed adapter for Cinder's flat conditions builder. Cinder owns
   * condition rows, arbitrary field entry, fixed operators, and typed value
   * controls; this component retains only the console's visual/raw toggle and
   * filter serialization boundary.
   */
  import {
    InvocationRuleBuilder,
    type InvocationRuleCondition,
    type InvocationRuleFieldType,
    type InvocationRuleOption,
    JsonViewer,
    SegmentedControl,
    Segment,
  } from '@lostgradient/cinder';
  import { untrack } from 'svelte';

  import type { AttributeFilter, AttributeScalar } from '../../../lib/attribute-filters.ts';
  import {
    attributeFiltersToInvocationConditions,
    createEmptyQueryConditionRow,
    invocationConditionsToAttributeFilters,
    invocationConditionsToRawPreview,
  } from './query-builder.ts';

  interface QueryBuilderProps {
    attributes: readonly AttributeFilter[];
    onAttributesChange: (next: AttributeFilter[]) => void;
    /** Observed attribute names remain typeahead suggestions; Cinder also permits arbitrary keys. */
    knownAttributeKeys: readonly string[];
  }

  let { attributes, onAttributesChange, knownAttributeKeys }: QueryBuilderProps = $props();

  function valuesForAttribute(attribute: AttributeFilter): AttributeScalar[] {
    const exact =
      attribute.value === undefined
        ? []
        : Array.isArray(attribute.value)
          ? attribute.value
          : [attribute.value];
    return [
      ...exact,
      ...(attribute.gt === undefined ? [] : [attribute.gt]),
      ...(attribute.lt === undefined ? [] : [attribute.lt]),
      ...(attribute.gte === undefined ? [] : [attribute.gte]),
      ...(attribute.lte === undefined ? [] : [attribute.lte]),
    ];
  }

  function fieldTypeFor(key: string): InvocationRuleFieldType | undefined {
    const attribute = attributes.find((candidate) => candidate.key === key);
    if (attribute === undefined) return undefined;
    const values = valuesForAttribute(attribute);
    if (values.length > 0 && values.every((value) => typeof value === 'boolean')) return 'boolean';
    if (values.length > 0 && values.every((value) => typeof value === 'number')) return 'number';
    return undefined;
  }

  const fieldOptions = $derived(
    knownAttributeKeys.map((key): InvocationRuleOption => {
      const type = fieldTypeFor(key);
      return { value: key, label: key, ...(type === undefined ? {} : { type }) };
    }),
  );

  const blankCondition = (): InvocationRuleCondition => {
    const row = createEmptyQueryConditionRow();
    return { id: row.id, field: row.key, operator: row.operator, value: row.value };
  };

  let conditions = $state<InvocationRuleCondition[]>(
    untrack(() => {
      const seeded = attributeFiltersToInvocationConditions(attributes);
      return seeded.length > 0 ? seeded : [blankCondition()];
    }),
  );
  let mode = $state<'visual' | 'raw'>('visual');

  const rawPreview = $derived(invocationConditionsToRawPreview(conditions));

  function handleConditionsChange(nextConditions: InvocationRuleCondition[]): void {
    // Keep one editable placeholder visible after the last condition is
    // removed, while blank rows remain excluded from URL serialization.
    conditions = nextConditions.length > 0 ? nextConditions : [blankCondition()];
    onAttributesChange(invocationConditionsToAttributeFilters(nextConditions));
  }
</script>

<div class="weft-query-builder">
  <div class="weft-query-builder__mode-toggle">
    <SegmentedControl
      id="weft-query-builder-mode"
      label="View"
      labelVisible={false}
      density="toolbar"
      value={mode}
      onValueChange={(value) => (mode = value)}
    >
      <Segment value="visual">Visual</Segment>
      <Segment value="raw">Raw</Segment>
    </SegmentedControl>
  </div>

  {#if mode === 'visual'}
    <InvocationRuleBuilder
      mode="flat-conditions"
      {conditions}
      {fieldOptions}
      label="Workflow filters"
      onValueChange={handleConditionsChange}
    />
  {:else}
    <JsonViewer value={rawPreview} initialDepth={6} />
  {/if}
</div>
