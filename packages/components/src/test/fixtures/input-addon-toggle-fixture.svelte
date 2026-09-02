<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { InputType } from '../../components/input/input.types.ts';

  /**
   * Test fixture that renders ONE `<Input>` call site per host and lets a test
   * toggle its `leading` / `trailing` addons, `type`, and `error` reactively.
   *
   * The addons reach `Input` through a spread whose type is already narrowed
   * to the `InputProps` leading/trailing union, so toggling an addon is a prop
   * update on the same `Input` instance. Two `<Input>` invocations in `{#if}`
   * arms (the shape `form-field-input-fixture.svelte` uses) would be two
   * instances and therefore two native elements whatever `Input` does, which
   * is exactly the thing these tests must not confuse with Input's own
   * behaviour.
   */
  export type InputAddonToggleFixtureProps = {
    id: string;
    /**
     * Where the `Input` sits:
     * - `bare`: on its own, so it renders its own field frame.
     * - `field`: inside a `FormField` with no label/description/error of its
     *   own, so it renders only the control (the `control()` snippet path).
     * - `field-with-own-label`: inside a `FormField` but with its own label,
     *   so it renders a nested field frame.
     */
    host?: 'bare' | 'field' | 'field-with-own-label';
    type?: InputType;
    // `| undefined` on purpose: tests toggle an addon OFF with
    // `rerender({ trailing: undefined })`, and `exactOptionalPropertyTypes`
    // would otherwise reject the explicit undefined.
    leading?: Snippet<[]> | undefined;
    trailing?: Snippet<[]> | undefined;
    error?: string | undefined;
  };
</script>

<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import Input from '../../components/input/input.svelte';

  let {
    id,
    host = 'bare',
    type = 'text',
    leading,
    trailing,
    error,
  }: InputAddonToggleFixtureProps = $props();

  const addons = $derived(
    leading && trailing
      ? { leading, trailing }
      : leading
        ? { leading }
        : trailing
          ? { trailing }
          : {},
  );
  const optional = $derived(error !== undefined ? { error } : {});
</script>

{#if host === 'bare'}
  <Input {id} value="hello world" {type} {...optional} {...addons} />
{:else if host === 'field'}
  <FormField {id} label="Field">
    <Input {id} value="hello world" {type} {...optional} {...addons} />
  </FormField>
{:else}
  <FormField {id} label="Field">
    <Input {id} value="hello world" label="Own label" {type} {...optional} {...addons} />
  </FormField>
{/if}
