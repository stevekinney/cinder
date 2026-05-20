<script lang="ts" module>
  export type {
    JsonSchemaDraft,
    JsonSchemaEditorChangeEvent,
    JsonSchemaEditorMode,
    JsonSchemaEditorProps,
    JsonSchemaEditorRevertEvent,
    JsonSchemaEditorView,
    JsonSchemaKnownDraft,
    JsonSchemaTypeName,
    JsonSchemaValidationError,
    JsonSchemaValidationResult,
    JsonSchemaValidationStatus,
    JsonSchemaValue,
  } from './json-schema-editor.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Implementation from './json-schema-editor-impl.svelte';
  import type { JsonSchemaEditorProps } from './json-schema-editor.types.ts';

  let { view = $bindable('form'), class: className, ...rest }: JsonSchemaEditorProps = $props();

  const mergedClassName = $derived(classNames(className));
</script>

<Implementation bind:view class={mergedClassName} {...rest} />
