<script lang="ts" module>
  import type { JsonSchemaValue } from './json-schema-editor-types.ts';

  export type PropertyListProps = {
    idPrefix: string;
    properties: Record<string, JsonSchemaValue>;
    required: string[];
    path: string;
    depth?: number;
    readonly?: boolean;
    onchange: (properties: Record<string, JsonSchemaValue>, required: string[]) => void;
  };
</script>

<script lang="ts">
  import Alert from '../alert/alert.svelte';
  import Button from '../button/button.svelte';
  import Chip from '../chip/chip.svelte';
  import Input from '../input/input.svelte';
  import PropertyEditor from './property-editor.svelte';

  let {
    idPrefix,
    properties,
    required,
    path,
    depth = 0,
    readonly = false,
    onchange,
  }: PropertyListProps = $props();

  const propertyNames = $derived(Object.keys(properties));
  const requiredOnly = $derived(required.filter((name) => !propertyNames.includes(name)));

  // Per-row draft names so a partial typed name doesn't reshape the parent.
  let draftNames = $state<Record<string, string>>({});
  let renameError = $state<string | null>(null);
  let expanded = $state<Record<string, boolean>>({});

  function getDraftName(key: string): string {
    return draftNames[key] ?? key;
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

    const next: Record<string, JsonSchemaValue> = {};
    for (const k of propertyNames) {
      next[k === oldKey ? draft : k] = properties[k]!;
    }
    const nextRequired = required.map((name) => (name === oldKey ? draft : name));

    delete draftNames[oldKey];
    if (expanded[oldKey]) {
      expanded[draft] = true;
      delete expanded[oldKey];
    }
    onchange(next, nextRequired);
  }

  function deleteProperty(key: string) {
    if (readonly) return;
    const next = { ...properties };
    delete next[key];
    const nextRequired = required.filter((name) => name !== key);
    delete draftNames[key];
    delete expanded[key];
    onchange(next, nextRequired);
  }

  function moveProperty(key: string, direction: -1 | 1) {
    if (readonly) return;
    const index = propertyNames.indexOf(key);
    const target = index + direction;
    if (target < 0 || target >= propertyNames.length) return;

    const reordered = [...propertyNames];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    const next: Record<string, JsonSchemaValue> = {};
    for (const name of reordered) next[name] = properties[name]!;
    onchange(next, required);
  }

  function toggleRequired(key: string) {
    if (readonly) return;
    const set = new Set(required);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onchange(properties, [...set]);
  }

  function setPropertySchema(key: string, schema: JsonSchemaValue) {
    if (readonly) return;
    onchange({ ...properties, [key]: schema }, required);
  }

  function addProperty() {
    if (readonly) return;
    const key = uniqueNewKey();
    onchange({ ...properties, [key]: { type: 'string' } }, required);
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
    onchange(properties, [...required, name]);
    newRequiredOnlyName = '';
  }

  function removeRequiredOnly(name: string) {
    if (readonly) return;
    onchange(
      properties,
      required.filter((entry) => entry !== name),
    );
  }
</script>

<div class="cinder-jse-property-list">
  {#if renameError}
    <Alert variant="danger">{renameError}</Alert>
  {/if}

  {#if propertyNames.length === 0}
    <p class="cinder-jse-property-list__empty">No properties yet.</p>
  {/if}

  {#each propertyNames as key (key)}
    {@const isRequired = required.includes(key)}
    {@const isOpen = expanded[key] === true}
    {@const panelId = `${idPrefix}-${key}-panel`}
    <!--
      Custom disclosure (not <details>/<summary>) so the action buttons can
      live as siblings of the trigger rather than nested inside it.
      <button> inside <summary> creates an ARIA "interactive within
      interactive" violation.
    -->
    <div class="cinder-jse-property-row" data-cinder-required={isRequired ? '' : undefined}>
      <div class="cinder-jse-property-row__summary">
        <button
          type="button"
          class="cinder-jse-property-row__trigger"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onclick={() => (expanded[key] = !isOpen)}
        >
          <span class="cinder-jse-property-row__chevron" aria-hidden="true">▸</span>
          <span class="cinder-jse-property-row__name">{key}</span>
          <span class="cinder-jse-property-row__type">{summariseType(properties[key] ?? {})}</span>
        </button>
        <span class="cinder-jse-property-row__spacer"></span>
        <Button
          variant={isRequired ? 'primary' : 'ghost'}
          size="xs"
          disabled={readonly}
          aria-pressed={isRequired}
          aria-label={isRequired ? 'Required (toggle off)' : 'Optional (toggle required)'}
          onclick={() => toggleRequired(key)}
        >
          {isRequired ? 'Required' : 'Optional'}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={readonly}
          aria-label="Move up"
          onclick={() => moveProperty(key, -1)}
        >
          ↑
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={readonly}
          aria-label="Move down"
          onclick={() => moveProperty(key, 1)}
        >
          ↓
        </Button>
        <Button
          variant="ghost-danger"
          size="xs"
          disabled={readonly}
          aria-label={`Delete ${key}`}
          onclick={() => deleteProperty(key)}
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
            path={`${path}/${key}`}
            depth={depth + 1}
            {readonly}
            value={properties[key] ?? {}}
            onchange={(next) => setPropertySchema(key, next)}
          />
        </div>
      {/if}
    </div>
  {/each}

  <Button variant="secondary" size="sm" disabled={readonly} onclick={addProperty}>
    Add property
  </Button>

  {#if !readonly || requiredOnly.length > 0}
    <details class="cinder-jse-required-only" open={requiredOnly.length > 0}>
      <summary class="cinder-jse-required-only__summary">
        Required without property schema ({requiredOnly.length})
      </summary>
      <div class="cinder-jse-required-only__panel">
        {#each requiredOnly as name (name)}
          <Chip
            mode="removable"
            label={name}
            disabled={readonly}
            onremove={() => removeRequiredOnly(name)}
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
    </details>
  {/if}
</div>
