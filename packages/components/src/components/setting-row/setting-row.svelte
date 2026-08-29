<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Settings-page row that publishes form-field context to its control and supports managed-policy and disclosure details.
   * @tag form
   * @tag settings
   * @useWhen Pairing a setting label and guidance with an Input, Toggle, or Select control.
   * @avoidWhen The control belongs in a conventional stacked form field.
   * @related form-field, policy-lock
   */
  export type { SettingRowProps } from './setting-row.types.ts';
</script>

<script lang="ts">
  import FormField from '@lostgradient/cinder/form-field';
  import type { SettingRowProps } from './setting-row.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  let {
    id,
    label,
    description,
    warning,
    error,
    required,
    disabled,
    managed,
    control,
    disclosure,
    class: className,
  }: SettingRowProps = $props();
</script>

<div class={classNames('cinder-setting-row', className)}>
  <FormField {id} {label} {description} {warning} {error} {required} {disabled} {managed}>
    {@render control()}
  </FormField>
  {#if disclosure}{@render disclosure()}{/if}
</div>
