import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';

// Bulk release checks use one connection per request. This removes pooled
// connection reuse as a variable without retrying a failed first attempt.
// The optional native transport lets loopback fixtures exercise real sockets.
export function requestWithFreshConnection(url, { headers, signal } = {}, nativeRequest = httpsRequest) {
  return new Promise((resolve, reject) => {
    const request = nativeRequest(url, { method: 'GET', headers, signal, agent: false }, response => {
      try {
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) value.forEach(item => responseHeaders.append(name, item));
          else if (value !== undefined) responseHeaders.set(name, value);
        }
        const noBody = [204, 205, 304].includes(response.statusCode);
        if (noBody) response.resume();
        resolve(new Response(noBody ? null : Readable.toWeb(response), {
          status: response.statusCode,
          statusText: response.statusMessage,
          headers: responseHeaders,
        }));
      } catch (error) {
        response.destroy();
        reject(error);
      }
    });
    request.once('error', reject);
    // Native HTTPS does not follow redirects or retry a failed request.
    request.end();
  });
}
