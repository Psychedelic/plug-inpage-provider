import { lebEncode } from '@dfinity/candid';
import { Principal } from '@dfinity/principal';
import borc from 'borc';
import { sha256 as jsSha256 } from 'js-sha256';

export type RequestId = ArrayBuffer & { __requestId__: void };

/**
* Concatenate multiple array buffers.
* @param buffers The buffers to concatenate.
*/
export function concat(...buffers: ArrayBuffer[]): ArrayBuffer {
  const result = new Uint8Array(buffers.reduce((acc, curr) => acc + curr.byteLength, 0));
  let index = 0;
  for (const b of buffers) {
    result.set(new Uint8Array(b), index);
    index += b.byteLength;
  }
  return result.buffer;
}

export function compare(b1: ArrayBuffer, b2: ArrayBuffer): number {
  if (b1.byteLength !== b2.byteLength) {
    return b1.byteLength - b2.byteLength;
  }

  const u1 = new Uint8Array(b1);
  const u2 = new Uint8Array(b2);
  for (let i = 0; i < u1.length; i++) {
    if (u1[i] !== u2[i]) {
      return u1[i] - u2[i];
    }
  }
  return 0;
}


/**
 * sha256 hash the provided Buffer
 * @param data - input to hash function
 */
export function hash(data: ArrayBuffer): ArrayBuffer {
  return jsSha256.create().update(new Uint8Array(data)).arrayBuffer();
}

interface ToHashable {
  toHash(): unknown;
}

/**
 *
 * @param value unknown value
 * @returns ArrayBuffer
 */
export function hashValue(value: unknown): ArrayBuffer {
  if (value instanceof borc.Tagged) {
    return hashValue((value as borc.Tagged).value);
  } else if (typeof value === 'string') {
    return hashString(value);
  } else if (typeof value === 'number') {
    return hash(lebEncode(value));
  } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return hash(value as ArrayBuffer);
  } else if (Array.isArray(value)) {
    const vals = value.map(hashValue);
    return hash(concat(...vals));
  } else if (value && typeof value === 'object' && (value as any)._isPrincipal) {
    return hash((value as Principal).toUint8Array());
  } else if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ToHashable).toHash === 'function'
  ) {
    return hashValue((value as ToHashable).toHash());
    // TODO This should be move to a specific async method as the webauthn flow required
    // the flow to be synchronous to ensure Safari touch id works.
    // } else if (value instanceof Promise) {
    //   return value.then(x => hashValue(x));
  } else if (typeof value === 'bigint') {
    // Do this check much later than the other bigint check because this one is much less
    // type-safe.
    // So we want to try all the high-assurance type guards before this 'probable' one.
    return hash(lebEncode(value));
  }
  throw Object.assign(new Error(`Attempt to hash a value of unsupported type: ${value}`), {
    // include so logs/callers can understand the confusing value.
    // (when stringified in error message, prototype info is lost)
    value,
  });
}

const hashString = (value: string): ArrayBuffer => {
  const encoded = new TextEncoder().encode(value);
  return hash(encoded);
};

/**
 * Get the RequestId of the provided ic-ref request.
 * RequestId is the result of the representation-independent-hash function.
 * https://sdk.dfinity.org/docs/interface-spec/index.html#hash-of-map
 * @param request - ic-ref request to hash into RequestId
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requestIdOf(request: Record<string, any>): RequestId {
  const hashed: Array<[ArrayBuffer, ArrayBuffer]> = Object.entries(request)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]: [string, unknown]) => {
      const hashedKey = hashString(key);
      const hashedValue = hashValue(value);

      return [hashedKey, hashedValue] as [ArrayBuffer, ArrayBuffer];
    });

  const traversed: Array<[ArrayBuffer, ArrayBuffer]> = hashed;

  const sorted: Array<[ArrayBuffer, ArrayBuffer]> = traversed.sort(([k1], [k2]) => {
    return compare(k1, k2);
  });

  const concatenated: ArrayBuffer = concat(...sorted.map(x => concat(...x)));
  const requestId = hash(concatenated) as RequestId;
  return requestId;
}