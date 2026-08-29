# TerminalOutput accessibility review

TerminalOutput is read-only and has no keyboard interaction. It renders a
polite `role="log"`; consumers provide an accessible name through `aria-label`
or `aria-labelledby`. ANSI color decorates text and is never its sole meaning.

Nearest neighbours are Feed log, CodeBlock, and TerminalFrame. Feed does not
interpret terminal control sequences, while CodeBlock is static source text.
