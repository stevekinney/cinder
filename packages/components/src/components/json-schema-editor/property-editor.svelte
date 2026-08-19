<script lang="ts" module>
  import type { JsonSchemaTypeName, JsonSchemaValue } from './json-schema-editor-types.ts';
  import type { EnumDraft } from './enum-editor.svelte';

  export type PropertyEditorProps = {
    idPrefix: string;
    value: JsonSchemaValue;
    path: string;
    depth?: number;
    /** The property key this editor renders, when nested under a PropertyList row. Threaded to a nested PropertyList so it can label its table. */
    propertyKey?: string | undefined;
    readonly?: boolean;
    enumDrafts?: Record<string, Record<number, EnumDraft>>;
    historyRevision?: number;
    onvalidationErrorcount?: ((count: number) => void) | undefined;
    onEnumDraftsChange?: ((next: Record<string, Record<number, EnumDraft>>) => void) | undefined;
    onValueChange: (
      next: JsonSchemaValue,
      options?: { coalesceKey?: string; label?: string },
    ) => void;
    class?: string;
  };

  // The branch-keying helper is extracted to a `.ts` sibling because TypeScript's
  // ambient `*.svelte` shape doesn't surface module-block named exports cleanly,
  // and we want it directly unit-testable.
  export { reconcileCompositionBranchKeys } from './composition-branch-keys.ts';
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import Alert from '../alert/alert.svelte';
  import Badge from '../badge/badge.svelte';
  import Button from '../button/button.svelte';
  import Checkbox from '../checkbox/checkbox.svelte';
  import Collapsible from '@lostgradient/cinder/collapsible';
  import Input from '../input/input.svelte';

  import { reconcileCompositionBranchKeys } from './composition-branch-keys.ts';
  import {
    DEFAULT_COLLAPSE_DEPTH,
    EDITABLE_KEYWORDS,
    MAX_RENDER_DEPTH,
    PRIMITIVE_TYPES,
  } from './property-editor.constants.ts';
  import type { JsonSchemaObject } from './json-schema-editor-types.ts';
  import PropertyEditor from './property-editor.svelte';
  import PropertyEditorConstraints from './property-editor-constraints.svelte';
  import EnumEditor from './enum-editor.svelte';
  import PropertyList from './property-list.svelte';

  let {
    idPrefix,
    value,
    path,
    depth = 0,
    propertyKey,
    readonly = false,
    enumDrafts = {},
    historyRevision = 0,
    onvalidationErrorcount,
    onEnumDraftsChange,
    onValueChange,
    class: className,
  }: PropertyEditorProps = $props();

  // ===== Boolean schema short-circuit =====
  const isBooleanSchema = $derived(typeof value === 'boolean');

  // ===== Object-shape derivations =====
  const objectValue = $derived.by<JsonSchemaObject>(() => {
    if (typeof value === 'boolean') return {};
    return value;
  });

  // Preserve original `type` representation: scalar vs single-element array.
  const originalTypeRepresentation = $derived<'scalar' | 'array' | 'absent'>(
    objectValue.type === undefined
      ? 'absent'
      : Array.isArray(objectValue.type)
        ? 'array'
        : 'scalar',
  );

  const selectedTypes = $derived.by<JsonSchemaTypeName[]>(() => {
    const t = objectValue.type;
    if (t === undefined) return [];
    return Array.isArray(t) ? [...t] : [t];
  });

  const isAnyType = $derived(selectedTypes.length === 0);
  const hasEnum = $derived(Array.isArray(objectValue.enum));

  const preservedKeys = $derived.by(() =>
    Object.keys(objectValue).filter(
      (key) => !EDITABLE_KEYWORDS.has(key) || (key === 'enum' && !Array.isArray(objectValue.enum)),
    ),
  );

  // ===== Mutation helpers =====
  function patch(
    edits: Partial<JsonSchemaObject>,
    opts: { coalesceKey?: string; label?: string } | undefined = undefined,
  ) {
    if (readonly) return;
    const next: JsonSchemaObject = { ...objectValue, ...edits };
    // Drop keys whose new value is undefined so we don't accumulate noise.
    for (const key of Object.keys(edits)) {
      if (next[key] === undefined) delete next[key];
    }
    onValueChange(next, opts);
  }

  function setTypeFromCheckboxes(types: JsonSchemaTypeName[]) {
    if (readonly) return;
    if (types.length === 0) {
      patch({ type: undefined }, { label: 'change type' });
      return;
    }
    if (types.length === 1) {
      // Preserve original representation when going back to a single type.
      const next = originalTypeRepresentation === 'array' ? types : types[0]!;
      patch({ type: next }, { label: 'change type' });
      return;
    }
    patch({ type: types }, { label: 'change type' });
  }

  function toggleType(type: JsonSchemaTypeName, checked: boolean) {
    const current = new Set(selectedTypes);
    if (checked) current.add(type);
    else current.delete(type);
    setTypeFromCheckboxes([...current]);
  }

  function setAny(any: boolean) {
    if (any) {
      setTypeFromCheckboxes([]);
    } else {
      // Unchecking "Any" with no specific type selected would leave the schema
      // typeless again — default to 'object' so the user has something to work with.
      if (selectedTypes.length === 0) setTypeFromCheckboxes(['object']);
    }
  }

  function convertBooleanToObject() {
    if (readonly) return;
    onValueChange({}, { label: 'convert to object schema' });
  }

  // ===== Visibility flags for type-specific sections =====
  const showStringConstraints = $derived(selectedTypes.includes('string'));
  const showNumberConstraints = $derived(
    selectedTypes.includes('number') || selectedTypes.includes('integer'),
  );
  const showObjectConstraints = $derived(selectedTypes.includes('object'));
  const showArrayConstraints = $derived(selectedTypes.includes('array'));

  // ===== Recursion guard =====
  const tooDeep = $derived(depth >= MAX_RENDER_DEPTH);
  // Keep the root expanded; child nodes start collapsed at depth >= DEFAULT_COLLAPSE_DEPTH.
  let userExpanded = $state(false);
  const collapsedByDefault = $derived(depth >= DEFAULT_COLLAPSE_DEPTH);
  const collapsed = $derived(collapsedByDefault && !userExpanded);

  function summaryLine(): string {
    if (typeof value === 'boolean')
      return value ? 'true (allow anything)' : 'false (allow nothing)';
    const parts: string[] = [];
    if (objectValue.type !== undefined) {
      parts.push(Array.isArray(objectValue.type) ? objectValue.type.join('|') : objectValue.type);
    } else {
      parts.push('any');
    }
    if (objectValue.properties) {
      parts.push(`${Object.keys(objectValue.properties).length} props`);
    }
    if (objectValue.title) parts.push(`"${objectValue.title}"`);
    return parts.join(' · ');
  }

  // ===== Children (object/array) =====
  let childValidationCounts = $state<Record<string, number>>({});
  const retainedDraftCount = $derived(
    Object.entries(enumDrafts)
      .filter(([draftPath]) => draftPath === `${path}/enum` || draftPath.startsWith(`${path}/`))
      .reduce((count, [, drafts]) => count + Object.keys(drafts).length, 0),
  );
  const validationErrorCount = $derived(
    Math.max(
      Object.values(childValidationCounts).reduce((total, count) => total + count, 0),
      retainedDraftCount,
    ),
  );

  $effect(() => {
    onvalidationErrorcount?.(validationErrorCount);
  });

  onDestroy(() => {
    onvalidationErrorcount?.(0);
  });

  function setChildValidationErrorCount(key: string, count: number): void {
    if ((childValidationCounts[key] ?? 0) === count) return;
    if (count === 0) {
      const { [key]: _removedChildCount, ...remainingChildCounts } = childValidationCounts;
      childValidationCounts = remainingChildCounts;
      return;
    }
    childValidationCounts = { ...childValidationCounts, [key]: count };
  }

  function patchProperties(properties: Record<string, JsonSchemaValue>, required: string[]) {
    const edits: Partial<JsonSchemaObject> = { properties };
    edits.required = required.length > 0 ? required : undefined;
    patch(edits, { label: 'edit properties' });
  }

  function setItems(items: JsonSchemaValue) {
    patch({ items }, { label: 'edit items' });
  }

  function setEnum(enabled: boolean) {
    if (!enabled) {
      const { [`${path}/enum`]: _removedDraft, ...remainingDrafts } = enumDrafts;
      onEnumDraftsChange?.(remainingDrafts);
    }
    patch(
      { enum: enabled ? (Array.isArray(objectValue.enum) ? objectValue.enum : ['']) : undefined },
      { label: 'edit enum' },
    );
  }

  function setEnumValues(
    values: unknown[],
    options: { coalesceKey?: string; label?: string } | undefined = undefined,
  ) {
    patch({ enum: values }, options ?? { label: 'edit enum values' });
  }

  // ===== Composition =====
  function patchComposition(
    keyword: 'oneOf' | 'anyOf' | 'allOf' | 'not',
    next: JsonSchemaValue[] | JsonSchemaValue | undefined,
  ) {
    patch({ [keyword]: next } as Partial<JsonSchemaObject>, {
      label: `edit ${keyword}`,
    });
  }

  // Stable identity keys for composition branches. Plain counter (not $state) so
  // generating a new key never writes reactive state.
  let nextCompositionBranchKey = 1;
  function createCompositionBranchKey(): string {
    return `branch-${nextCompositionBranchKey++}`;
  }

  // Per-keyword key arrays as separate $state values so the template reacts to
  // add/remove operations. $effect.pre reconciles them before the DOM updates.
  // Writing only when the count actually changed avoids an infinite loop.
  let allOfKeys = $state<string[]>([]);
  let anyOfKeys = $state<string[]>([]);
  let oneOfKeys = $state<string[]>([]);

  $effect.pre(() => {
    const allOfCount = objectValue.allOf?.length ?? 0;
    if (allOfKeys.length !== allOfCount) {
      allOfKeys = reconcileCompositionBranchKeys(allOfKeys, allOfCount, createCompositionBranchKey);
    }
  });
  $effect.pre(() => {
    const anyOfCount = objectValue.anyOf?.length ?? 0;
    if (anyOfKeys.length !== anyOfCount) {
      anyOfKeys = reconcileCompositionBranchKeys(anyOfKeys, anyOfCount, createCompositionBranchKey);
    }
  });
  $effect.pre(() => {
    const oneOfCount = objectValue.oneOf?.length ?? 0;
    if (oneOfKeys.length !== oneOfCount) {
      oneOfKeys = reconcileCompositionBranchKeys(oneOfKeys, oneOfCount, createCompositionBranchKey);
    }
  });

  const compositionBranchKeys = $derived({
    allOf: allOfKeys,
    anyOf: anyOfKeys,
    oneOf: oneOfKeys,
  });

  function setKeywordKeys(keyword: 'allOf' | 'anyOf' | 'oneOf', keys: string[]) {
    if (keyword === 'allOf') allOfKeys = keys;
    else if (keyword === 'anyOf') anyOfKeys = keys;
    else oneOfKeys = keys;
  }

  function removeCompositionBranch(keyword: 'allOf' | 'anyOf' | 'oneOf', branchIndex: number) {
    const list = Array.isArray(objectValue[keyword]) ? [...objectValue[keyword]!] : [];
    const removedBranchKey = compositionBranchKeys[keyword][branchIndex];
    const nextBranchKeys = [...compositionBranchKeys[keyword]];
    list.splice(branchIndex, 1);
    nextBranchKeys.splice(branchIndex, 1);
    const branchPrefix = `${path}/${keyword}/`;
    onEnumDraftsChange?.(
      Object.fromEntries(
        Object.entries(enumDrafts).flatMap(([draftPath, draft]) => {
          if (!draftPath.startsWith(branchPrefix)) return [[draftPath, draft]];
          const remainder = draftPath.slice(branchPrefix.length);
          const match = /^(\d+)(\/.*)?$/.exec(remainder);
          if (!match) return [[draftPath, draft]];
          const index = Number(match[1]);
          if (index === branchIndex) return [];
          const nextIndex = index > branchIndex ? index - 1 : index;
          return [[`${branchPrefix}${nextIndex}${match[2] ?? ''}`, draft]];
        }),
      ),
    );
    setKeywordKeys(keyword, nextBranchKeys);
    if (removedBranchKey) setChildValidationErrorCount(`${keyword}:${removedBranchKey}`, 0);
    patchComposition(keyword, list.length > 0 ? list : undefined);
  }

  function addCompositionBranch(keyword: 'allOf' | 'anyOf' | 'oneOf') {
    const list = Array.isArray(objectValue[keyword]) ? [...objectValue[keyword]!] : [];
    list.push({});
    setKeywordKeys(keyword, [...compositionBranchKeys[keyword], createCompositionBranchKey()]);
    patchComposition(keyword, list);
  }
</script>

<div class={classNames('cinder-jse-property-editor', className)} data-cinder-jse-depth={depth}>
  {#if tooDeep}
    <Alert variant="info">
      Schema depth exceeded ({MAX_RENDER_DEPTH}). Edit deeper sections via the JSON view.
    </Alert>
  {:else if isBooleanSchema}
    <div class="cinder-jse-boolean-schema">
      <span>Boolean schema — {value ? 'allows anything' : 'allows nothing'}.</span>
      <Button variant="secondary" size="sm" disabled={readonly} onclick={convertBooleanToObject}>
        Convert to object schema
      </Button>
    </div>
  {:else if collapsed}
    <button type="button" class="cinder-jse-collapsed" onclick={() => (userExpanded = true)}>
      <span class="cinder-jse-collapsed__summary">{summaryLine()}</span>
      <span class="cinder-jse-collapsed__hint">Expand</span>
    </button>
  {:else}
    {#if depth > 0 && collapsedByDefault}
      <div class="cinder-jse-section-header">
        <Button variant="ghost" size="sm" onclick={() => (userExpanded = false)}>Collapse</Button>
      </div>
    {/if}

    <!-- Common (Title + Description) leads at the top of every node — no section header. -->
    <div class="cinder-jse-section cinder-jse-section--lead">
      <Input
        id={`${idPrefix}-title`}
        label="Title"
        value={objectValue.title ?? ''}
        disabled={readonly}
        oninput={(event: Event) =>
          patch(
            { title: (event.target as HTMLInputElement).value || undefined },
            { coalesceKey: `title:${path}`, label: 'edit title' },
          )}
      />
      <Input
        id={`${idPrefix}-description`}
        label="Description"
        value={objectValue.description ?? ''}
        disabled={readonly}
        oninput={(event: Event) =>
          patch(
            { description: (event.target as HTMLInputElement).value || undefined },
            { coalesceKey: `description:${path}`, label: 'edit description' },
          )}
      />
    </div>

    <!-- Type section -->
    <div class="cinder-jse-section">
      <h4 class="cinder-jse-section__title">Type</h4>
      <div class="cinder-jse-type-row">
        <Checkbox
          id={`${idPrefix}-type-any`}
          checked={isAnyType}
          label="Any"
          disabled={readonly}
          onchange={(event: Event) => setAny((event.target as HTMLInputElement).checked)}
        />
        {#each PRIMITIVE_TYPES as primitive (primitive)}
          <Checkbox
            id={`${idPrefix}-type-${primitive}`}
            checked={selectedTypes.includes(primitive)}
            label={primitive}
            disabled={readonly}
            onchange={(event: Event) =>
              toggleType(primitive, (event.target as HTMLInputElement).checked)}
          />
        {/each}
      </div>
    </div>

    <div class="cinder-jse-section">
      <Checkbox
        id={`${idPrefix}-enum`}
        checked={hasEnum}
        label="Enum values"
        disabled={readonly}
        onchange={(event: Event) => setEnum((event.target as HTMLInputElement).checked)}
      />
      {#if hasEnum}
        <EnumEditor
          idPrefix={`${idPrefix}-enum`}
          path={`${path}/enum`}
          values={objectValue.enum ?? []}
          drafts={enumDrafts[`${path}/enum`] ?? {}}
          {historyRevision}
          {readonly}
          onvalidationErrorcount={(count) => setChildValidationErrorCount('enum', count)}
          onDraftsChange={(next) => onEnumDraftsChange?.({ ...enumDrafts, [`${path}/enum`]: next })}
          onValuesChange={setEnumValues}
        />
      {/if}
    </div>

    <!-- Object constraints (properties + required) — comes early because it's the heaviest. -->
    {#if showObjectConstraints}
      <div class="cinder-jse-section">
        <h4 class="cinder-jse-section__title">Properties</h4>
        <PropertyList
          {idPrefix}
          {readonly}
          {depth}
          {enumDrafts}
          {historyRevision}
          parentKey={propertyKey}
          path={`${path}/properties`}
          properties={objectValue.properties ?? {}}
          required={objectValue.required ?? []}
          onvalidationErrorcount={(count) => setChildValidationErrorCount('properties', count)}
          {onEnumDraftsChange}
          onValueChange={patchProperties}
        />
      </div>
    {/if}

    <!-- Array items -->
    {#if showArrayConstraints}
      <div class="cinder-jse-section">
        <h4 class="cinder-jse-section__title">Array items</h4>
        <PropertyEditor
          idPrefix={`${idPrefix}-items`}
          path={`${path}/items`}
          depth={depth + 1}
          {readonly}
          {enumDrafts}
          {historyRevision}
          value={objectValue.items ?? {}}
          onvalidationErrorcount={(count) => setChildValidationErrorCount('items', count)}
          {onEnumDraftsChange}
          onValueChange={(next) => setItems(next)}
        />
      </div>
    {/if}

    <PropertyEditorConstraints
      {idPrefix}
      value={objectValue}
      {path}
      {readonly}
      showString={showStringConstraints}
      showNumber={showNumberConstraints}
      onPatch={patch}
    />

    <!-- Composition (only when present) -->
    {#each ['allOf', 'anyOf', 'oneOf'] as const as keyword (keyword)}
      {#if Array.isArray(objectValue[keyword])}
        <Collapsible
          class="cinder-jse-section cinder-jse-section--collapsible"
          trigger={keyword}
          open
        >
          <div class="cinder-jse-section__body">
            {#each objectValue[keyword] as branch, branchIndex (compositionBranchKeys[keyword][branchIndex])}
              {@const branchKey = compositionBranchKeys[keyword][branchIndex]}
              <PropertyEditor
                idPrefix={`${idPrefix}-${keyword}-${branchIndex}`}
                path={`${path}/${keyword}/${branchIndex}`}
                depth={depth + 1}
                {readonly}
                {enumDrafts}
                {historyRevision}
                value={branch}
                onvalidationErrorcount={(count) =>
                  setChildValidationErrorCount(`${keyword}:${branchKey}`, count)}
                {onEnumDraftsChange}
                onValueChange={(next) => {
                  const list = [...objectValue[keyword]!];
                  list[branchIndex] = next;
                  patchComposition(keyword, list);
                }}
              />
              <Button
                variant="ghost"
                size="xs"
                disabled={readonly}
                onclick={() => removeCompositionBranch(keyword, branchIndex)}
              >
                Remove branch
              </Button>
            {/each}
            <Button
              variant="secondary"
              size="sm"
              disabled={readonly}
              onclick={() => addCompositionBranch(keyword)}
            >
              Add {keyword} branch
            </Button>
          </div>
        </Collapsible>
      {/if}
    {/each}

    <!-- $ref — visible only when set; otherwise an inline trigger to add one. -->
    {#if objectValue.$ref !== undefined}
      <div class="cinder-jse-section">
        <h4 class="cinder-jse-section__title">$ref</h4>
        <Input
          id={`${idPrefix}-ref`}
          label="$ref URI"
          value={objectValue.$ref}
          disabled={readonly}
          oninput={(event: Event) =>
            patch(
              { $ref: (event.target as HTMLInputElement).value || undefined },
              { coalesceKey: `$ref:${path}`, label: 'edit $ref' },
            )}
        />
        <Button
          variant="ghost"
          size="xs"
          disabled={readonly}
          onclick={() => patch({ $ref: undefined }, { label: 'remove $ref' })}
        >
          Remove $ref
        </Button>
      </div>
    {:else if !readonly}
      <div class="cinder-jse-advanced-row">
        <Button
          variant="ghost"
          size="xs"
          onclick={() => patch({ $ref: '' }, { label: 'add $ref' })}
        >
          Add $ref
        </Button>
      </div>
    {/if}

    {#if preservedKeys.length > 0}
      <div class="cinder-jse-advanced-row">
        <Badge variant="info">+{preservedKeys.length} preserved</Badge>
        <span>Preserved keywords: {preservedKeys.join(', ')}</span>
      </div>
    {/if}
  {/if}
</div>
