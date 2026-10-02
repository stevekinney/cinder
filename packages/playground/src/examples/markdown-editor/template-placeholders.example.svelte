<script lang="ts" module>
  export const title = 'Template placeholders with definitions and preview';
  export const description =
    'Schema-driven {{path}} completion in the rich editor and raw Markdown, with a filled preview. Switch the definitions (schema, reduced schema, explicit candidates, empty, disabled), the preview data and the value interpretation while mounted; every value is a fixed synthetic fixture.';
</script>

<script lang="ts">
  import { Checkbox, RadioGroup } from '@lostgradient/cinder';
  import {
    MarkdownEditor,
    type EditorMode,
    type MarkdownEditorProps,
  } from '@lostgradient/editor/markdown-editor';

  type Definitions = MarkdownEditorProps['placeholderDefinitions'];
  type Values = MarkdownEditorProps['placeholderValues'];
  type Diagnostics = Parameters<
    NonNullable<MarkdownEditorProps['onPlaceholderDiagnosticsChange']>
  >[0];

  // Fixed synthetic data: every JSON kind, a nested object, a nullable union,
  // a whole array and a declared field with no sample value (`missing`).
  const properties = {
    name: { type: 'string', description: 'Display name' },
    count: { type: 'integer' },
    enabled: { type: 'boolean' },
    nothing: { type: 'null' },
    items: { type: 'array', items: {} },
    settings: { type: 'object', properties: { a: { type: 'integer' }, b: { type: 'integer' } } },
    nullable: { type: ['string', 'null'] },
    rich: { type: 'string' },
    user: { type: 'object', properties: { name: { type: 'string' } } },
    missing: { type: 'string', description: 'Declared without a sample value' },
  } as const;

  const definitionChoices: Record<string, Definitions> = {
    schema: { schema: { type: 'object', properties } },
    // The same schema without `user.name`.
    reduced: {
      schema: { type: 'object', properties: { ...properties, user: { type: 'object' } } },
    },
    candidates: {
      candidates: [
        { path: 'count', types: ['integer'] },
        { path: 'enabled', types: ['boolean'] },
        { path: 'items', types: ['array'] },
        { path: 'missing', types: ['string'], description: 'Declared without a sample value' },
        { path: 'name', types: ['string'], description: 'Display name' },
        { path: 'nothing', types: ['null'] },
        { path: 'nullable', types: ['string', 'null'] },
        { path: 'rich', types: ['string'] },
        { path: 'settings', types: ['object'] },
        { path: 'settings.a', types: ['integer'] },
        { path: 'settings.b', types: ['integer'] },
        { path: 'user', types: ['object'] },
        { path: 'user.name', types: ['string'] },
      ],
    },
    empty: { candidates: [] },
    disabled: undefined,
  };

  const valueChoices: Record<string, Values> = {
    sample: {
      name: 'Alice',
      count: 42,
      enabled: false,
      nothing: null,
      items: [1, 'x', null],
      settings: { b: 2, a: 1 },
      nullable: 'optional',
      rich: '**important**',
      user: { name: 'Ada' },
    },
    empty: {},
    none: undefined,
  };

  let value = $state('Hello {{name}}: {{rich}}, {{count}} items {{items}} and {{missing}}.');
  let mode = $state<EditorMode>('source');
  let readonly = $state(false);
  let definitionsChoice = $state('schema');
  let valuesChoice = $state('sample');
  let valueMode = $state<'text' | 'markdown'>('text');
  let diagnostics = $state<Diagnostics>([]);
</script>

<Checkbox id="template-readonly" label="Readonly" bind:checked={readonly} />
<RadioGroup name="template-definitions" label="Definitions" bind:value={definitionsChoice}>
  <RadioGroup.Option id="template-definitions-schema" value="schema" label="Schema" />
  <RadioGroup.Option id="template-definitions-reduced" value="reduced" label="Reduced schema" />
  <RadioGroup.Option
    id="template-definitions-candidates"
    value="candidates"
    label="Explicit candidates"
  />
  <RadioGroup.Option id="template-definitions-empty" value="empty" label="Empty" />
  <RadioGroup.Option id="template-definitions-disabled" value="disabled" label="Disabled" />
</RadioGroup>
<RadioGroup name="template-value-mode" label="Value interpretation" bind:value={valueMode}>
  <RadioGroup.Option id="template-value-mode-text" value="text" label="Literal text" />
  <RadioGroup.Option id="template-value-mode-markdown" value="markdown" label="Markdown" />
</RadioGroup>
<RadioGroup name="template-values" label="Preview data" bind:value={valuesChoice}>
  <RadioGroup.Option id="template-values-sample" value="sample" label="Sample" />
  <RadioGroup.Option id="template-values-empty" value="empty" label="Empty object" />
  <RadioGroup.Option id="template-values-none" value="none" label="Not supplied" />
</RadioGroup>

<MarkdownEditor
  id="template-editor"
  label="Template"
  bind:value
  bind:mode
  {readonly}
  modeToggleVisible
  placeholderDefinitions={definitionChoices[definitionsChoice]}
  placeholderValues={valueChoices[valuesChoice]}
  placeholderValueMode={valueMode}
  onPlaceholderDiagnosticsChange={(next) => (diagnostics = next)}
/>
<p>{diagnostics.length} placeholder problems</p>
