# ParameterField · accessibility

## Design review

The nearest neighbours are `NumberInput`, `Slider`, and `FormField`. Those primitives collect or label a value, but none owns the inherited-base-versus-local-override state, reset action, or unsaved and experimental status that define this component. The review therefore admitted ParameterField as a separate composition boundary rather than adding parameter-specific state to the general-purpose numeric controls. The narrow rail and compact status treatment were accepted because the visible label, textual badges, current value, and reset action carry the same information without depending on color or the rail alone.

## Accessibility review

The visible label directly names both the default output and the editor contract exposed to custom child snippets. The override rail is supplemental: the component also exposes override state through the Reset to default action, so color is never the only signal. The reset control is keyboard accessible and its tooltip includes the inherited value and unit. Unsaved and Experimental badges use visible text rather than color alone.
