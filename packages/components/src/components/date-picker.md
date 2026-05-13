# DatePicker

A calendar popover anchored to a readonly text input. Supports single-date and range selection with locale-aware day headers and month titles.

## Props

| Prop           | Type                                                      | Default              | Description                                      |
| -------------- | --------------------------------------------------------- | -------------------- | ------------------------------------------------ |
| `id`           | `string`                                                  | required             | Stable id for label/ARIA wiring                  |
| `label`        | `string`                                                  | —                    | Visible label (required for standalone use)      |
| `value`        | `Date \| null` (single) or `[Date, Date] \| null` (range) | —                    | Controlled value (bindable)                      |
| `defaultValue` | Same as `value`                                           | `null`               | Uncontrolled initial value and form-reset target |
| `mode`         | `'single' \| 'range'`                                     | `'single'`           | Selection mode — non-reactive after mount        |
| `locale`       | `string`                                                  | `navigator.language` | BCP-47 locale tag for formatting                 |
| `min`          | `Date`                                                    | —                    | Earliest selectable day (inclusive)              |
| `max`          | `Date`                                                    | —                    | Latest selectable day (inclusive)                |
| `disabled`     | `boolean`                                                 | `false`              | Disables the trigger and popover                 |
| `required`     | `boolean`                                                 | `false`              | Marks the field required for form validation     |
| `name`         | `string`                                                  | —                    | Form submission name (adds hidden inputs)        |
| `placeholder`  | `string`                                                  | locale format hint   | Trigger placeholder when empty                   |
| `description`  | `string`                                                  | —                    | Helper text, wired to `aria-describedby`         |
| `error`        | `string`                                                  | —                    | Validation error; sets `aria-invalid="true"`     |
| `class`        | `string`                                                  | —                    | Additional class on the root element             |
| `onchange`     | `(value) => void`                                         | —                    | Fires on completed selection                     |
| `dayContent`   | `Snippet`                                                 | —                    | Custom day cell content                          |

## v1 limitations

**Typed date entry is not supported.** The trigger input is `readonly`. Users must select via the calendar popover. A locale-aware parser for typed entry is planned for v2.

**`mode` is non-reactive.** The mode prop is read once at mount. Changes after mount are silently ignored (a dev warning fires). To switch modes, remount with `{#key mode}`.

**Popover positioning** is manual (fixed below the trigger, flip-above if needed). It may misbehave in small scroll containers. `floating-ui` integration is a planned follow-up.

**Shift+arrow range extension** is not implemented. Range selection requires two separate clicks (or Enter/Space presses). This is intentional — the APG calendar pattern does not specify Shift+arrow behavior and it conflicts with grid-row navigation.

## Timezone guidance

All date operations use local calendar fields (`getFullYear`, `getMonth`, `getDate`). A `Date` constructed as `new Date(year, monthIndex, day)` is the safest input for the picker. Constructing from a UTC string (`new Date('2026-03-08')`) may produce an off-by-one in timezones with a negative UTC offset.

Hidden form inputs serialize as `YYYY-MM-DD` using local calendar fields — never `toISOString()`. This is timezone-free by construction.

## Locale strategy

When `locale` is supplied, it is used for SSR and client rendering alike — trigger text is byte-stable across hydration.

When `locale` is omitted, the trigger renders empty during SSR (no `navigator.language` on the server) and populates on the client. Pass `locale` explicitly when you need a non-empty SSR trigger for a known default value.

Invalid locale tags (e.g., `en_US` with underscore) log a dev warning and fall back to the system default.

## Form integration

When `name` is set, hidden `<input type="hidden">` elements carry the serialized value on submit:

- Single mode: `name="{name}"` with value `YYYY-MM-DD`
- Range mode: `name="{name}.start"` and `name="{name}.end"` each with `YYYY-MM-DD`

Constraint validation (required + `setCustomValidity`) uses the visible trigger input. `form.reportValidity()` focuses the trigger and shows the native validation bubble pointing at it.

## Out-of-range initial values

If `value` or `defaultValue` falls outside `[min, max]`, the value is preserved (no silent clamping). The trigger shows a `data-out-of-range` state. A dev warning fires on mount naming the constraint that was violated.

## Invalid min/max

If `min > max`, all days are disabled. A dev warning fires. The trigger's `setCustomValidity` is set to "No valid date range available."
