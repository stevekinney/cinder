import {
  computeNationalResult,
  digitsOnly,
  formatNationalAsYouType,
  parseE164Value,
} from './phone-input-formatting.ts';
import type { PhoneInputChange, PhoneInputCountryCode } from './phone-input.types.ts';

type StateOptions = {
  getCountry: () => PhoneInputCountryCode;
  setCountry: (country: PhoneInputCountryCode) => void;
  getDisplay: () => string;
  setDisplay: (display: string) => void;
  getValue: () => string;
  setValue: (value: string) => void;
  setKnownValue: (value: string) => void;
  setKnownCountry: (country: PhoneInputCountryCode) => void;
  isAllowed: (country: PhoneInputCountryCode) => boolean;
  isCountryCode: (value: string) => value is PhoneInputCountryCode;
  fallbackCountry: () => PhoneInputCountryCode;
  getInitialValue: () => string;
  getInitialCountry: () => PhoneInputCountryCode;
  getFieldRoot: () => HTMLElement | undefined;
  setSelectedCountry: (country: PhoneInputCountryCode) => void;
  getOnValueChange: () => ((detail: PhoneInputChange) => void) | undefined;
};

function countryNotAllowed(
  country: PhoneInputCountryCode,
  nationalNumber: string,
): PhoneInputChange {
  return {
    value: '',
    country,
    nationalNumber,
    isValid: false,
    isPossible: false,
    reason: 'country-not-allowed',
  };
}

function submit(options: StateOptions, detail: PhoneInputChange): void {
  if (detail.value !== options.getValue()) {
    options.setValue(detail.value);
    options.setKnownValue(detail.value);
  }
  options.getOnValueChange()?.(detail);
}

export function createPhoneInputState(options: StateOptions) {
  function handleNationalInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const rawValue = target.value;
    const trimmed = rawValue.trim();
    if (trimmed.startsWith('+')) {
      const parsed = parseE164Value(trimmed);
      if (parsed) {
        if (!options.isAllowed(parsed.country)) {
          options.setDisplay(trimmed);
          submit(options, countryNotAllowed(parsed.country, parsed.nationalNumber));
          return;
        }
        options.setCountry(parsed.country);
        options.setKnownCountry(parsed.country);
        options.setDisplay(parsed.formatted);
        const result = computeNationalResult(parsed.country, parsed.nationalNumber);
        submit(options, {
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
    const country = options.getCountry();
    const result = computeNationalResult(country, digits);
    options.setDisplay(result.formatted);
    submit(options, {
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
    if (!options.isCountryCode(rawCode)) {
      return;
    }
    const country = rawCode;
    if (!options.isAllowed(country)) {
      submit(options, countryNotAllowed(country, digitsOnly(options.getDisplay())));
      return;
    }
    options.setCountry(country);
    options.setKnownCountry(country);
    const result = computeNationalResult(country, digitsOnly(options.getDisplay()));
    options.setDisplay(result.formatted);
    submit(options, {
      value: result.value,
      country,
      nationalNumber: result.nationalNumber,
      isValid: result.isValid,
      isPossible: result.isPossible,
      reason: result.reason,
    });
  }

  function handleFormReset(event: Event): void {
    const valueAtReset = options.getValue();
    const countryAtReset = options.getCountry();
    queueMicrotask(() =>
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        if (hasExternalReset(options, valueAtReset, countryAtReset)) {
          options.setSelectedCountry(resetSelection(options));
          return;
        }
        applyInitialReset(options);
      }),
    );
  }

  return { handleCountryChange, handleFormReset, handleNationalInput };
}

function hasExternalReset(
  options: StateOptions,
  valueAtReset: string,
  countryAtReset: PhoneInputCountryCode,
): boolean {
  return options.getValue() !== valueAtReset || options.getCountry() !== countryAtReset;
}

function resetSelection(options: StateOptions): PhoneInputCountryCode {
  const country = options.getCountry();
  return options.isAllowed(country) ? country : options.fallbackCountry();
}

function resolveInitialResetCountry(
  options: StateOptions,
  parsed: ReturnType<typeof parseE164Value>,
  rawCountry: string,
): PhoneInputCountryCode {
  if (parsed) return options.isAllowed(parsed.country) ? parsed.country : options.fallbackCountry();
  if (options.isAllowed(options.getInitialCountry())) return options.getInitialCountry();
  return options.isCountryCode(rawCountry) ? rawCountry : options.fallbackCountry();
}

function resolveInitialDisplay(
  options: StateOptions,
  parsed: ReturnType<typeof parseE164Value>,
  resetCountry: PhoneInputCountryCode,
): string {
  if (parsed && options.isAllowed(parsed.country)) return parsed.formatted;
  if (parsed) return options.getInitialValue();
  return options.getInitialValue() === digitsOnly(options.getInitialValue())
    ? formatNationalAsYouType(resetCountry, options.getInitialValue())
    : options.getInitialValue();
}

function applyInitialReset(options: StateOptions): void {
  const root = options.getFieldRoot();
  const rawCountry = root?.querySelector<HTMLSelectElement>('select')?.value;
  if (!rawCountry) return;
  const initialValue = options.getInitialValue();
  const parsed = parseE164Value(initialValue);
  const resetCountry = resolveInitialResetCountry(options, parsed, rawCountry);
  options.setCountry(resetCountry);
  options.setSelectedCountry(resetCountry);
  options.setKnownCountry(resetCountry);
  options.setValue(initialValue);
  options.setKnownValue(initialValue);
  const select = root?.querySelector<HTMLSelectElement>('select');
  if (select && select.value !== resetCountry) select.value = resetCountry;
  const resetDisplay = resolveInitialDisplay(options, parsed, resetCountry);
  options.setDisplay(resetDisplay);
  const input = root?.querySelector<HTMLInputElement>('input:not([type="hidden"])');
  if (input && input.value !== resetDisplay) input.value = resetDisplay;
}
