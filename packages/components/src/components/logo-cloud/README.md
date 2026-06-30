# LogoCloud

Renders a responsive cloud of customer or partner logos with optional links.

## Usage

```svelte
<script lang="ts">
  import LogoCloud from '@lostgradient/cinder/logo-cloud';

  const logos = [
    { name: 'Acme', src: '/logos/acme.svg', href: 'https://example.com/acme' },
    { name: 'Globex', src: '/logos/globex.svg' },
    { name: 'Umbra', src: '/logos/umbra.svg' },
  ];
</script>

<LogoCloud title="Trusted by leading teams" {logos} />
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
