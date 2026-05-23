import type { AutocompleteProps } from './autocomplete.svelte';

// @ts-expect-error - Autocomplete owns focus handling in v1
const _onFocusRejected: AutocompleteProps = { onfocus: () => {} };

// @ts-expect-error - Autocomplete owns blur handling in v1
const _onBlurRejected: AutocompleteProps = { onblur: () => {} };

// @ts-expect-error - Autocomplete owns compositionstart handling in v1
const _onCompositionStartRejected: AutocompleteProps = { oncompositionstart: () => {} };

// @ts-expect-error - Autocomplete owns compositionend handling in v1
const _onCompositionEndRejected: AutocompleteProps = { oncompositionend: () => {} };

const _placeholderAccepted: AutocompleteProps = { placeholder: 'Search' };

void _onFocusRejected;
void _onBlurRejected;
void _onCompositionStartRejected;
void _onCompositionEndRejected;
void _placeholderAccepted;
