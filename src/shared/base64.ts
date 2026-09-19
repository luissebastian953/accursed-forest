// btoa/atob choke on very long argument lists; chunk the String.fromCharCode call.
const CHUNK = 0x8000;

export function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function decodeBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A typed array whose buffer may be a view into a larger one. */
type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

function viewBytes(array: TypedArray): Uint8Array {
  return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}

export function encodeTypedArray(array: TypedArray): string {
  return encodeBytes(viewBytes(array));
}

export function decodeInt32(base64: string): Int32Array {
  const bytes = decodeBytes(base64);
  return new Int32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / Int32Array.BYTES_PER_ELEMENT,
  );
}

export function decodeUint8(base64: string): Uint8Array {
  return decodeBytes(base64);
}

export function decodeFloat32(base64: string): Float32Array {
  const bytes = decodeBytes(base64);
  return new Float32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
}
