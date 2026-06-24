<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Context provider that supplies a shared locale and text direction default to locale-aware descendant components.
   * @tag locale
   * @tag internationalization
   * @useWhen Setting one application or subtree locale for number, region, date, or time formatting.
   * @useWhen Providing text direction once for direction-aware descendants while still allowing local overrides.
   * @avoidWhen Only one component needs a non-default locale — pass that component's locale prop directly instead.
   * @related number-input, phone-input, stat
   */
  export type { LocaleProviderProps, TextDirection } from './locale-provider.types.ts';
</script>

<script lang="ts">
  import { setLocaleContext, type LocaleContext } from '../../_internal/locale-context.ts';
  import type { LocaleProviderProps } from './locale-provider.types.ts';

  let { locale, direction, children }: LocaleProviderProps = $props();

  const context: LocaleContext = {
    get locale() {
      return locale;
    },
    get direction() {
      return direction;
    },
  };

  setLocaleContext(context);
</script>

{@render children?.()}
