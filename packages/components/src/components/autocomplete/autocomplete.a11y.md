# Autocomplete — Accessibility Rationale

Autocomplete keeps focus in the text input and exposes suggestion state through the ARIA combobox pattern. The popup is a `role="listbox"` surface, options remain plain `role="option"` rows, and the input owns `aria-activedescendant`.
