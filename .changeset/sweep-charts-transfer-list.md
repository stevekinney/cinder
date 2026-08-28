---
'@lostgradient/cinder': patch
---

Give MatrixChart's active cell a non-colour channel, and reuse the shared label/value ramp in
TransferList's header.

MatrixChart signalled its hovered/active cell with `filter: brightness(1.15)` alone, so the state
was conveyed by colour only. It now also doubles the cell's stroke width, which satisfies WCAG
1.4.1 without changing any cell's geometry. The chart accessibility notes across MatrixChart,
BarChart, LineChart, and AreaChart now name the specific channel that carries interaction state
rather than claiming only "distinct series colors".

TransferList's header label and count adopt the ratified `_label-value.css` classes instead of
running a second, divergent type ramp of their own.

QrCode gains a regression test proving the largest payload QR version 40 can hold, at the
strictest error-correction level, encodes and renders rather than falling into the error path.
It deliberately asserts no wall-clock budget: a timing threshold is unreliable on a contended
CI worker and is the kind of assertion that gets relaxed rather than fixed. The measurement
that closed the underlying issue lives on it instead.
