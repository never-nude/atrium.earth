import { connect as connectHttp2 } from 'node:http2';
import { Readable } from 'node:stream';

const cdn = 'https://models.atrium.earth';

// Each URL gets one stream. Session retirement affects only subsequent URLs;
// refused, reset or aborted streams remain failed first attempts.
export function createCdnHttp2Request({ connect = connectHttp2, maxRequests = 128, idleTimeout = 1000 } = {}) {
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1
    || !Number.isSafeInteger(idleTimeout) || idleTimeout < 0) throw new Error('Invalid CDN session limits');
  const sessions = new Set();
  let current;
  let closed = false;

  function retire(record) {
    record.retired = true;
    if (current === record) current = undefined;
    clearTimeout(record.idle);
    if (!record.active && !record.session.destroyed) {
      record.session.unref();
      if (!record.session.closed) record.session.close();
    }
  }

  function release(record) {
    record.active--;
    if (record.active) return;
    if (record.retired) return retire(record);
    record.session.unref();
    record.idle = setTimeout(() => retire(record), idleTimeout);
    record.idle.unref();
  }

  function acquire() {
    if (!current || current.retired || current.session.closed || current.session.destroyed) {
      const record = { session: connect(cdn), active: 0, requests: 0, retired: false, idle: undefined };
      sessions.add(record);
      record.session.on('goaway', () => retire(record));
      record.session.on('error', () => retire(record));
      record.session.once('close', () => {
        clearTimeout(record.idle);
        sessions.delete(record);
        if (current === record) current = undefined;
      });
      current = record;
    }
    const record = current;
    clearTimeout(record.idle);
    record.session.ref();
    record.active++;
    record.requests++;
    if (record.requests >= maxRequests) retire(record);
    return record;
  }

  async function request(url, { headers, signal } = {}) {
    const target = new URL(url);
    if (target.origin !== cdn || target.username || target.password || target.search || target.hash
      || target.href !== target.origin + target.pathname) throw new Error('Unexpected CDN HTTP/2 address');
    if (closed) throw new Error('CDN HTTP/2 transport is closed');
    signal?.throwIfAborted();
    const requestHeaders = Object.fromEntries(new Headers(headers));
    return new Promise((resolve, reject) => {
      const record = acquire();
      let stream;
      let responded = false;
      try {
        stream = record.session.request({
          ':method': 'GET', ':scheme': 'https', ':authority': target.host, ':path': target.pathname,
          ...requestHeaders,
        }, { endStream: true });
      } catch (error) {
        release(record);
        retire(record);
        reject(error);
        return;
      }
      const abort = () => {
        retire(record);
        const error = new Error('The CDN request was aborted', { cause: signal.reason });
        error.name = 'AbortError';
        error.code = 'ABORT_ERR';
        stream.destroy(error);
      };
      stream.once('error', reject);
      stream.once('close', () => {
        if (!responded) reject(new Error(`CDN HTTP/2 stream closed before response headers (code ${stream.rstCode})`));
        signal?.removeEventListener('abort', abort);
        release(record);
      });
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      stream.once('response', received => {
        try {
          const responseHeaders = new Headers();
          for (const [name, value] of Object.entries(received)) {
            if (name.startsWith(':') || value === undefined) continue;
            if (Array.isArray(value)) value.forEach(item => responseHeaders.append(name, item));
            else responseHeaders.set(name, value);
          }
          const status = Number(received[':status']);
          const noBody = [204, 205, 304].includes(status);
          if (noBody) stream.resume();
          const response = new Response(noBody ? null : Readable.toWeb(stream), { status, headers: responseHeaders });
          responded = true;
          resolve(response);
        } catch (error) {
          stream.destroy();
          reject(error);
        }
      });
    });
  }

  request.close = () => {
    closed = true;
    current = undefined;
    for (const record of sessions) {
      clearTimeout(record.idle);
      record.retired = true;
      record.session.destroy();
    }
  };
  return request;
}

export const requestCdnResource = createCdnHttp2Request();
