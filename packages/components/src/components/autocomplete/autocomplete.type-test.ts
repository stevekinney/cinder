import type { AutocompleteProps } from './autocomplete.svelte';

// @ts-expect-error - Autocomplete owns focus handling in v1
const onFocusRejected: AutocompleteProps = { onfocus: () => {} };

// @ts-expect-error - Autocomplete owns blur handling in v1
const onBlurRejected: AutocompleteProps = { onblur: () => {} };

// @ts-expect-error - Autocomplete owns compositionstart handling in v1
const onCompositionStartRejected: AutocompleteProps = { oncompositionstart: () => {} };

// @ts-expect-error - Autocomplete owns compositionend handling in v1
const onCompositionEndRejected: AutocompleteProps = { oncompositionend: () => {} };

const placeholderAccepted: AutocompleteProps = { placeholder: 'Search' };

void onFocusRejected;
void onBlurRejected;
void onCompositionStartRejected;
void onCompositionEndRejected;
void placeholderAccepted;
