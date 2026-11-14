// Cover the current catalog while avoiding an unbounded allocation from stale
// metadata. A response's Content-Length is only a progress estimate.
const MAX_PREALLOCATED_BYTES = 512 * 1024 ** 2;

function validLength(bytes) {
  return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : null;
}

function responseLength(headers) {
  const encoding = headers.get('content-encoding');
  if (encoding && encoding.toLowerCase() !== 'identity') return null;
  const length = headers.get('content-length');
  return length && /^\d+$/.test(length) ? validLength(Number(length)) : null;
}

/**
 * Return the original response bytes for hashing and GLTFLoader parsing.
 * @param {string} url
 * @param {{ signal?: AbortSignal, expectedBytes?: number, onProgress?: (progress: { loadedBytes: number, totalBytes: number | null }) => void }} [options]
 * @returns {Promise<ArrayBuffer>}
 */
export async function fetchViewerModel(url, { signal, expectedBytes, onProgress } = {}) {
  signal?.throwIfAborted();
  const response = await fetch(url, { signal });
  signal?.throwIfAborted();
  if (!response.ok) throw new Error(`Model request failed: ${response.status}`);

  const expectedLength = validLength(expectedBytes);
  let totalBytes = expectedLength ?? responseLength(response.headers);

  if (!onProgress || typeof response.body?.getReader !== 'function') {
    onProgress?.({ loadedBytes: 0, totalBytes });
    signal?.throwIfAborted();
    const bytes = await response.arrayBuffer();
    signal?.throwIfAborted();
    onProgress?.({ loadedBytes: bytes.byteLength, totalBytes: validLength(bytes.byteLength) });
    signal?.throwIfAborted();
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loadedBytes = 0;
  let buffer = null;

  try {
    if (expectedLength !== null && expectedLength <= MAX_PREALLOCATED_BYTES) {
      try {
        buffer = new Uint8Array(expectedLength);
      } catch (error) {
        // Keep the download usable when this device cannot reserve its buffer yet.
        if (!(error instanceof RangeError)) throw error;
      }
    }
    onProgress({ loadedBytes, totalBytes });
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      if (!value.byteLength) continue;

      const nextBytes = loadedBytes + value.byteLength;
      if (buffer && nextBytes <= buffer.byteLength) {
        buffer.set(value, loadedBytes);
      } else {
        // A catalog size can go stale if a model at the same URL is replaced.
        // Keep the received prefix and let the caller verify the actual bytes.
        if (buffer) {
          if (loadedBytes) chunks.push(buffer.subarray(0, loadedBytes));
          buffer = null;
        }
        chunks.push(value);
      }
      loadedBytes = nextBytes;
      if (totalBytes !== null && loadedBytes > totalBytes) totalBytes = null;
      onProgress({ loadedBytes, totalBytes });
    }

    if (!buffer) {
      buffer = new Uint8Array(loadedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
      }
    }
    if (totalBytes !== loadedBytes) onProgress({ loadedBytes, totalBytes: validLength(loadedBytes) });
    signal?.throwIfAborted();
    return loadedBytes === buffer.byteLength ? buffer.buffer : buffer.buffer.slice(0, loadedBytes);
  } catch (error) {
    reader.cancel(error).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
