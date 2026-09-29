/**
 * Six-code truth table for fault classification (plan §10.4, §11.1, T1.5).
 * Pure logic, no DOM — see `HttpClientError` shape notes in `faults.ts`'s
 * module doc for why these wire shapes (REST masked vs JSON-RPC full fault
 * object) are exactly what's constructed below.
 */
import { describe, expect, test } from 'bun:test';

import type { FaultCode, WeftErrorCode } from '@lostgradient/weft';
import { HttpClientError } from '@lostgradient/weft';

import {
  classifyFault,
  FAULT_TREATMENT_TITLE,
  faultTreatment,
  UNKNOWN_FAULT_TREATMENT,
  type FaultTreatmentKind,
} from './faults.ts';

/** Every `FaultCode` → the HTTP status `FAULT_CODE_TO_HTTP_STATUS` gives it (`weft/src/server/operation-fault.ts`), used to build realistic `HttpClientError`s below. */
const HTTP_STATUS_FOR_FAULT_CODE: Readonly<Record<FaultCode, number>> = {
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  Unprocessable: 422,
  Timeout: 408,
  PayloadTooLarge: 413,
  NotImplemented: 501,
  UnsupportedTransport: 501,
  SubscriptionOverflow: 500,
  InvalidParams: 400,
  MethodNotFound: 404,
  EngineFailure: 500,
};

function jsonRpcFault(faultCode: FaultCode, message = 'fault message'): HttpClientError {
  // Mirrors `httpClientCatalogTransport` (`weft/src/client/http-operations.ts`):
  // the JSON-RPC envelope always carries the coarse `faultCode`, unmasked,
  // regardless of which fault it is — including `EngineFailure`.
  return new HttpClientError(HTTP_STATUS_FOR_FAULT_CODE[faultCode], message, { faultCode });
}

function restMaskedInternalFault(): HttpClientError {
  // Mirrors `shapeRestFault` (`weft/src/server/operations/operation-helpers.ts`)
  // masking `EngineFailure`: flat `{ error: "Internal server error" }`, no
  // `faultCode`, no `weftCode` — status 500 is the only signal left.
  return new HttpClientError(500, 'Internal server error');
}

describe('classifyFault — six-code truth table', () => {
  const EXPECTED_KIND_FOR_FAULT_CODE: Readonly<Record<FaultCode, FaultTreatmentKind>> = {
    NotFound: 'not-found',
    MethodNotFound: 'not-found',
    Conflict: 'conflict',
    Unprocessable: 'invalid',
    InvalidParams: 'invalid',
    PayloadTooLarge: 'invalid',
    Unauthorized: 'unauthorized',
    Forbidden: 'unauthorized',
    NotImplemented: 'not-supported',
    UnsupportedTransport: 'not-supported',
    Timeout: 'internal',
    SubscriptionOverflow: 'internal',
    EngineFailure: 'internal',
  };
  const FAULT_CODES = [
    'NotFound',
    'MethodNotFound',
    'Conflict',
    'Unprocessable',
    'InvalidParams',
    'PayloadTooLarge',
    'Unauthorized',
    'Forbidden',
    'NotImplemented',
    'UnsupportedTransport',
    'Timeout',
    'SubscriptionOverflow',
    'EngineFailure',
  ] as const satisfies readonly FaultCode[];

  for (const faultCode of FAULT_CODES) {
    test(`${faultCode} (JSON-RPC, unmasked) classifies as '${EXPECTED_KIND_FOR_FAULT_CODE[faultCode]}'`, () => {
      const treatment = classifyFault(jsonRpcFault(faultCode, 'wire message'));
      expect(treatment?.kind).toBe(EXPECTED_KIND_FOR_FAULT_CODE[faultCode]);
      expect(treatment?.message).toBe('wire message');
    });
  }

  test('every FaultCode is accounted for (no gaps if @lostgradient/weft adds one)', () => {
    const faultCodes = Object.keys(EXPECTED_KIND_FOR_FAULT_CODE);
    expect(new Set(faultCodes).size).toBe(faultCodes.length);
    expect(faultCodes).toHaveLength(13);
  });
});

describe('classifyFault — REST masked 500 vs JSON-RPC full fault object', () => {
  test('REST-masked EngineFailure (no faultCode, no weftCode) classifies as internal + maskedByRest + tryViaJsonRpc', () => {
    const treatment = classifyFault(restMaskedInternalFault());
    expect(treatment).toEqual({
      kind: 'internal',
      message: 'Internal server error',
      maskedByRest: true,
      tryViaJsonRpc: true,
    });
  });

  test('JSON-RPC EngineFailure (faultCode present, full fault object) classifies as internal without the masked hint', () => {
    const treatment = classifyFault(jsonRpcFault('EngineFailure', 'capturePayment threw'));
    expect(treatment).toEqual({
      kind: 'internal',
      message: 'capturePayment threw',
      maskedByRest: false,
      tryViaJsonRpc: false,
    });
  });

  test('an unmasked REST EngineFailure (structured faultToHttpResponse body) is also not flagged as masked', () => {
    // `faultToHttpResponse` (the REST default when an operation doesn't
    // override `shapeFault`) never masks — its structured body round-trips
    // `code: 'EngineFailure'` into `HttpClientError.faultCode` the same way
    // JSON-RPC does.
    const error = new HttpClientError(500, 'engine failure', { faultCode: 'EngineFailure' });
    const treatment = classifyFault(error);
    expect(treatment).toMatchObject({
      kind: 'internal',
      maskedByRest: false,
      tryViaJsonRpc: false,
    });
  });

  test('a raw 500 with no faultCode and unrelated message is still treated as (unattributed) masked-shaped internal', () => {
    // Genuinely ambiguous on the wire — a proxy/network 500 looks identical
    // to a masked EngineFailure from here. See faults.ts module doc.
    const error = new HttpClientError(500, 'Bad Gateway');
    const treatment = classifyFault(error);
    expect(treatment).toMatchObject({ kind: 'internal', maskedByRest: true, tryViaJsonRpc: true });
  });
});

describe('classifyFault — conflict: spent idempotency key (REST-only)', () => {
  test('Conflict carrying weftCode: IdempotencyKeyPurgedError (REST sibling field) is flagged', () => {
    const error = new HttpClientError(409, 'a workflow with this id was already started', {
      faultCode: 'Conflict',
      weftCode: 'IdempotencyKeyPurgedError',
    });
    const treatment = classifyFault(error);
    expect(treatment).toEqual({
      kind: 'conflict',
      message: 'a workflow with this id was already started',
      isSpentIdempotencyKey: true,
    });
  });

  test('a different weftCode on the same Conflict (e.g. WorkflowAlreadyExistsError) is not flagged as spent-key', () => {
    const error = new HttpClientError(409, 'a workflow with this id already exists', {
      faultCode: 'Conflict',
      weftCode: 'WorkflowAlreadyExistsError',
    });
    const treatment = classifyFault(error);
    expect(treatment).toMatchObject({ kind: 'conflict', isSpentIdempotencyKey: false });
  });

  test('a plain Conflict with no weftCode at all is not flagged as spent-key', () => {
    const treatment = classifyFault(jsonRpcFault('Conflict'));
    expect(treatment).toMatchObject({ kind: 'conflict', isSpentIdempotencyKey: false });
  });

  test('over JSON-RPC the fine-grained weftCode is unreachable (envelope overwrites it with the coarse code) — never flagged', () => {
    // `httpClientCatalogTransport` never sets `HttpClientError.weftCode` at
    // all (only `faultCode`) — see faults.ts module doc. This test pins that
    // asymmetry so it isn't "fixed" here by accident.
    const error = new HttpClientError(409, 'purged key', { faultCode: 'Conflict' });
    expect(error.weftCode).toBeUndefined();
    const treatment = classifyFault(error);
    expect(treatment).toMatchObject({ kind: 'conflict', isSpentIdempotencyKey: false });
  });
});

describe('classifyFault — invalid: field errors', () => {
  test('fieldErrors is always [] today (HttpClientError does not surface OperationFault.data.issues)', () => {
    const treatment = classifyFault(jsonRpcFault('InvalidParams', 'invalid params'));
    expect(treatment).toMatchObject({ kind: 'invalid', fieldErrors: [] });
  });
});

describe('classifyFault — unauthorized: 401 reauth vs 403 forbidden', () => {
  test('faultCode Unauthorized (401) is reauth', () => {
    const treatment = classifyFault(jsonRpcFault('Unauthorized'));
    expect(treatment).toMatchObject({ kind: 'unauthorized', mode: 'reauth' });
  });

  test('faultCode Forbidden (403) is forbidden', () => {
    const treatment = classifyFault(jsonRpcFault('Forbidden'));
    expect(treatment).toMatchObject({ kind: 'unauthorized', mode: 'forbidden' });
  });

  test('no faultCode, status 401 falls back to reauth', () => {
    const error = new HttpClientError(401, 'no credential');
    expect(classifyFault(error)).toMatchObject({ kind: 'unauthorized', mode: 'reauth' });
  });

  test('no faultCode, status 403 falls back to forbidden', () => {
    const error = new HttpClientError(403, 'scope denied');
    expect(classifyFault(error)).toMatchObject({ kind: 'unauthorized', mode: 'forbidden' });
  });
});

describe('classifyFault — not-found and not-supported', () => {
  test('NotFound classifies as not-found', () => {
    expect(classifyFault(jsonRpcFault('NotFound', 'workflow wf-1 not found'))).toEqual({
      kind: 'not-found',
      message: 'workflow wf-1 not found',
    });
  });

  test('NotImplemented classifies as not-supported', () => {
    expect(classifyFault(jsonRpcFault('NotImplemented', 'not implemented'))).toEqual({
      kind: 'not-supported',
      message: 'not implemented',
    });
  });
});

describe('classifyFault — status fallback for every remaining bucket', () => {
  test.each([
    [404, 'not-found'],
    [409, 'conflict'],
    [400, 'invalid'],
    [413, 'invalid'],
    [422, 'invalid'],
    [501, 'not-supported'],
    [502, 'internal'],
  ] as const)('status %d with no faultCode falls back to %s', (status, expectedKind) => {
    const error = new HttpClientError(status, 'no faultCode on this response');
    expect(classifyFault(error)?.kind).toBe(expectedKind);
  });
});

describe('classifyFault — errors that never crossed the Weft fault wire', () => {
  test('a plain Error (e.g. a network failure) is not classified', () => {
    expect(classifyFault(new TypeError('Failed to fetch'))).toBeNull();
  });

  test('a non-error thrown value is not classified', () => {
    expect(classifyFault('boom')).toBeNull();
    expect(classifyFault(undefined)).toBeNull();
  });
});

describe('faultTreatment — always returns a treatment, falling back to UNKNOWN_FAULT_TREATMENT', () => {
  test('classifiable errors delegate to classifyFault', () => {
    const error = jsonRpcFault('NotFound');
    const classified = classifyFault(error);
    expect(classified).not.toBeNull();
    expect(faultTreatment(error)).toEqual(classified ?? UNKNOWN_FAULT_TREATMENT);
  });

  test('unclassifiable errors fall back to UNKNOWN_FAULT_TREATMENT', () => {
    expect(faultTreatment(new TypeError('offline'))).toBe(UNKNOWN_FAULT_TREATMENT);
    expect(UNKNOWN_FAULT_TREATMENT.kind).toBe('internal');
  });
});

describe('FAULT_TREATMENT_TITLE', () => {
  test('has a sentence-case title for every treatment kind', () => {
    const kinds: readonly FaultTreatmentKind[] = [
      'not-found',
      'conflict',
      'invalid',
      'unauthorized',
      'not-supported',
      'internal',
    ];
    for (const kind of kinds) {
      expect(FAULT_TREATMENT_TITLE[kind]).toEqual(expect.any(String));
      expect(FAULT_TREATMENT_TITLE[kind].length).toBeGreaterThan(0);
    }
  });
});

describe('isWeftFault ground truth (weft-error.ts), pinned so the Conflict tests above stay meaningful', () => {
  test('matches structurally via HttpClientError.weftCode, not just instanceof', () => {
    const code: WeftErrorCode = 'IdempotencyKeyPurgedError';
    const matching = new HttpClientError(409, 'x', { weftCode: code });
    const nonMatching = new HttpClientError(409, 'x', { weftCode: 'WorkflowAlreadyExistsError' });
    const bare = new HttpClientError(409, 'x');

    expect('weftCode' in matching).toBe(true);
    expect(matching.weftCode).toBe(code);
    expect(nonMatching.weftCode).not.toBe(code);
    expect(bare.weftCode).toBeUndefined();
  });
});
