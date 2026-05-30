# FileUpload

Accessible file picker and drag-and-drop surface that validates dropped files,
announces results, and can render consumer-driven upload progress rows.

## Usage

```svelte
<script lang="ts">
  import FileUpload from 'cinder/file-upload';
  import FormField from 'cinder/form-field';

  let files = $state([]);
</script>

<FormField id="resume" label="Resume" description="PDF up to 5 MB">
  <FileUpload
    id="resume"
    accept=".pdf"
    maxSize={5 * 1024 * 1024}
    onchange={(accepted) => {
      files = accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: 'success',
      }));
    }}
    {files}
  />
</FormField>
```

## Props

<!-- generated:props:start -->

| Prop         | Type       | Required | Default | Description                                                                                                                |
| ------------ | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `accept`     | `string`   | no       | —       | Native file accept filter.                                                                                                 |
| `disabled`   | `boolean`  | no       | —       | Disables the file picker and drag-and-drop surface.                                                                        |
| `id`         | `string`   | no       | —       | Stable id for the native file input. Required when composing with `FormField`.                                             |
| `maxSize`    | `number`   | no       | —       | Maximum allowed file size in bytes.                                                                                        |
| `multiple`   | `boolean`  | no       | —       | Allow more than one file. Default `false`.                                                                                 |
| `name`       | `string`   | no       | —       | Native input name used for form submission.                                                                                |
| `class`      | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `dragActive` | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `fileList`   | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `files`      | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `idle`       | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onchange`   | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onreject`   | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-file-upload-background`
- `--cinder-file-upload-border-color`
- `--cinder-file-upload-progress-background`
- `--cinder-file-upload-progress-fill`
<!-- generated:variables:end -->
