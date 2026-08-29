# Stack · accessibility

## Pattern

Stack is a one-dimensional layout primitive. It affects visual arrangement but does not change the meaning, focus order, or accessible names of the content it contains.

Purpose: One-dimensional flex layout primitive for arranging direct children with controlled direction, spacing, alignment, and wrapping.

## Design review

Nearest neighbours: `grid`, `cluster`, and plain flex layouts in component examples. Stack belongs as a primitive because it owns repeated direction, spacing, alignment, wrapping, and polymorphic element rendering in one predictable component-local contract; two-dimensional placement remains Grid's responsibility.

Visual outcome: a quiet, unframed flex container with no card treatment, no decorative surface, and no generated text. It should disappear behind the content it arranges.

## Keyboard and focus

Stack adds no keyboard behavior and no focusable wrapper by default. Keyboard order remains DOM order. Consumers must not use visual reversal to imply a different reading or tab sequence when order matters.

## Names, roles, and state

Stack renders no role by default. If `as` is set to a landmark or sectioning element, the caller owns the accessible name and document-outline fit.

## Reduced motion

Stack adds no motion.
