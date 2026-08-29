# TerminalFrame design and accessibility review

## Design review (required)

- Reviewer: Cinder maintainers
- Review outcome: Approved. The frame provides restrained terminal chrome without competing with the consumer-owned PTY content.
- Nearest neighbours: TerminalOutput, PreviewPanel.
- Why this component exists: TerminalOutput is read-only and PreviewPanel lacks terminal connection state and character-cell resize reporting.
- Findings and resolutions: Decorative traffic lights are visually quiet, the title and status remain readable, errors appear in a dedicated band, and the viewport preserves nested overflow containment.

## Novel interaction accessibility review

- Applies: No—the frame owns only a native reload button; the consumer-owned PTY supplies its own terminal keyboard model.
- Reviewer: Cinder maintainers
- Review outcome: Approved. The wrapper does not intercept terminal input or introduce a competing focus scope.

### Focus management

The frame never moves focus. Reload uses a native button and remains in document order. When an error clears, focus stays on the reload button if it remains mounted or follows normal browser behavior if the consumer removes it.

### Keyboard matrix

| Key or gesture   | Context            | Expected behavior                              |
| ---------------- | ------------------ | ---------------------------------------------- |
| Enter or Space   | Reload button      | Invokes the consumer-provided reload callback. |
| Any terminal key | Consumer PTY child | Passes through without frame interception.     |

### Assistive-technology announcements

The visible title names the frame through `aria-labelledby`, connection status remains visible text, and errors use `role="alert"`. Decorative traffic lights are hidden. Resize callbacks are programmatic and are not announced.
