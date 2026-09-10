---
'@lostgradient/chat': minor
---

Terminal run frames now reach the host, and carry the failure's retryability.

`createChatSessionController` handled exactly `text`, `tool_call`, and `tool_result`. A `run.error` or `run.tripwire` frame was decoded and then silently dropped, so a provider failure mid-turn left a dangling streaming placeholder in the transcript and never reached `onError` at all — a host learned about failures only when its own transport threw.

Both frames now raise the new exported `ChatRunFailureError`, which takes the same path every other failure already takes: the streaming placeholder is cancelled, the user's message is marked failed so the existing retry affordance appears, and the error is reported through `onError`. `run.aborted` deliberately does not — an abort is a user decision, carries no error, and a banner on every Stop press would be wrong.

**This changes observable behavior for any host already emitting those frames.** `onError` will now fire where it previously stayed silent, and `sendMessage` rejects rather than resolving quietly. That is the point — the alternative was a failure the user could not see — but it is worth knowing before upgrading.

`ChatRunFailureError` carries the frame's own `{ name, message, kind, code, retryable? }` rather than flattening it to a string, and `ChatSerializedRunError` is now exported so a host can narrow it.

The wire gains an optional `retryable?: boolean` on that shape. `kind` cannot answer the question a retry affordance depends on: a rate-limited provider and a rejected API key are both `kind: 'generate'`, and only one is worth trying again. The field is optional because a host that does not classify its failures should not be forced to guess — absent means "not stated" and must not be read as either answer, so every producer written before this field keeps working unchanged. A present-but-non-boolean value is rejected at both the encoder and the decoder rather than coerced.
