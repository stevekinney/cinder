import type { CountryCode } from 'libphonenumber-js/min';

/**
 * ISO 3166-1 alpha-2 country code accepted by `<PhoneInput>`. Re-exported from
 * `libphonenumber-js/min` so consumers do not need to depend on it directly.
 */
export type PhoneInputCountryCode = CountryCode;

/**
 * One entry in the country-code dropdown rendered by `<PhoneInput>`.
 */
export type PhoneInputCountryOption = {
  /** ISO 3166-1 alpha-2 code. */
  code: PhoneInputCountryCode;
  /** International dialing prefix without the leading plus (e.g. `'1'`, `'44'`). */
  callingCode: string;
  /** Combined label rendered in the dropdown (e.g. `'United States +1'`). */
  label: string;
  /** Human-readable country name resolved via `Intl.DisplayNames`. */
  displayName: string;
};

/**
 * Detail object passed to `onchange`. `value` is the same E.164 string that
 * lands on the bindable `value` prop.
 */
export type PhoneInputChange = {
  /** E.164 phone number, or an empty string when the number is not valid. */
  value: string;
  /** Currently selected country. */
  country: PhoneInputCountryCode;
  /** Digits-only national number (no leading country code). */
  nationalNumber: string;
  /** Whether libphonenumber considers the number both possible and valid. */
  isValid: boolean;
  /** Whether libphonenumber considers the number a possible national number. */
  isPossible: boolean;
  /** Bucket describing the outcome of this user edit. */
  reason: 'valid' | 'empty' | 'incomplete' | 'invalid' | 'country-not-allowed';
};

/**
 * Props for `<PhoneInput>`. Combines a country-code dropdown with a national
 * number input and emits an E.164 value on the bindable `value` prop only when
 * the typed number is recognised as a valid phone number for the selected
 * country.
 */
export type PhoneInputProps = {
  /** Stable id used as the national input id and as the id-prefix for the dropdown. */
  id: string;
  /** Bindable E.164 value. Defaults to an empty string. */
  value?: string;
  /** Bindable selected country. Defaults to `'US'`. */
  country?: PhoneInputCountryCode;
  /** Optional allow-list constraining which countries appear in the dropdown. */
  countries?: readonly PhoneInputCountryCode[];
  /**
   * BCP-47 locale used to resolve `Intl.DisplayNames`. Defaults to
   * `navigator.language` after mount and `'en-US'` during SSR.
   */
  locale?: string;
  /** Visible group label rendered above the controls. */
  label?: string;
  /** Visually hide the rendered `label` while keeping it programmatically associated. */
  hideLabel?: boolean;
  /** Group accessible name when no visible `label` is supplied. */
  'aria-label'?: string;
  /** Space-separated list of ids that label the group when no `label` is supplied. */
  'aria-labelledby'?: string;
  /** Optional description text rendered below the controls. */
  description?: string;
  /** Optional error message; sets `aria-invalid="true"` on the inputs. */
  error?: string;
  /** Disable every control and the hidden input. */
  disabled?: boolean;
  /** Mark the group as required for assistive technology. */
  required?: boolean;
  /** Form-control name applied to the hidden `<input>` that submits with the form. */
  name?: string;
  /** Extra class names appended to the root element. */
  class?: string;
  /**
   * Fires only for user-initiated committed value changes (editing the national
   * number, switching the country). Never fires for external value or country
   * synchronization.
   */
  onchange?: (value: string, detail: PhoneInputChange) => void;
};
