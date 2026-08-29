# ModalRegion accessibility review

Nearest neighbours: `Modal`, `ConfirmDialog`, and `ToastRegion`. Region-owned entries compose `Modal`, inheriting its focus management, Escape stack, scroll lock, SSR gate, and transition lifecycle. Declarative `Modal` remains the recommended choice for local triggers.
