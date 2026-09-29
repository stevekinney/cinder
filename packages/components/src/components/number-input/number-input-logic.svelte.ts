import { parseLocaleNumber } from '../../utilities/parse-locale-number.ts';

export type CommitSource = 'typed' | 'delta' | 'reset';
export type ParseStatus = 'valid' | 'empty' | 'malformed';

export function toAriaInvalidValue(value: unknown): 'true' | 'false' | undefined {
  return value === 'true' || value === 'false' ? value : undefined;
}

export function attachInputNode(
  getInputAttachment: () => ((node: HTMLInputElement) => void | (() => void)) | undefined,
  setInput: (node: HTMLInputElement | undefined) => void,
): (node: HTMLInputElement) => void | (() => void) {
  return (node) => {
    setInput(node);
    const cleanup = getInputAttachment()?.(node);
    return () => {
      cleanup?.();
      setInput(undefined);
    };
  };
}

export function applyCommit(
  next: number | null,
  parseStatus: ParseStatus,
  emitChange: boolean,
  options: {
    disabled: boolean;
    required: boolean;
    current: number | null;
    input: HTMLInputElement | undefined;
    setMalformed: (value: boolean) => void;
    setRequiredEmpty: (value: boolean) => void;
    markInternal: () => void;
    setValue: (value: number | null) => void;
    emit: (value: number | null) => void;
  },
): number | null {
  const malformed = !options.disabled && parseStatus === 'malformed';
  const requiredEmpty = !options.disabled && !malformed && options.required && next === null;
  const message = malformed
    ? 'Please enter a valid number.'
    : requiredEmpty
      ? 'Please enter a number.'
      : '';
  options.input?.setCustomValidity(message);
  options.setMalformed(malformed);
  options.setRequiredEmpty(requiredEmpty);
  if (!Object.is(next, options.current)) {
    options.markInternal();
    options.setValue(next);
  }
  if (emitChange) options.emit(next);
  return next;
}

export function synchronizeValidity(
  input: HTMLInputElement,
  state: {
    disabled: boolean;
    value: number | null | undefined;
    internalChange: boolean;
    focused: boolean;
    required: boolean;
    malformed: boolean;
    requiredEmpty: boolean;
    clearErrors: () => void;
    setRequiredEmpty: (value: boolean) => void;
  },
): void {
  if (state.disabled) {
    clearValidity(input, state);
    return;
  }
  if (hasExternalValue(state)) {
    clearValidity(input, state);
    return;
  }
  if (state.malformed) return;
  if (needsRequiredValidity(state)) {
    input.setCustomValidity('Please enter a number.');
    state.setRequiredEmpty(true);
    return;
  }
  if (shouldSuppressRequiredValidity(state)) {
    input.setCustomValidity('');
    state.setRequiredEmpty(false);
    return;
  }
  if (hasValue(state)) {
    input.setCustomValidity('');
    state.setRequiredEmpty(false);
  }
}

function clearValidity(input: HTMLInputElement, state: { clearErrors: () => void }): void {
  input.setCustomValidity('');
  state.clearErrors();
}

function hasValue(state: { value: number | null | undefined }): boolean {
  return state.value !== null && state.value !== undefined;
}

function hasExternalValue(state: {
  value: number | null | undefined;
  internalChange: boolean;
}): boolean {
  return hasValue(state) && !state.internalChange;
}

function needsRequiredValidity(state: {
  value: number | null | undefined;
  focused: boolean;
  required: boolean;
}): boolean {
  return !state.focused && state.required && !hasValue(state);
}

function shouldSuppressRequiredValidity(state: {
  focused: boolean;
  requiredEmpty: boolean;
}): boolean {
  return state.focused && state.requiredEmpty;
}

export function isValidStep(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function roundToPrecision(value: number, digits: number): number {
  return Number(value.toFixed(Math.min(digits, 12)));
}

export function fractionalDigits(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(value);
  if (!text.includes('e') && !text.includes('E')) return text.split('.')[1]?.length ?? 0;
  const [mantissa, exponentText = '0'] = text.toLowerCase().split('e');
  const exponent = Number(exponentText);
  const mantissaDigits = mantissa?.split('.')[1]?.length ?? 0;
  return Math.max(0, mantissaDigits - exponent);
}

type CommitOptions = {
  source: CommitSource;
  raw: number | null;
  parseStatus?: ParseStatus;
  min: number;
  max: number;
  snapStep: number | null;
};

export function normalizeCommitValue({
  source,
  raw,
  parseStatus = 'valid',
  min,
  max,
  snapStep,
}: CommitOptions): { value: number | null; parseStatus: ParseStatus } {
  if (raw === null || !Number.isFinite(raw)) {
    return { value: null, parseStatus: raw === null ? parseStatus : 'malformed' };
  }
  let result = raw;
  if (source === 'typed' && snapStep !== null) {
    const origin = Number.isFinite(min) ? min : 0;
    result = origin + Math.round((raw - origin) / snapStep) * snapStep;
    result = roundToPrecision(result, fractionalDigits(snapStep));
  } else if (source === 'delta' && snapStep !== null) {
    const cleanRaw = roundToPrecision(raw, 12);
    result = roundToPrecision(
      raw,
      Math.max(fractionalDigits(snapStep), fractionalDigits(cleanRaw)),
    );
  }
  return { value: Math.min(max, Math.max(min, result)), parseStatus };
}

type StepControllerOptions = {
  getValue: () => number | null | undefined;
  getEditorBuffer: () => string;
  setEditorBuffer: (value: string) => void;
  getFocused: () => boolean;
  getLocale: () => string;
  getFormat: () => Intl.NumberFormatOptions | undefined;
  getMin: () => number;
  getMax: () => number;
  getStep: () => number;
  commitNumber: (source: CommitSource, value: number) => number | null;
  buildEditDisplay: (value: number) => string;
  focus: () => void;
};

export function createStepController(options: StepControllerOptions) {
  function getBase(direction: 'increment' | 'decrement'): number {
    const parsed = options.getFocused()
      ? parseLocaleNumber(options.getEditorBuffer(), options.getLocale(), options.getFormat())
      : null;
    if (parsed?.status === 'valid') {
      return options.getFormat()?.style === 'percent'
        ? roundToPrecision(parsed.value / 100, Math.max(2, fractionalDigits(parsed.value) + 2))
        : parsed.value;
    }
    const bound = direction === 'increment' ? options.getMin() : options.getMax();
    return options.getValue() ?? (Number.isFinite(bound) ? bound : 0);
  }

  function stepBy(direction: 'increment' | 'decrement', multiplier = 1) {
    const delta = options.getStep() * multiplier * (direction === 'increment' ? 1 : -1);
    const next = options.commitNumber('delta', getBase(direction) + delta);
    if (options.getFocused()) {
      options.setEditorBuffer(next === null ? '' : options.buildEditDisplay(next));
    }
    options.focus();
  }

  function onKeyDown(event: KeyboardEvent) {
    const actions: Record<string, () => void> = {
      ArrowUp: () => stepBy('increment'),
      ArrowDown: () => stepBy('decrement'),
      PageUp: () => stepBy('increment', 10),
      PageDown: () => stepBy('decrement', 10),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
      return;
    }
    if (event.key === 'Home' && Number.isFinite(options.getMin())) {
      event.preventDefault();
      const next = options.commitNumber('delta', options.getMin());
      if (options.getFocused())
        options.setEditorBuffer(next === null ? '' : options.buildEditDisplay(next));
    } else if (event.key === 'End' && Number.isFinite(options.getMax())) {
      event.preventDefault();
      const next = options.commitNumber('delta', options.getMax());
      if (options.getFocused())
        options.setEditorBuffer(next === null ? '' : options.buildEditDisplay(next));
    }
  }

  return { onKeyDown, stepBy };
}

export function installFormListeners(
  input: HTMLInputElement,
  options: {
    isDisabled: () => boolean;
    isFocused: () => boolean;
    hasEnterKeyFlush: () => boolean;
    clearEnterKeyFlush: () => void;
    flushSubmit: () => void;
    reset: () => void;
  },
): () => void {
  const form = input.closest('form');
  if (!form) return () => {};
  const onSubmit = () => {
    if (options.isDisabled()) return;
    if (options.hasEnterKeyFlush()) {
      options.clearEnterKeyFlush();
      return;
    }
    if (options.isFocused()) options.flushSubmit();
  };
  const onReset = () => {
    if (!options.isDisabled()) options.reset();
  };
  form.addEventListener('submit', onSubmit, true);
  form.addEventListener('reset', onReset);
  return () => {
    form.removeEventListener('submit', onSubmit, true);
    form.removeEventListener('reset', onReset);
  };
}
