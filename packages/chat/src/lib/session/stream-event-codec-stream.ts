import { decodeChatStreamEvent } from './stream-event-codec-decoding.ts';
import type { ChatStreamEvent } from './stream-event-codec-types.ts';

type StreamGuardState = {
  /**
   * Which envelope shape this request-local stream committed to on its
   * first frame. A stream may be wholly bare (legacy) or wholly versioned —
   * never both. Accepting a bare frame after a versioned one (or vice
   * versa) would mean losing the ordering guarantee the envelope exists to
   * provide partway through the response.
   */
  mode: 'bare' | 'versioned' | undefined;
  /**
   * Which wire version this request-local stream committed to on its first
   * versioned frame. A stream speaks ONE version for its whole length.
   *
   * Separate from `mode` because the two answer different questions, and
   * only one of them can be asked per-frame. `mode` distinguishes a legacy
   * producer from a versioned one; this distinguishes two versioned
   * vocabularies, and version 2 is a superset rather than a replacement —
   * every version 1 member is also a legal version 2 member, so no
   * individual frame is malformed. A consumer that read the opening frame as
   * version 1 and then meets a version 2 frame has been told two different
   * things about which vocabulary it is reading, and the only place that is
   * visible is here.
   */
  wireVersion: 1 | 2 | undefined;
  sawTerminal: boolean;
  lastSequence: number | undefined;
};

function isTerminalChatStreamEvent(event: ChatStreamEvent): boolean {
  return (
    event.type === 'run.completed' ||
    event.type === 'run.error' ||
    event.type === 'run.tripwire' ||
    event.type === 'run.aborted'
  );
}

/**
 * Applies the stream-level invariants a single frame's own decode can't
 * check on its own: a request-local monotonically increasing `sequence`
 * (reference architecture, "Stream wire contract"), one consistent envelope
 * mode for the whole stream, and one consistent wire version within that
 * mode.
 */
function noteDecodedStreamEvent(event: ChatStreamEvent, guard: StreamGuardState): void {
  // Exactly one terminal frame is written when the connection remains
  // available, and the server closes the stream immediately after it
  // (reference architecture, "Stream wire contract"). A frame arriving
  // after a terminal one already did is a protocol violation, not just a
  // late-arriving no-op — reject it rather than silently accepting it.
  if (guard.sawTerminal)
    throw new Error('Invalid chat stream event: frame arrived after the terminal frame');

  noteFrameMode(event, guard);

  if (isTerminalChatStreamEvent(event)) guard.sawTerminal = true;
}

function noteFrameMode(event: ChatStreamEvent, guard: StreamGuardState): void {
  const frameMode: 'bare' | 'versioned' = Object.hasOwn(event, 'wireVersion')
    ? 'versioned'
    : 'bare';
  if (guard.mode === undefined) guard.mode = frameMode;
  else if (guard.mode !== frameMode)
    throw new Error('Invalid chat stream event: envelope mode changed mid-stream');
  if (frameMode === 'versioned') {
    noteWireVersion(event, guard);
    noteSequence(event, guard);
  }
}

function noteWireVersion(event: ChatStreamEvent, guard: StreamGuardState): void {
  // The frame has already decoded, so its version is one the codec speaks;
  // what is checked here is only whether it is the SAME one the stream opened
  // with.
  const wireVersion = Object.hasOwn(event, 'wireVersion') ? event.wireVersion : undefined;
  if (wireVersion === undefined) throw new Error('Invalid chat stream event: missing wireVersion');
  if (guard.wireVersion === undefined) guard.wireVersion = wireVersion;
  else if (guard.wireVersion !== wireVersion)
    throw new Error('Invalid chat stream event: wire version changed mid-stream');
}

function noteSequence(event: ChatStreamEvent, guard: StreamGuardState): void {
  const sequence = Object.hasOwn(event, 'sequence') ? event.sequence : undefined;
  if (sequence === undefined) throw new Error('Invalid chat stream event: missing sequence');
  if (guard.lastSequence !== undefined && sequence <= guard.lastSequence)
    throw new Error('Invalid chat stream event: sequence did not increase');
  guard.lastSequence = sequence;
}

/**
 * Every versioned frame ends with a newline (reference architecture, "Stream
 * wire contract"), so a non-empty buffer left over at EOF means the response
 * was cut mid-frame. The leftover may still PARSE — a stream truncated
 * immediately after a terminal frame's closing brace decodes cleanly — which
 * is exactly why the terminal-frame check alone is not enough to tell a
 * complete response from a severed one.
 *
 * Bare (legacy) streams are exempt: they predate the newline requirement and
 * a trailing frame without one has always been accepted.
 */
function assertStreamFramed(buffer: string, guard: StreamGuardState): void {
  if (guard.mode === 'versioned' && buffer.trim())
    throw new Error('Invalid chat stream event: stream ended mid-frame without a newline');
}

/**
 * A versioned stream that reaches EOF without ever emitting one of the
 * `run.*` terminal frames is a truncated response, not success (reference
 * architecture, "Stream wire contract" and "Cancellation contract"). This
 * only runs when the generator's body resumes normally past its last
 * `yield` — a consumer that stops iterating early instead calls the
 * generator's `return()`, which unwinds through any enclosing `finally`
 * blocks but never reaches this code, so a deliberate client cancellation
 * is correctly exempt without any extra bookkeeping.
 */
function assertStreamTerminated(guard: StreamGuardState): void {
  if (guard.mode === 'versioned' && !guard.sawTerminal)
    throw new Error('Invalid chat stream event: stream ended without a terminal frame');
}

/**
 * Applies the stream-level guard to events that arrive already decoded — a
 * `ChatSessionTransport` returning `AsyncIterable<ChatStreamEvent>` rather
 * than bytes. Without this, a typed iterable that ends without a terminal
 * frame, runs its sequence backwards, or switches envelope mode mid-stream
 * is accepted while the identical NDJSON response is rejected, so the
 * contract's validity would depend on the transport's representation.
 */
export async function* guardChatStreamEvents(
  events: AsyncIterable<ChatStreamEvent>,
  options?: ChatStreamDecodeOptions,
): AsyncGenerator<ChatStreamEvent> {
  const guard: StreamGuardState = {
    mode: undefined,
    wireVersion: undefined,
    sawTerminal: false,
    lastSequence: undefined,
  };
  for await (const event of events) {
    // Per-frame validation first: the static type says `ChatStreamEvent`, but
    // a transport built in JavaScript (or through a cast) can yield a frame
    // the wire decoder would refuse — `sequence: NaN`, a non-string `text` —
    // and the stream guard below assumes each frame is already well-formed.
    const decoded = reportProtocolError(options, () => {
      const value = decodeChatStreamEvent(event);
      noteDecodedStreamEvent(value, guard);
      return value;
    });
    yield decoded;
  }
  reportProtocolError(options, () => assertStreamTerminated(guard));
}

/** Options both decoding entry points accept. */
export type ChatStreamDecodeOptions = {
  /**
   * Called with the rejection the moment a frame fails validation — at the
   * throw site, before the generator unwinds and before any producer cleanup
   * (`return()`, `reader.cancel()`) is awaited. A consumer whose transport
   * needs its signal aborted to finish cleaning up would otherwise deadlock:
   * it cannot abort until the rejection reaches it, and the rejection cannot
   * reach it until the cleanup that is waiting on the abort completes.
   */
  onProtocolError?: (error: unknown) => void;
};

/** Runs `validate`, handing a rejection to `onProtocolError` before it propagates. */
function reportProtocolError<T>(
  options: ChatStreamDecodeOptions | undefined,
  validate: () => T,
): T {
  if (!options?.onProtocolError) return validate();
  try {
    return validate();
  } catch (error) {
    options.onProtocolError(error);
    throw error;
  }
}

/** Decodes newline-delimited events from a string or an async byte stream. */
export async function* decodeChatStreamEvents(
  source: string | AsyncIterable<string | Uint8Array> | ReadableStream<Uint8Array>,
  options?: ChatStreamDecodeOptions,
): AsyncGenerator<ChatStreamEvent> {
  const guard: StreamGuardState = {
    mode: undefined,
    wireVersion: undefined,
    sawTerminal: false,
    lastSequence: undefined,
  };
  const decodeAndTrack = (line: string): ChatStreamEvent =>
    reportProtocolError(options, () => {
      const event = decodeChatStreamEvent(line);
      noteDecodedStreamEvent(event, guard);
      return event;
    });
  // Decodes one batch of complete lines lazily, EXCEPT once a terminal frame
  // is reached: everything already buffered after it is validated before the
  // terminal is yielded. A consumer that stops iterating on the terminal
  // frame calls the generator's `return()`, which skips every later line —
  // so a terminal followed by a higher-sequence mutation that arrived in the
  // same chunk (or the same string) would otherwise be accepted rather than
  // rejected as a frame after the terminal. `afterTerminal` lets each source
  // path check its own residue (the string's final fragment, a chunk's
  // partial buffer) at the same moment.
  const decodeBatch = function* (
    lines: string[],
    afterTerminal: () => void,
  ): Generator<ChatStreamEvent> {
    for (let index = 0; index < lines.length; index++) {
      const event = decodeAndTrack(lines[index] ?? '');
      if (guard.sawTerminal) {
        for (const trailing of lines.slice(index + 1)) decodeAndTrack(trailing);
        afterTerminal();
      }
      yield event;
    }
  };
  // Decode-then-validate-then-yield for whatever is left after the final
  // newline. An unterminated frame is not a valid frame; yielding it before
  // `assertStreamFramed` runs would hand the consumer data the contract calls
  // truncated — and a consumer that stops iterating on a terminal frame
  // returns the generator before any assertion placed after the yield.
  const finishStream = function* (leftover: string): Generator<ChatStreamEvent> {
    if (leftover.trim()) {
      const event = decodeAndTrack(leftover.trim());
      reportProtocolError(options, () => assertStreamFramed(leftover, guard));
      yield event;
    } else {
      reportProtocolError(options, () => assertStreamFramed(leftover, guard));
    }
    reportProtocolError(options, () => assertStreamTerminated(guard));
  };
  if (typeof source === 'string') {
    // Same framing rule as the byte paths below. A versioned stream that is
    // accepted as a string but rejected when streamed would make the format's
    // validity depend on how the caller happened to deliver it.
    const lines = source.split('\n');
    const leftover = lines.pop() ?? '';
    yield* decodeBatch(lines.map((item) => item.trim()).filter(Boolean), () => {
      // The whole string is already buffered, so the final fragment is
      // checked before the terminal frame is handed over, too.
      reportProtocolError(options, () => assertStreamFramed(leftover, guard));
      if (leftover.trim()) decodeAndTrack(leftover.trim());
    });
    yield* finishStream(leftover);
    return;
  }
  // `fatal` so an invalid byte sequence rejects the stream instead of being
  // replaced with U+FFFD: a replaced byte inside a quoted payload field still
  // parses as JSON, so without this the stream would complete "successfully"
  // with silently corrupted text, tool arguments, or history.
  const decoder = new TextDecoder('utf-8', { fatal: true });
  // Routed through `reportProtocolError` like every other rejection: invalid
  // UTF-8 (or a retained partial sequence) is a protocol failure, and the
  // consumer has to be able to abort its transport before this generator
  // unwinds into `reader.cancel()`.
  const decodeBytes = (chunk?: Uint8Array): string =>
    reportProtocolError(options, () => {
      try {
        return chunk === undefined ? decoder.decode() : decoder.decode(chunk, { stream: true });
      } catch {
        throw new Error('Invalid chat stream event: response bytes are not valid UTF-8');
      }
    });
  let buffer = '';
  const appendChunk = function* (chunk: string | Uint8Array): Generator<ChatStreamEvent> {
    // A source that mixes chunk types must not hand over a string while the
    // decoder still holds the start of a multibyte sequence: a later byte
    // chunk would complete that character *after* the intervening string,
    // silently reordering text inside an otherwise valid frame. Flushing the
    // fatal decoder rejects the pending partial sequence instead.
    if (typeof chunk === 'string') decodeBytes();
    buffer += typeof chunk === 'string' ? chunk : decodeBytes(chunk);
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    yield* decodeBatch(lines.map((item) => item.trim()).filter(Boolean), () => {
      // The server closes the stream immediately after the terminal frame,
      // so bytes already buffered past it are a violation even before they
      // form a complete line. Bytes still inside the decoder count too: the
      // start of a multibyte sequence never reaches `buffer`, so the decoder
      // is flushed here — a partial sequence fails the fatal decode, and a
      // consumer that stops on the terminal would otherwise never learn of
      // it because EOF handling is skipped.
      if (buffer.trim() || decodeBytes().length > 0)
        reportProtocolError(options, () => {
          throw new Error('Invalid chat stream event: frame arrived after the terminal frame');
        });
    });
  };
  if (source instanceof ReadableStream) {
    const reader = source.getReader();
    let completed = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield* appendChunk(value);
      }
      // Flush any bytes the decoder retained. A stream ending mid-multibyte
      // sequence leaves them inside `TextDecoder`, not in `buffer`, so
      // without this final `decode()` the truncation is invisible: the
      // buffer looks empty and a genuinely truncated stream is accepted.
      buffer += decodeBytes();
      yield* finishStream(buffer);
      completed = true;
    } finally {
      try {
        if (!completed) await reader.cancel();
      } catch {
        // Cancellation is cleanup. Never replace the primary read/decode
        // failure with a provider-specific cancellation error.
      } finally {
        reader.releaseLock();
      }
    }
    return;
  } else {
    for await (const chunk of source) yield* appendChunk(chunk);
  }
  // Same flush as the ReadableStream branch above: bytes retained mid
  // multibyte sequence live inside TextDecoder, not in `buffer`, so skipping
  // this makes a truncated stream look like a clean one.
  buffer += decodeBytes();
  yield* finishStream(buffer);
}
