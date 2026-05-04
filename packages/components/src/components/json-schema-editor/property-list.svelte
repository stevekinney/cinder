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
  import Alert from '../alert.svelte';
  import Button from '../button.svelte';
  import Checkbox from '../checkbox.svelte';
  import Input from '../input.svelte';
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

  // Required-only names (in `required` but not in `properties`) round-trip via
  // a separate advanced section. Editing this section never invents a
  // `properties` entry.
  const propertyNames = $derived(Object.keys(properties));
  const requiredOnly = $derived(required.filter((name) => !propertyNames.includes(name)));

  // Per-row draft names (separate from committed key) so a partial typed name
  // doesn't reshape the parent on every keystroke.
  let draftNames = $state<Record<string, string>>({});
  let renameError = $state<string | null>(null);

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

    // Atomically rebuild properties preserving order and update `required`.
    const next: Record<string, JsonSchemaValue> = {};
    for (const k of propertyNames) {
      next[k === oldKey ? draft : k] = properties[k]!;
    }
    const nextRequired = required.map((name) => (name === oldKey ? draft : name));

    delete draftNames[oldKey];
    onchange(next, nextRequired);
  }

  function deleteProperty(key: string) {
    if (readonly) return;
    const next = { ...properties };
    delete next[key];
    const nextRequired = required.filter((name) => name !== key);
    delete draftNames[key];
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

  function toggleRequired(key: string, isRequired: boolean) {
    if (readonly) return;
    const set = new Set(required);
    if (isRequired) set.add(key);
    else set.delete(key);
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
  }

  // ===== Required-only chip editing =====
  let newRequiredOnlyName = $state('');

  function addRequiredOnly() {
    if (readonly) return;
    const name = newRequiredOnlyName.trim();
    if (!name) return;
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
    <Alert variant="error">{renameError}</Alert>
  {/if}

  {#each propertyNames as key (key)}
    <div class="cinder-jse-property-row">
      <Input
        id={`${idPrefix}-${key}-name`}
        label="Name"
        value={getDraftName(key)}
        disabled={readonly}
        oninput={(event: Event) => (draftNames[key] = (event.target as HTMLInputElement).value)}
        onblur={() => commitRename(key)}
      />
      <Checkbox
        id={`${idPrefix}-${key}-required`}
        label="Required"
        checked={required.includes(key)}
        disabled={readonly}
        onchange={(event: Event) => toggleRequired(key, (event.target as HTMLInputElement).checked)}
      />
      <Button variant="ghost" size="sm" disabled={readonly} onclick={() => moveProperty(key, -1)}>
        ↑
      </Button>
      <Button variant="ghost" size="sm" disabled={readonly} onclick={() => moveProperty(key, 1)}>
        ↓
      </Button>
      <Button variant="danger" size="sm" disabled={readonly} onclick={() => deleteProperty(key)}>
        Delete
      </Button>

      <PropertyEditor
        idPrefix={`${idPrefix}-${key}-schema`}
        path={`${path}/${key}`}
        depth={depth + 1}
        {readonly}
        value={properties[key] ?? {}}
        onchange={(next) => setPropertySchema(key, next)}
      />
    </div>
  {/each}

  <Button variant="secondary" size="sm" disabled={readonly} onclick={addProperty}>
    Add property
  </Button>

  {#if requiredOnly.length > 0 || newRequiredOnlyName.length > 0}
    <div class="cinder-jse-required-only">
      <h4 class="cinder-jse-required-only__title">Required without property schema</h4>
      {#each requiredOnly as name (name)}
        <span class="cinder-jse-required-only__chip">
          {name}
          <Button
            variant="ghost"
            size="sm"
            disabled={readonly}
            onclick={() => removeRequiredOnly(name)}
          >
            ×
          </Button>
        </span>
      {/each}
      <Input
        id={`${idPrefix}-required-only-add`}
        label="Add required name"
        value={newRequiredOnlyName}
        disabled={readonly}
        oninput={(event: Event) => (newRequiredOnlyName = (event.target as HTMLInputElement).value)}
        onkeydown={(event: KeyboardEvent) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            addRequiredOnly();
          }
        }}
      />
    </div>
  {/if}
</div>
