# LogoCloud

TODO: one-line purpose statement for LogoCloud.

## Usage

```svelte
<script lang="ts">
  import LogoCloud from '@lostgradient/cinder/logo-cloud';
</script>

<LogoCloud>Content</LogoCloud>
```

## Props

<!-- generated:props:start -->

| Prop          | Type                                                 | Required | Default     | Description                                    |
| ------------- | ---------------------------------------------------- | -------- | ----------- | ---------------------------------------------- |
| `as`          | `"section"` \| `"div"`                               | no       | `"section"` | Wrapper element tag.                           |
| `class`       | `string`                                             | no       | —           | Custom class merged with `.cinder-logo-cloud`. |
| `columns`     | `3` \| `4` \| `5` \| `6`                             | no       | `5`         | Grid columns on wide screens.                  |
| `description` | `string`                                             | no       | —           | Optional support text under heading.           |
| `grayscale`   | `boolean`                                            | no       | `true`      | Apply grayscale filter until hover.            |
| `logos`       | { href?: `string`; name: `string`; src: `string` }[] | yes      | —           | Logos to render in the cloud.                  |
| `maxWidth`    | `"prose"` \| `"narrow"` \| `"wide"` \| `"full"`      | no       | `"wide"`    | Max width token forwarded to Container.        |
| `title`       | `string`                                             | no       | —           | Optional heading text for the logo cloud.      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
