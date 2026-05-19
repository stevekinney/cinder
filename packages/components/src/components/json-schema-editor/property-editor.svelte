<script lang="ts" module>
  import type { JsonSchemaTypeName, JsonSchemaValue } from './json-schema-editor-types.ts';

  export type PropertyEditorProps = {
    /** Stable identifier prefix for ARIA wiring. */
    idPrefix: string;
    /** The schema node being edited. */
    value: JsonSchemaValue;
    /** Path to this node within the root schema, for stable coalesce keys. */
    path: string;
    /** Recursion depth — used to collapse deeply-nested nodes by default. */
    depth?: number;
    /** Whether the editor is read-only. */
    readonly?: boolean;
    /** Called whenever the value changes. */
    onchange: (next: JsonSchemaValue, options?: { coalesceKey?: string; label?: string }) => void;
    class?: string;
  };

  export const PRIMITIVE_TYPES: readonly JsonSchemaTypeName[] = [
    'string',
    'number',
    'integer',
    'boolean',
    'null',
    'object',
    'array',
  ] as const;

  /** Editable keywords with dedicated UI. Everything else is preserved-only. */
  export const EDITABLE_KEYWORDS = new Set<string>([
    'type',
    'title',
    'description',
    'default',
    'examples',
    'const',
    'enum',
    'minLength',
    'maxLength',
    'pattern',
    'format',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
    'properties',
    'required',
    'additionalProperties',
    'items',
    'minItems',
    'maxItems',
    'uniqueItems',
    'oneOf',
    'anyOf',
    'allOf',
    'not',
    '$ref',
    '$schema',
  ]);

  /** Default render-collapsed depth for child nodes. */
  export const DEFAULT_COLLAPSE_DEPTH = 3;

  /** Hard recursion limit — deeper nodes show a placeholder. */
  export const MAX_RENDER_DEPTH = 30;

  export const NUMBER_CONSTRAINT_FIELDS = [
    { key: 'minimum', label: 'Minimum' },
    { key: 'maximum', label: 'Maximum' },
    { key: 'exclusiveMinimum', label: 'Exclusive minimum' },
    { key: 'exclusiveMaximum', label: 'Exclusive maximum' },
    { key: 'multipleOf', label: 'Multiple of' },
  ] as const;

  export type NumberConstraintKeyword = (typeof NUMBER_CONSTRAINT_FIELDS)[number]['key'];

  // The branch-keying helper is extracted to a `.ts` sibling because TypeScript's
  // ambient `*.svelte` shape doesn't surface module-block named exports cleanly,
  // and we want it directly unit-testable.
  export { reconcileCompositionBranchKeys } from './composition-branch-keys.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Alert from '../alert/alert.svelte';
  import Badge from '../badge/badge.svelte';
  import Button from '../button/button.svelte';
  import Checkbox from '../checkbox.svelte';
  import Input from '../input.svelte';
  import Tooltip from '../tooltip.svelte';

  import { reconcileCompositionBranchKeys } from './composition-branch-keys.ts';
  import type { JsonSchemaObject } from './json-schema-editor-types.ts';
  import PropertyEditor from './property-editor.svelte';
  import PropertyList from './property-list.svelte';

  let {
    idPrefix,
    value,
    path,
    depth = 0,
    readonly = false,
    onchange,
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

  const preservedKeys = $derived.by(() => {
    return Object.keys(objectValue).filter((key) => !EDITABLE_KEYWORDS.has(key));
  });

  // ===== Mutation helpers =====
  function patch(
    edits: Partial<JsonSchemaObject>,
    opts?: { coalesceKey?: string; label?: string },
  ) {
    if (readonly) return;
    const next: JsonSchemaObject = { ...objectValue, ...edits };
    // Drop keys whose new value is undefined so we don't accumulate noise.
    for (const key of Object.keys(edits)) {
      if (next[key] === undefined) delete next[key];
    }
    onchange(next, opts);
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
    onchange({}, { label: 'convert to object schema' });
  }

  function parseOptionalFiniteNumber(raw: string): number | undefined {
    if (raw === '') return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function numberConstraintValue(key: NumberConstraintKeyword): string {
    const value = objectValue[key];
    return typeof value === 'number' ? value.toString() : '';
  }

  function patchNumberConstraint(key: NumberConstraintKeyword, raw: string) {
    patch({ [key]: parseOptionalFiniteNumber(raw) } as Partial<JsonSchemaObject>, {
      coalesceKey: `${key}:${path}`,
      label: `edit ${key}`,
    });
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
  function patchProperties(properties: Record<string, JsonSchemaValue>, required: string[]) {
    const edits: Partial<JsonSchemaObject> = { properties };
    edits.required = required.length > 0 ? required : undefined;
    patch(edits, { label: 'edit properties' });
  }

  function setItems(items: JsonSchemaValue) {
    patch({ items }, { label: 'edit items' });
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
    list.splice(branchIndex, 1);
    setKeywordKeys(keyword, compositionBranchKeys[keyword].toSpliced(branchIndex, 1));
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

    <!-- Object constraints (properties + required) — comes early because it's the heaviest. -->
    {#if showObjectConstraints}
      <div class="cinder-jse-section">
        <h4 class="cinder-jse-section__title">Properties</h4>
        <PropertyList
          {idPrefix}
          {readonly}
          {depth}
          path={`${path}/properties`}
          properties={objectValue.properties ?? {}}
          required={objectValue.required ?? []}
          onchange={patchProperties}
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
          value={objectValue.items ?? {}}
          onchange={(next) => setItems(next)}
        />
      </div>
    {/if}

    <!-- String constraints — collapsed by default. -->
    {#if showStringConstraints}
      <details class="cinder-jse-section cinder-jse-section--collapsible">
        <summary class="cinder-jse-section__title">String constraints</summary>
        <div class="cinder-jse-section__body">
          <Input
            id={`${idPrefix}-minLength`}
            label="Min length"
            type="text"
            value={objectValue.minLength?.toString() ?? ''}
            disabled={readonly}
            oninput={(event: Event) => {
              const raw = (event.target as HTMLInputElement).value;
              const parsed = raw === '' ? undefined : Number.parseInt(raw, 10);
              patch(
                { minLength: Number.isNaN(parsed) ? undefined : parsed },
                { coalesceKey: `minLength:${path}`, label: 'edit minLength' },
              );
            }}
          />
          <Input
            id={`${idPrefix}-maxLength`}
            label="Max length"
            type="text"
            value={objectValue.maxLength?.toString() ?? ''}
            disabled={readonly}
            oninput={(event: Event) => {
              const raw = (event.target as HTMLInputElement).value;
              const parsed = raw === '' ? undefined : Number.parseInt(raw, 10);
              patch(
                { maxLength: Number.isNaN(parsed) ? undefined : parsed },
                { coalesceKey: `maxLength:${path}`, label: 'edit maxLength' },
              );
            }}
          />
          <Input
            id={`${idPrefix}-pattern`}
            label="Pattern (regex)"
            value={objectValue.pattern ?? ''}
            disabled={readonly}
            oninput={(event: Event) =>
              patch(
                { pattern: (event.target as HTMLInputElement).value || undefined },
                { coalesceKey: `pattern:${path}`, label: 'edit pattern' },
              )}
          />
          <Input
            id={`${idPrefix}-format`}
            label="Format"
            value={objectValue.format ?? ''}
            disabled={readonly}
            oninput={(event: Event) =>
              patch(
                { format: (event.target as HTMLInputElement).value || undefined },
                { coalesceKey: `format:${path}`, label: 'edit format' },
              )}
          />
        </div>
      </details>
    {/if}

    <!-- Number constraints — collapsed by default. -->
    {#if showNumberConstraints}
      <details class="cinder-jse-section cinder-jse-section--collapsible">
        <summary class="cinder-jse-section__title">Number constraints</summary>
        <div class="cinder-jse-section__body">
          {#each NUMBER_CONSTRAINT_FIELDS as field (field.key)}
            <Input
              id={`${idPrefix}-${field.key}`}
              label={field.label}
              value={numberConstraintValue(field.key)}
              disabled={readonly}
              oninput={(event: Event) =>
                patchNumberConstraint(field.key, (event.target as HTMLInputElement).value)}
            />
          {/each}
        </div>
      </details>
    {/if}

    <!-- Composition (only when present) -->
    {#each ['allOf', 'anyOf', 'oneOf'] as const as keyword (keyword)}
      {#if Array.isArray(objectValue[keyword])}
        <details class="cinder-jse-section cinder-jse-section--collapsible" open>
          <summary class="cinder-jse-section__title">{keyword}</summary>
          <div class="cinder-jse-section__body">
            {#each objectValue[keyword] as branch, branchIndex (compositionBranchKeys[keyword][branchIndex])}
              <PropertyEditor
                idPrefix={`${idPrefix}-${keyword}-${branchIndex}`}
                path={`${path}/${keyword}/${branchIndex}`}
                depth={depth + 1}
                {readonly}
                value={branch}
                onchange={(next) => {
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
        </details>
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
        {#if preservedKeys.length > 0}
          <Tooltip text={`Preserved keys: ${preservedKeys.join(', ')}`}>
            <Badge variant="info">+{preservedKeys.length} preserved</Badge>
          </Tooltip>
        {/if}
      </div>
    {/if}

    <!-- Preserved-keywords badge for the readonly case (Add $ref is hidden). -->
    {#if readonly && objectValue.$ref === undefined && preservedKeys.length > 0}
      <Tooltip text={`Preserved keys: ${preservedKeys.join(', ')}`}>
        <Badge variant="info">+{preservedKeys.length} preserved</Badge>
      </Tooltip>
    {/if}
  {/if}
</div>
