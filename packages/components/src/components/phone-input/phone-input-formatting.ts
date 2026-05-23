import {
  AsYouType,
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/min';

/**
 * Outcome bucket emitted by `<PhoneInput>` describing why a national-number
 * edit produced a particular E.164 result.
 */
export type PhoneInputReason = 'valid' | 'empty' | 'incomplete' | 'invalid' | 'country-not-allowed';

export type PhoneInputComputation = {
  /** The E.164 value emitted on the public `value` prop. Empty string unless `reason === 'valid'`. */
  value: string;
  /** The national-number formatted for the current country. Drives the visible input text. */
  formatted: string;
  /** Stripped-digits national number used for round-tripping across country changes. */
  nationalNumber: string;
  /** Whether libphonenumber considers the number both possible and valid. */
  isValid: boolean;
  /** Whether libphonenumber considers the number a possible national number for the country. */
  isPossible: boolean;
  /** Bucket explaining the outcome. */
  reason: PhoneInputReason;
};

/** Extract digits and a leading plus from a free-form string. */
export function stripFormatting(input: string): string {
  return input.replace(/[^\d+]/g, '');
}

/** Extract just digits from a free-form string. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Build the visible national-number display for `national` typed into the
 * field for `country`. Uses libphonenumber's `AsYouType` formatter — when the
 * formatter cannot produce a clean rendering (very short or unrecognised
 * input) the raw digits are returned unchanged.
 */
export function formatNationalAsYouType(country: CountryCode, national: string): string {
  const digits = digitsOnly(national);
  if (digits.length === 0) return '';
  const formatter = new AsYouType(country);
  const formatted = formatter.input(digits);
  return formatted.length > 0 ? formatted : digits;
}

/**
 * Build the parsing/validation result for the typed national `digits` against
 * `country`. The shape is the same whether the input is empty, incomplete,
 * invalid, or valid — only `reason`, `value`, and the validation booleans
 * change.
 */
export function computeNationalResult(country: CountryCode, digits: string): PhoneInputComputation {
  const cleaned = digitsOnly(digits);
  if (cleaned.length === 0) {
    return {
      value: '',
      formatted: '',
      nationalNumber: '',
      isValid: false,
      isPossible: false,
      reason: 'empty',
    };
  }

  const formatted = formatNationalAsYouType(country, cleaned);
  const parsed = parsePhoneNumberFromString(cleaned, country);

  if (!parsed) {
    return {
      value: '',
      formatted,
      nationalNumber: cleaned,
      isValid: false,
      isPossible: false,
      reason: 'invalid',
    };
  }

  const isPossible = parsed.isPossible();
  const isValid = parsed.isValid();

  if (isValid) {
    return {
      value: parsed.number,
      formatted,
      nationalNumber: parsed.nationalNumber,
      isValid: true,
      isPossible: true,
      reason: 'valid',
    };
  }

  if (isPossible) {
    return {
      value: '',
      formatted,
      nationalNumber: cleaned,
      isValid: false,
      isPossible: true,
      reason: 'incomplete',
    };
  }

  return {
    value: '',
    formatted,
    nationalNumber: cleaned,
    isValid: false,
    isPossible: false,
    reason: 'invalid',
  };
}

/**
 * Parse an external E.164 value into the {country, nationalDigits, display}
 * triple needed to hydrate the visible field. Returns `null` when the value
 * cannot be parsed as a phone number.
 */
export function parseE164Value(value: string): {
  country: CountryCode;
  nationalNumber: string;
  formatted: string;
  isValid: boolean;
  /** Canonical E.164 number as libphonenumber normalized it (e.g. `+14155550132`). */
  e164: string;
} | null {
  if (!value) return null;
  // Reject anything that is not a strict E.164 string. `parsePhoneNumberFromString`
  // happily extracts a number out of free-form text like "call +1 415 555 0132"
  // and would let that flow through `submittedValue` unchanged. The E.164 grammar
  // is `+` followed by up to 15 digits.
  if (!/^\+\d{1,15}$/.test(value)) return null;
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed || !parsed.country) return null;
  // Prefer libphonenumber's `formatNational()` for hydration — it carries the
  // country's conventional trunk prefix (e.g. UK "020 7946 0958") rather than
  // the bare national digits the AsYouType formatter emits when fed an
  // already-stripped national number.
  const formattedNational = parsed.formatNational();
  const formatted =
    formattedNational.length > 0
      ? formattedNational
      : formatNationalAsYouType(parsed.country, parsed.nationalNumber);
  return {
    country: parsed.country,
    nationalNumber: parsed.nationalNumber,
    formatted,
    isValid: parsed.isValid(),
    e164: parsed.number,
  };
}

/**
 * Resolve the list of countries to show in the dropdown, given an optional
 * consumer allow-list. Returns supported, unique codes. Falls back to `['US']`
 * (and reports a warning recommendation via the returned `usedFallback` flag)
 * when filtering yields an empty list.
 */
export function resolveCountryList(allowed: readonly CountryCode[] | undefined): {
  countries: CountryCode[];
  usedFallback: boolean;
} {
  const supported = new Set<CountryCode>(getCountries());
  if (!allowed) {
    return { countries: Array.from(supported).toSorted(), usedFallback: false };
  }
  const out: CountryCode[] = [];
  const seen = new Set<CountryCode>();
  for (const candidate of allowed) {
    if (supported.has(candidate) && !seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
    }
  }
  if (out.length === 0) {
    return { countries: ['US'], usedFallback: true };
  }
  return { countries: out, usedFallback: false };
}

/**
 * Resolve the human-readable display label for a country, with a built-in
 * fallback to the bare country code when `Intl.DisplayNames` is not
 * available (older runtimes or SSR-frozen contexts).
 */
export function displayNameForCountry(country: CountryCode, locale: string): string {
  try {
    const display = new Intl.DisplayNames([locale], { type: 'region' });
    const name = display.of(country);
    return name ?? country;
  } catch {
    return country;
  }
}

/** Convenience re-export so consumers can `import { getCountryCallingCode } from ...`. */
export { getCountryCallingCode };
