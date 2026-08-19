<script lang="ts" module>
  import type { JsonSchemaValue } from './json-schema-editor-types.ts';
  import type { EnumDraft } from './enum-editor.svelte';

  export type PropertyListProps = {
    idPrefix: string;
    properties: Record<string, JsonSchemaValue>;
    required: string[];
    path: string;
    depth?: number;
    readonly?: boolean;
    enumDrafts?: Record<string, Record<number, EnumDraft>>;
    onvalidationErrorcount?: ((count: number) => void) | undefined;
    onEnumDraftsChange?: ((next: Record<string, Record<number, EnumDraft>>) => void) | undefined;
    onValueChange: (properties: Record<string, JsonSchemaValue>, required: string[]) => void;
  };
</script>

<script lang="ts">
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import { onDestroy, tick } from 'svelte';
  import Alert from '../alert/alert.svelte';
  import Button from '../button/button.svelte';
  import Chip from '../chip/chip.svelte';
  import Badge from '@lostgradient/cinder/badge';
  import Collapsible from '@lostgradient/cinder/collapsible';
  import Input from '../input/input.svelte';
  import PropertyEditor from './property-editor.svelte';
  import { calculatePropertyValidationErrorCount } from './property-list-validation.ts';

  let {
    idPrefix,
    properties,
    required,
    path,
    depth = 0,
    readonly = false,
    enumDrafts = {},
    onvalidationErrorcount,
    onEnumDraftsChange,
    onValueChange,
  }: PropertyListProps = $props();

  const propertyNames = $derived(Object.keys(properties));
  const requiredOnly = $derived(required.filter((name) => !propertyNames.includes(name)));

  // Per-row draft names so a partial typed name doesn't reshape the parent.
  let draftNames = $state<Record<string, string>>({});
  let renameError = $state<string | null>(null);
  let expanded = $state<Record<string, boolean>>({});
  let childValidationCounts = $state<Record<string, number>>({});

  const validationErrorCount = $derived(
    calculatePropertyValidationErrorCount(
      propertyNames,
      childValidationCounts,
      renameError !== null,
    ),
  );

  function retainedDraftCount(key: string): number {
    const propertyPrefix = `${path}/${pointerSegment(key)}`;
    return Object.entries(enumDrafts)
      .filter(
        ([draftPath]) => draftPath === propertyPrefix || draftPath.startsWith(`${propertyPrefix}/`),
      )
      .reduce((count, [, drafts]) => count + Object.keys(drafts).length, 0);
  }

  $effect(() => {
    onvalidationErrorcount?.(validationErrorCount);
  });

  onDestroy(() => {
    onvalidationErrorcount?.(0);
  });

  function getDraftName(key: string): string {
    return draftNames[key] ?? key;
  }

  function pointerSegment(value: string): string {
    return value.replaceAll('~', '~0').replaceAll('/', '~1');
  }

  function rebaseEnumDrafts(oldKey: string, newKey: string): void {
    const oldPrefix = `${path}/${pointerSegment(oldKey)}`;
    const newPrefix = `${path}/${pointerSegment(newKey)}`;
    const next = Object.fromEntries(
      Object.entries(enumDrafts).map(([draftPath, draft]) => [
        draftPath === oldPrefix || draftPath.startsWith(`${oldPrefix}/`)
          ? `${newPrefix}${draftPath.slice(oldPrefix.length)}`
          : draftPath,
        draft,
      ]),
    );
    onEnumDraftsChange?.(next);
  }

  function uniqueNewKey(): string {
    let suffix = 1;
    let candidate = 'newField';
    while (Object.prototype.hasOwnProperty.call(properties, candidate)) {
      suffix += 1;
      candidate = `newField${suffix}`;
    }
    return candidate;
  }

  function commitRename(oldKey: string) {
    if (readonly) return;
    const draft = getDraftName(oldKey).trim();
    if (!draft) {
      renameError = 'Property name cannot be empty';
      return;
    }
    if (draft === oldKey) {
      renameError = null;
      return;
    }
    if (Object.prototype.hasOwnProperty.call(properties, draft)) {
      renameError = `Duplicate property name: ${draft}`;
      return;
    }
    renameError = null;
    rebaseEnumDrafts(oldKey, draft);

    const next: Record<string, JsonSchemaValue> = Object.create(null);
    for (const k of propertyNames) {
      next[k === oldKey ? draft : k] = properties[k]!;
    }
    const nextRequired = required.map((name) => (name === oldKey ? draft : name));

    delete draftNames[oldKey];
    if (expanded[oldKey]) {
      expanded[draft] = true;
      delete expanded[oldKey];
    }
    const childCount = childValidationCounts[oldKey];
    if (childCount !== undefined) {
      const { [oldKey]: _removedChildCount, ...remainingChildCounts } = childValidationCounts;
      childValidationCounts = { ...remainingChildCounts, [draft]: childCount };
    }
    onValueChange(next, nextRequired);
  }

  let actionAnnouncement = $state('');
  const propertyTriggerElements = new Map<string, HTMLButtonElement>();
  let addPropertyElement: HTMLSpanElement | undefined = $state();

  function propertyTrigger(element: HTMLButtonElement, key: string) {
    propertyTriggerElements.set(key, element);
    return {
      update(nextKey: string) {
        if (nextKey === key) return;
        propertyTriggerElements.delete(key);
        key = nextKey;
        propertyTriggerElements.set(key, element);
      },
      destroy() {
        propertyTriggerElements.delete(key);
      },
    };
  }

  async function announceAction(message: string) {
    actionAnnouncement = '';
    await tick();
    actionAnnouncement = message;
  }

  async function deleteProperty(key: string, index: number) {
    if (readonly) return;
    const focusKey = propertyNames[index + 1] ?? propertyNames[index - 1];
    const next = { ...properties };
    delete next[key];
    const nextRequired = required.filter((name) => name !== key);
    delete draftNames[key];
    delete expanded[key];
    const propertyPrefix = `${path}/${pointerSegment(key)}`;
    onEnumDraftsChange?.(
      Object.fromEntries(
        Object.entries(enumDrafts).filter(
          ([draftPath]) =>
            draftPath !== propertyPrefix && !draftPath.startsWith(`${propertyPrefix}/`),
        ),
      ),
    );
    const { [key]: _removedChildCount, ...remainingChildCounts } = childValidationCounts;
    childValidationCounts = remainingChildCounts;
    onValueChange(next, nextRequired);
    await announceAction(`Deleted ${key} property.`);
    await tick();
    const focusTarget = focusKey
      ? propertyTriggerElements.get(focusKey)
      : addPropertyElement?.querySelector<HTMLButtonElement>('button');
    focusTarget?.focus();
  }

  function setChildValidationErrorCount(key: string, count: number): void {
    if ((childValidationCounts[key] ?? 0) === count) return;
    if (count === 0) {
      const { [key]: _removedChildCount, ...remainingChildCounts } = childValidationCounts;
      childValidationCounts = remainingChildCounts;
      return;
    }
    childValidationCounts = { ...childValidationCounts, [key]: count };
  }

  function toggleExpanded(key: string, isOpen: boolean): void {
    expanded[key] = !isOpen;
    if (isOpen) setChildValidationErrorCount(key, 0);
  }

  async function moveProperty(key: string, direction: -1 | 1, index: number) {
    if (readonly || !canMoveProperty(index, direction)) return;
    const target = index + direction;
    if (target < 0 || target >= propertyNames.length) return;

    const reordered = [...propertyNames];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    const next: Record<string, JsonSchemaValue> = Object.create(null);
    for (const name of reordered) next[name] = properties[name]!;
    onValueChange(next, required);
    await announceAction(`Moved ${key} property to position ${target + 1} of ${reordered.length}.`);
  }

  function canMoveProperty(index: number, direction: -1 | 1): boolean {
    const target = index + direction;
    if (target < 0 || target >= propertyNames.length) return false;
    const reordered = [...propertyNames];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    const next: Record<string, JsonSchemaValue> = Object.create(null);
    for (const name of reordered) next[name] = properties[name]!;
    return Object.keys(next).every((name, nextIndex) => name === reordered[nextIndex]);
  }

  function toggleRequired(key: string) {
    if (readonly) return;
    const set = new Set(required);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onValueChange(properties, [...set]);
  }

  function setPropertySchema(key: string, schema: JsonSchemaValue) {
    if (readonly) return;
    onValueChange({ ...properties, [key]: schema }, required);
  }

  function addProperty() {
    if (readonly) return;
    const key = uniqueNewKey();
    onValueChange({ ...properties, [key]: { type: 'string' } }, required);
    expanded[key] = true;
  }

  function summariseType(schema: JsonSchemaValue): string {
    if (typeof schema === 'boolean') return schema ? 'true' : 'false';
    const t = schema.type;
    if (t === undefined) return 'any';
    if (Array.isArray(t)) return t.join(' | ');
    return t;
  }

  // ===== Required-only chip editing =====
  let newRequiredOnlyName = $state('');

  function addRequiredOnly() {
    if (readonly) return;
    const name = newRequiredOnlyName.trim();
    if (!name) {
      newRequiredOnlyName = '';
      return;
    }
    if (required.includes(name)) {
      newRequiredOnlyName = '';
      return;
    }
    onValueChange(properties, [...required, name]);
    newRequiredOnlyName = '';
  }

  function removeRequiredOnly(name: string) {
    if (readonly) return;
    onValueChange(
      properties,
      required.filter((entry) => entry !== name),
    );
  }
</script>

<p class="cinder-sr-only" aria-live="polite">{actionAnnouncement}</p>

<div class="cinder-jse-property-list">
  {#if renameError}
    <Alert variant="danger">{renameError}</Alert>
  {/if}

  {#if propertyNames.length === 0}
    <p class="cinder-jse-property-list__empty">No properties yet.</p>
  {/if}

  {#each propertyNames as key, index (key)}
    {@const isRequired = required.includes(key)}
    {@const isOpen = expanded[key] === true}
    {@const childValidationErrorCount = Math.max(
      childValidationCounts[key] ?? 0,
      retainedDraftCount(key),
    )}
    {@const panelId = `${idPrefix}-${key}-panel`}
    <!--
      Custom disclosure (not <details>/<summary>) so the action buttons can
      live as siblings of the trigger rather than nested inside it.
      <button> inside <summary> creates an ARIA "interactive within
      interactive" violation.
    -->
    <div
      class="cinder-jse-property-row"
      data-cinder-required={isRequired ? '' : undefined}
      data-cinder-invalid={childValidationErrorCount > 0 ? '' : undefined}
    >
      <div class="cinder-jse-property-row__summary" style={`--cinder-jse-property-depth: ${depth}`}>
        <button
          use:propertyTrigger={key}
          type="button"
          class="cinder-jse-property-row__trigger"
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${key} property${childValidationErrorCount > 0 ? `, ${childValidationErrorCount} validation ${childValidationErrorCount === 1 ? 'error' : 'errors'}` : ''}`}
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          onclick={() => toggleExpanded(key, isOpen)}
        >
          <ChevronDown
            class="cinder-jse-property-row__chevron"
            size={14}
            strokeWidth={2}
            aria-hidden="true"
          />
          <span class="cinder-jse-property-row__name">{key}</span>
          <span class="cinder-jse-property-row__type">{summariseType(properties[key] ?? {})}</span>
          {#if childValidationErrorCount > 0}
            <Badge
              variant="danger"
              aria-label={`${childValidationErrorCount} validation ${childValidationErrorCount === 1 ? 'error' : 'errors'} in ${key}`}
            >
              {childValidationErrorCount}{' '}
              {childValidationErrorCount === 1 ? 'error' : 'errors'}
            </Badge>
          {/if}
        </button>
        <span class="cinder-jse-property-row__spacer"></span>
        <Button
          variant={isRequired ? 'primary' : 'ghost'}
          size="xs"
          disabled={readonly}
          aria-pressed={isRequired}
          aria-label={`${key}: ${isRequired ? 'Required (toggle off)' : 'Optional (toggle required)'}`}
          onclick={() => toggleRequired(key)}
        >
          {isRequired ? 'Required' : 'Optional'}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={readonly || !canMoveProperty(index, -1)}
          aria-label={`Move ${key} up`}
          onclick={() => moveProperty(key, -1, index)}
        >
          ↑
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={readonly || !canMoveProperty(index, 1)}
          aria-label={`Move ${key} down`}
          onclick={() => moveProperty(key, 1, index)}
        >
          ↓
        </Button>
        <Button
          variant="ghost-danger"
          size="xs"
          disabled={readonly}
          aria-label={`Delete ${key}`}
          onclick={() => deleteProperty(key, index)}
        >
          Delete
        </Button>
      </div>

      {#if isOpen}
        <div id={panelId} class="cinder-jse-property-row__panel">
          <Input
            id={`${idPrefix}-${key}-name`}
            label="Name"
            value={getDraftName(key)}
            disabled={readonly}
            oninput={(event: Event) => (draftNames[key] = (event.target as HTMLInputElement).value)}
            onblur={() => commitRename(key)}
          />
          <PropertyEditor
            idPrefix={`${idPrefix}-${key}-schema`}
            path={`${path}/${pointerSegment(key)}`}
            depth={depth + 1}
            {readonly}
            {enumDrafts}
            value={properties[key] ?? {}}
            onvalidationErrorcount={(count) => setChildValidationErrorCount(key, count)}
            {onEnumDraftsChange}
            onValueChange={(next) => setPropertySchema(key, next)}
          />
        </div>
      {/if}
    </div>
  {/each}

  <span class="cinder-jse-property-list__add-property-reference" bind:this={addPropertyElement}>
    <Button variant="secondary" size="sm" disabled={readonly} onclick={addProperty}>
      Add property
    </Button>
  </span>

  {#if !readonly || requiredOnly.length > 0}
    <Collapsible
      class="cinder-jse-required-only"
      trigger={`Required fields not yet defined (${requiredOnly.length})`}
      open={!readonly || requiredOnly.length > 0}
    >
      <div class="cinder-jse-required-only__panel">
        {#each requiredOnly as name (name)}
          <Chip
            mode="removable"
            label={name}
            disabled={readonly}
            onRemove={() => removeRequiredOnly(name)}
          />
        {/each}
        <Input
          id={`${idPrefix}-required-only-add`}
          label="Add required name"
          value={newRequiredOnlyName}
          disabled={readonly}
          oninput={(event: Event) =>
            (newRequiredOnlyName = (event.target as HTMLInputElement).value)}
          onkeydown={(event: KeyboardEvent) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addRequiredOnly();
            }
          }}
        />
        <Button variant="secondary" size="sm" disabled={readonly} onclick={addRequiredOnly}>
          Add required name
        </Button>
      </div>
    </Collapsible>
  {/if}
</div>
