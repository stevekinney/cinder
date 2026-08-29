# HostProvider · accessibility

HostProvider's nearest neighbors are the overlay coordination utilities and desktop drag-region classes. It is admitted as a component because one reactive context and one pair of inherited safe-header tokens must coordinate several descendants; it has no independent visual treatment.

The provider renders a `display: contents` node and introduces no ARIA role, focus target, keyboard interaction, announcement, or motion. Desktop drag regions automatically punch common interactive descendants back out, and custom interactive islands must use the no-drag utility class. The design and accessibility review accepted the wrapper-free layout behavior and required the explicit no-drag discipline so native window movement never consumes control input.
