# TerminalFrame accessibility review

## Admission and neighbours

TerminalFrame is admitted because it owns terminal-specific chrome, connection recovery, and character-cell resize behavior that layout primitives do not provide. Its nearest neighbours are TerminalOutput for read-only streams and PreviewPanel for generic framed content.

## Review outcome

The frame uses its visible title as its accessible name. Connection errors are announced through `role="alert"`; the reload action is a native button with visible focus treatment. Consumer content retains responsibility for the interactive terminal semantics and keyboard model. Decorative traffic lights are hidden from assistive technology. Resize notifications are programmatic only and are not announced.
