# LocaleProvider · accessibility

## Pattern

LocaleProvider does not render a DOM wrapper or change the semantic tree. It only publishes locale and direction context to descendants.

Purpose: Context provider that supplies a shared locale and text direction default to locale-aware descendant components.

## Use when

- Setting one application or subtree locale for number, region, date, or time formatting.
- Providing text direction once for direction-aware descendants while still allowing local overrides.

## Avoid when

- Only one component needs a non-default locale — pass that component's locale prop directly instead.

## Keyboard and focus

LocaleProvider has no keyboard behavior. Keyboard behavior belongs to the descendant components it wraps.

## Names, roles, and state

LocaleProvider renders no role, label, or state by itself. Descendant components remain responsible for their own accessible names, descriptions, and states.

## Verification

- Render a locale-aware descendant inside LocaleProvider.
- Verify the descendant still exposes the same role, name, and state.
- Verify an explicit locale prop on a descendant overrides the provider locale.

Related components: `number-input`, `phone-input`, `stat`.
