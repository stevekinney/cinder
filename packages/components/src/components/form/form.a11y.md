# Form · accessibility

Form's nearest neighbor is the native `form` element. It exists only to coordinate asynchronous pending state without replacing native form semantics. The design and accessibility review accepted the primitive because it preserves submit events, native validation, keyboard submission, and the consumer's responsibility to expose pending feedback on the submit control.
