<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose International phone-number input pairing a country-code dropdown with an as-you-type national number input and emitting E.164 values.
   * @tag form
   * @tag phone
   * @useWhen Collecting an international phone number that must be stored in a canonical E.164 form.
   * @useWhen Letting the user pick a calling country and a national number side-by-side.
   * @avoidWhen Collecting a free-form local number with no country context — use input type="tel" instead.
   * @avoidWhen Collecting an SMS verification code — use pin-input instead.
   * @related input, pin-input, form-field
   */
  export type {
    PhoneInputChange,
    PhoneInputCountryCode,
    PhoneInputCountryOption,
    PhoneInputProps,
  } from './phone-input.types.ts';
</script>

<script lang="ts">
  import type {
    PhoneInputChange,
    PhoneInputCountryCode,
    PhoneInputCountryOption,
    PhoneInputProps,
  } from './phone-input.types.ts';
  import { DEV } from 'esm-env';

  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import {
    computeNationalResult,
    digitsOnly,
    displayNameForCountry,
    formatNationalAsYouType,
    getCountryCallingCode,
    parseE164Value,
    resolveCountryList,
  } from './phone-input-formatting.ts';

  let {
    id,
    value = $bindable(''),
    country = $bindable<PhoneInputCountryCode>('US'),
    countries,
    locale,
    label,
    hideLabel = false,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    description,
    error,
    disabled,
    required,
    name,
    class: className,
    onchange,
  }: PhoneInputProps = $props();

  const context = getFormFieldContext();

  const { countries: allowedCountries, usedFallback } = $derived.by(() =>
    resolveCountryList(countries),
  );

  $effect(() => {
    if (!DEV) return;
    if (usedFallback) {
      console.warn(
        `[cinder/PhoneInput] No supported country in the provided countries allow-list — falling back to ['US'].`,
      );
    }
  });

  const resolvedLocale = $derived.by(() => {
    if (locale) return locale;
    if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
      return navigator.language;
    }
    return 'en-US';
  });

  const countryOptions = $derived<PhoneInputCountryOption[]>(
    allowedCountries.map((code) => {
      const displayName = displayNameForCountry(code, resolvedLocale);
      const callingCode = getCountryCallingCode(code);
      return {
        code,
        callingCode,
        displayName,
        label: `${displayName} +${callingCode}`,
      };
    }),
  );

  function isAllowed(code: PhoneInputCountryCode): boolean {
    return allowedCountries.includes(code);
  }

  /** Type-guard sourced from the live allow-list so we never widen an unknown string. */
  function isCountryCode(rawCode: string): rawCode is PhoneInputCountryCode {
    return isAllowed(rawCode as PhoneInputCountryCode);
  }

  function fallbackCountry(): PhoneInputCountryCode {
    return allowedCountries[0] ?? 'US';
  }

  // Internal visible national-number string. Kept separate so an internally
  // emitted `''` (incomplete / invalid) does not wipe the user's in-progress
  // digits from the field.
  let nationalDisplay = $state('');

  // Snapshots of the value/country/allow-list the component is "in sync with"
  // so we can detect external rewrites without re-acting to our own
  // emissions. Plain `let` — not reactive.
  let knownValue: string | null = null;
  let knownCountry: PhoneInputCountryCode | null = null;
  let knownAllowList: readonly PhoneInputCountryCode[] = [];

  /**
   * Synchronise to external `value` changes. Covers initial hydration too
   * because `knownValue` starts as `null` — the first run sees a difference
   * and parses whatever the consumer passed in.
   */
  $effect(() => {
    if (value === knownValue) return;
    knownValue = value;
    if (!value) {
      nationalDisplay = '';
      return;
    }
    const parsed = parseE164Value(value);
    if (!parsed) {
      nationalDisplay = value;
      return;
    }
    if (!isAllowed(parsed.country)) {
      // External value lands on a disallowed country: switch the dropdown to
      // the fallback so the field keeps a sensible context, but hold the
      // visible text as the literal E.164 input so the user can correct it.
      country = fallbackCountry();
      knownCountry = country;
      nationalDisplay = value;
      return;
    }
    country = parsed.country;
    knownCountry = parsed.country;
    nationalDisplay = parsed.formatted;
  });

  /**
   * Synchronise to external `country` changes. Reformat the existing digits
   * for the new country, but never emit. Initial `country` prop comes
   * through this path too.
   */
  $effect(() => {
    if (country === knownCountry) return;
    knownCountry = country;
    if (!isAllowed(country)) {
      if (DEV) {
        console.warn(
          `[cinder/PhoneInput] country="${country}" is not in the countries allow-list — falling back to "${fallbackCountry()}".`,
        );
      }
      country = fallbackCountry();
      return;
    }
    if (nationalDisplay) {
      const digits = digitsOnly(nationalDisplay);
      nationalDisplay = formatNationalAsYouType(country, digits);
    }
  });

  /**
   * React when the allow-list itself changes — re-validate the selected
   * country, reformat the visible digits, AND recompute the bindable E.164
   * `value`. Without the value recompute, the public API can diverge from
   * the visible state (e.g. shrinking countries from ['US','GB'] to ['US']
   * while `value` is `+442079460958` would keep the disallowed E.164 string
   * on the prop). Prop synchronization — never fires `onchange`.
   */
  $effect(() => {
    if (allowedCountries === knownAllowList) return;
    knownAllowList = allowedCountries;
    if (!isAllowed(country)) {
      country = fallbackCountry();
      knownCountry = country;
      const digits = digitsOnly(nationalDisplay);
      nationalDisplay = formatNationalAsYouType(country, digits);
      const result = computeNationalResult(country, digits);
      // Bring the bindable `value` back in line with the new selection.
      // `''` when the preserved digits are not a valid number under the
      // fallback country — consumers see a clean state, not stale E.164.
      if (result.value !== value) {
        value = result.value;
      }
      knownValue = result.value;
    }
  });

  function detailForCountryNotAllowed(
    targetCountry: PhoneInputCountryCode,
    nationalDigits: string,
  ): PhoneInputChange {
    return {
      value: '',
      country: targetCountry,
      nationalNumber: nationalDigits,
      isValid: false,
      isPossible: false,
      reason: 'country-not-allowed',
    };
  }

  function submitFor(detail: PhoneInputChange): void {
    if (detail.value !== value) {
      value = detail.value;
      knownValue = detail.value;
    }
    onchange?.(detail.value, detail);
  }

  function handleNationalInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const rawValue = target.value;
    const trimmed = rawValue.trim();

    // If the user pasted or typed a `+`-prefixed E.164 string, attempt to
    // re-detect the country and rehydrate the visible field from the parsed
    // national format. Documented behaviour in the a11y guidance.
    if (trimmed.startsWith('+')) {
      const parsed = parseE164Value(trimmed);
      if (parsed) {
        if (!isAllowed(parsed.country)) {
          nationalDisplay = trimmed;
          submitFor(detailForCountryNotAllowed(parsed.country, parsed.nationalNumber));
          return;
        }
        country = parsed.country;
        knownCountry = parsed.country;
        nationalDisplay = parsed.formatted;
        const result = computeNationalResult(parsed.country, parsed.nationalNumber);
        submitFor({
          value: result.value,
          country: parsed.country,
          nationalNumber: result.nationalNumber,
          isValid: result.isValid,
          isPossible: result.isPossible,
          reason: result.reason,
        });
        return;
      }
    }

    const digits = digitsOnly(rawValue);
    const result = computeNationalResult(country, digits);
    nationalDisplay = result.formatted;
    submitFor({
      value: result.value,
      country,
      nationalNumber: result.nationalNumber,
      isValid: result.isValid,
      isPossible: result.isPossible,
      reason: result.reason,
    });
  }

  function handleCountryChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const rawCode = target.value;
    if (!isCountryCode(rawCode)) {
      const detail = detailForCountryNotAllowed(
        rawCode as PhoneInputCountryCode,
        digitsOnly(nationalDisplay),
      );
      submitFor(detail);
      return;
    }
    const nextCountry: PhoneInputCountryCode = rawCode;
    country = nextCountry;
    knownCountry = nextCountry;
    const digits = digitsOnly(nationalDisplay);
    const result = computeNationalResult(nextCountry, digits);
    nationalDisplay = result.formatted;
    submitFor({
      value: result.value,
      country: nextCountry,
      nationalNumber: result.nationalNumber,
      isValid: result.isValid,
      isPossible: result.isPossible,
      reason: result.reason,
    });
  }

  const groupLabelId = $derived(label ? `${id}-label` : undefined);
  const countrySelectId = $derived(`${id}-country`);
  const countryLabelId = $derived(`${id}-country-label`);
  const nationalInputId = $derived(id);
  const nationalLabelId = $derived(`${id}-national-label`);

  const defaultDescriptionId = $derived(describeId(id, !!description));
  const defaultErrorId = $derived(buildErrorId(id, !!error));
  const ownDescriptionId = $derived(
    description && defaultDescriptionId === context?.descriptionId
      ? `${id}-phone-description`
      : defaultDescriptionId,
  );
  const ownErrorId = $derived(
    error && defaultErrorId === context?.errorId ? `${id}-phone-error` : defaultErrorId,
  );
  const resolvedDescriptionId = $derived(ownDescriptionId ?? context?.descriptionId);
  const resolvedErrorId = $derived(ownErrorId ?? context?.errorId);
  const describedBy = $derived(composeDescribedBy(resolvedDescriptionId, resolvedErrorId));
  const resolvedAriaInvalid = $derived(error ? ariaInvalid(true) : context?.invalid);
  const resolvedRequired = $derived(required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  const resolvedGroupLabelledBy = $derived.by(() => {
    if (groupLabelId) return groupLabelId;
    if (context?.labelId) return context.labelId;
    if (ariaLabelledBy) return ariaLabelledBy;
    return undefined;
  });

  const groupAriaLabel = $derived(
    !resolvedGroupLabelledBy && !ariaLabelledBy ? ariaLabel : undefined,
  );

  /**
   * Compose the per-control accessible-name reference. Prefix the group label
   * (when present) so screen readers announce the consumer's "Phone number"
   * alongside the inner control's role-specific label ("Country code",
   * "Phone number").
   */
  function controlLabelledBy(controlLabelId: string): string {
    if (resolvedGroupLabelledBy) return `${resolvedGroupLabelledBy} ${controlLabelId}`;
    if (ariaLabelledBy) return `${ariaLabelledBy} ${controlLabelId}`;
    return controlLabelId;
  }

  const hasGroupAccessibleName = $derived(
    !!label || !!context?.labelId || !!ariaLabelledBy || !!ariaLabel,
  );

  $effect(() => {
    if (!DEV) return;
    if (!hasGroupAccessibleName) {
      console.warn(
        `[cinder/PhoneInput] No accessible name source for id="${id}". Provide a label, aria-label, aria-labelledby, or wrap in a FormField.`,
      );
    }
  });

  // The submittable value: only forward the E.164 value when we know it is
  // valid for the currently allowed country. Otherwise the hidden input
  // carries an empty string so the form doesn't accept malformed numbers
  // silently.
  const submittedValue = $derived.by(() => {
    if (!value) return '';
    const parsed = parseE164Value(value);
    if (!parsed) return '';
    if (!isAllowed(parsed.country)) return '';
    return parsed.isValid ? value : '';
  });
</script>

<div
  class={classNames('cinder-phone-input-field', className)}
  data-cinder-disabled={resolvedDisabled || undefined}
>
  {#if label}
    <span
      id={groupLabelId}
      class={classNames('cinder-phone-input-field__label', hideLabel && 'cinder-sr-only')}
      data-disabled={resolvedDisabled || undefined}
    >
      {label}
    </span>
  {/if}

  <div
    class="cinder-phone-input"
    role="group"
    aria-labelledby={resolvedGroupLabelledBy}
    aria-label={groupAriaLabel}
    aria-describedby={describedBy}
    aria-invalid={resolvedAriaInvalid}
    aria-required={resolvedRequired || undefined}
    aria-disabled={resolvedDisabled || undefined}
  >
    <span id={countryLabelId} class="cinder-sr-only">Country code</span>
    <select
      id={countrySelectId}
      class="cinder-phone-input__country"
      aria-labelledby={controlLabelledBy(countryLabelId)}
      aria-describedby={describedBy}
      aria-invalid={resolvedAriaInvalid}
      disabled={resolvedDisabled}
      value={country}
      onchange={handleCountryChange}
    >
      {#each countryOptions as option (option.code)}
        <option value={option.code}>{option.label}</option>
      {/each}
    </select>

    <span id={nationalLabelId} class="cinder-sr-only">Phone number</span>
    <input
      id={nationalInputId}
      class="cinder-phone-input__national"
      type="tel"
      inputmode="tel"
      autocomplete="tel-national"
      aria-labelledby={controlLabelledBy(nationalLabelId)}
      aria-describedby={describedBy}
      aria-invalid={resolvedAriaInvalid}
      aria-required={resolvedRequired || undefined}
      disabled={resolvedDisabled}
      required={resolvedRequired}
      value={nationalDisplay}
      oninput={handleNationalInput}
    />
  </div>

  {#if name}
    <input
      type="hidden"
      {name}
      value={submittedValue}
      required={resolvedRequired}
      disabled={resolvedDisabled}
    />
  {/if}

  {#if description}
    <p id={ownDescriptionId} class="cinder-phone-input-field__description">{description}</p>
  {/if}

  {#if error}
    <p
      id={ownErrorId}
      class="cinder-phone-input-field__error"
      aria-live="polite"
      aria-atomic="true"
    >
      {error}
    </p>
  {/if}
</div>
