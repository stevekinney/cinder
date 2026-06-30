# NewsletterSection

Renders an email signup section with heading copy and an inline newsletter form.

## Usage

```svelte
<script lang="ts">
  import NewsletterSection from '@lostgradient/cinder/newsletter-section';
</script>

<NewsletterSection title="Get product updates in your inbox" />
```

## Props

<!-- generated:props:start -->

| Prop               | Type                                            | Required | Default           | Description                                                                                                                               |
| ------------------ | ----------------------------------------------- | -------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `as`               | `"section"` \| `"div"`                          | no       | `"section"`       | Wrapper element tag.                                                                                                                      |
| `class`            | `string`                                        | no       | —                 | Custom class merged with `.cinder-newsletter-section`.                                                                                    |
| `consentText`      | `string`                                        | no       | —                 | Optional helper/caveat text rendered under the form controls.                                                                             |
| `description`      | `string`                                        | no       | —                 | Optional supporting copy.                                                                                                                 |
| `emailLabel`       | `string`                                        | no       | `"Email address"` | Input label text.                                                                                                                         |
| `emailPlaceholder` | `string`                                        | no       | —                 | Placeholder shown in email input field.                                                                                                   |
| `maxWidth`         | `"prose"` \| `"narrow"` \| `"wide"` \| `"full"` | no       | `"wide"`          | Max width token forwarded to Container.                                                                                                   |
| `submitLabel`      | `string`                                        | no       | `"Subscribe"`     | Submit button label.                                                                                                                      |
| `title`            | `string`                                        | yes      | —                 | Main section headline.                                                                                                                    |
| `children`         | `(opaque)`                                      | no       | —                 | Optional supplemental content below helper text. Not expressible in JSON Schema; see the component types for the signature.               |
| `onSubmit`         | `(opaque)`                                      | no       | —                 | Callback fired after form submission with current email value. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
