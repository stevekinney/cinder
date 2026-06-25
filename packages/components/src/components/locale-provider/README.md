# LocaleProvider

Shared locale and text-direction context for locale-aware descendants.

## Usage

```svelte
<script lang="ts">
  import LocaleProvider from '@lostgradient/cinder/locale-provider';
</script>

<LocaleProvider locale="de-DE">
  <!-- locale-aware cinder components -->
</LocaleProvider>
```

## Props

<!-- generated:props:start -->

| Prop        | Type               | Required | Default | Description                                                                                                                           |
| ----------- | ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `direction` | `"ltr"` \| `"rtl"` | no       | —       | Text direction exposed to direction-aware descendants.                                                                                |
| `locale`    | `string`           | no       | —       | BCP 47 locale tag used as the default for locale-aware descendants.                                                                   |
| `children`  | `(opaque)`         | no       | —       | Descendant content that should inherit the locale context. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
