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

  // Internal visible national-number string. Kept separate so an internally
  // emitted `''` (incomplete/invalid) does not wipe the user's in-progress
  // digits from the field.
  let nationalDisplay = $state('');

  // Track the last external value/country we synced so we don't loop on
  // self-emitted prop changes.
  let lastSyncedValue = '';
  let lastSyncedCountry: PhoneInputCountryCode | null = null;
  let hasMounted = false;

  function isAllowed(code: PhoneInputCountryCode): boolean {
    return allowedCountries.includes(code);
  }

  function fallbackCountry(): PhoneInputCountryCode {
    return allowedCountries[0] ?? 'US';
  }

  // Initial sync: derive nationalDisplay from any provided value or use the
  // initial `country`. Run inside an effect so it only fires once on mount.
  $effect(() => {
    if (hasMounted) return;
    hasMounted = true;
    if (value) {
      const parsed = parseE164Value(value);
      if (parsed && isAllowed(parsed.country)) {
        country = parsed.country;
        nationalDisplay = parsed.formatted;
        lastSyncedValue = value;
        lastSyncedCountry = parsed.country;
        return;
      }
      if (parsed && !isAllowed(parsed.country)) {
        nationalDisplay = value;
        lastSyncedValue = value;
        lastSyncedCountry = country;
        return;
      }
    }
    if (!isAllowed(country)) {
      if (DEV) {
        console.warn(
          `[cinder/PhoneInput] country="${country}" is not in the countries allow-list — falling back to "${fallbackCountry()}".`,
        );
      }
      country = fallbackCountry();
    }
    lastSyncedCountry = country;
  });

  // React to external `value` changes after mount: re-parse and re-sync the
  // visible field. We compare against the last value we observed so our own
  // emissions don't trigger a re-parse.
  $effect(() => {
    if (!hasMounted) return;
    if (value === lastSyncedValue) return;
    lastSyncedValue = value;
    if (!value) {
      // External clear: empty the visible field too.
      nationalDisplay = '';
      return;
    }
    const parsed = parseE164Value(value);
    if (!parsed) {
      nationalDisplay = value;
      return;
    }
    if (!isAllowed(parsed.country)) {
      // Keep the displayed text as the literal E.164 input, force the country
      // back to the fallback, mark invalid via reason='country-not-allowed'.
      country = fallbackCountry();
      nationalDisplay = value;
      return;
    }
    country = parsed.country;
    nationalDisplay = parsed.formatted;
  });

  // React to external `country` changes after mount: when the country flips
  // without a corresponding value flip, reformat the existing digits for the
  // new country. Suppress for the synthetic country writes we make above.
  $effect(() => {
    if (!hasMounted) return;
    if (country === lastSyncedCountry) return;
    lastSyncedCountry = country;
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
      lastSyncedValue = detail.value;
    }
    onchange?.(detail.value, detail);
  }

  function handleNationalInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const rawValue = target.value;
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
    const nextCountry = target.value as PhoneInputCountryCode;
    if (!isAllowed(nextCountry)) {
      const detail = detailForCountryNotAllowed(nextCountry, digitsOnly(nationalDisplay));
      submitFor(detail);
      return;
    }
    country = nextCountry;
    lastSyncedCountry = nextCountry;
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
  const countrySelectId = `${id}-country`;
  const countryLabelId = `${id}-country-label`;
  const nationalInputId = id;
  const nationalLabelId = `${id}-national-label`;

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
  // valid. Otherwise the hidden input carries an empty string so the form
  // doesn't accept malformed numbers silently.
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
      aria-labelledby={countryLabelId}
      aria-describedby={describedBy}
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
      aria-labelledby={nationalLabelId}
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
    <input type="hidden" {name} value={submittedValue} {required} {disabled} />
  {/if}

  {#if description}
    <p id={ownDescriptionId} class="cinder-phone-input-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={ownErrorId} class="cinder-phone-input-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
