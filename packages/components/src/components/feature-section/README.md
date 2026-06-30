# FeatureSection

Renders a feature highlight section in grid or split layout with optional media content.

## Usage

```svelte
<script lang="ts">
  import FeatureSection from '@lostgradient/cinder/feature-section';

  const items = [
    { title: 'Fast setup', description: 'Ship your first page in minutes.' },
    { title: 'Accessible by default', description: 'Built with semantic and inclusive defaults.' },
    { title: 'Themeable', description: 'Use tokens to match your brand quickly.' },
  ];
</script>

<FeatureSection title="Why teams choose Cinder" {items} />
```

## Props

<!-- generated:props:start -->

| Prop            | Type                                                          | Required | Default     | Description                                                                                                                                      |
| --------------- | ------------------------------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `as`            | `"section"` \| `"div"`                                        | no       | `"section"` | Wrapper element tag.                                                                                                                             |
| `class`         | `string`                                                      | no       | —           | Custom class merged with `.cinder-feature-section`.                                                                                              |
| `columns`       | `2` \| `3` \| `4`                                             | no       | `3`         | Grid column count used by the `grid` layout.                                                                                                     |
| `description`   | `string`                                                      | no       | —           | Optional supporting intro copy for the section heading.                                                                                          |
| `items`         | { description: `string`; icon?: `string`; title: `string` }[] | yes      | —           | Features to render.                                                                                                                              |
| `layout`        | `"grid"` \| `"split"`                                         | no       | `"grid"`    | Section layout mode.                                                                                                                             |
| `maxWidth`      | `"prose"` \| `"narrow"` \| `"wide"` \| `"full"`               | no       | `"wide"`    | Max width token forwarded to Container.                                                                                                          |
| `mediaPosition` | `"start"` \| `"end"`                                          | no       | `"end"`     | Position of optional media in split layout.                                                                                                      |
| `title`         | `string`                                                      | yes      | —           | Section title rendered above the feature list.                                                                                                   |
| `children`      | `(opaque)`                                                    | no       | —           | Optional content rendered under the heading before the features list. Not expressible in JSON Schema; see the component types for the signature. |
| `media`         | `(opaque)`                                                    | no       | —           | Optional media content for split layout. Not expressible in JSON Schema; see the component types for the signature.                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
