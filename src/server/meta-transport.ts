import { request as httpsRequest, type RequestOptions } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";

type RequestFn = (url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => ClientRequest;

async function requestOnce(
  url: string,
  token: string,
  payload: unknown,
  requestFn: RequestFn = httpsRequest,
): Promise<{ events_received?: number }> {
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const request = requestFn(new URL(url), {
      method: "POST",
      family: 4,
      signal: AbortSignal.timeout(10000),
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: `Bearer ${token}`,
      },
    }, response => {
      const status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`HTTP_${status}`));
        return;
      }
      const chunks: Buffer[] = [];
      let length = 0;
      response.on("data", (chunk: Buffer) => {
        length += chunk.length;
        if (length > 65536) request.destroy(new Error("META_RESPONSE_TOO_LARGE"));
        else chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch { reject(new Error("META_INVALID_RESPONSE")); }
      });
    });
    request.on("error", reject);
    request.end(body);
  });
}

export async function postMetaEvent(
  url: string,
  token: string,
  payload: unknown,
  requestFn: RequestFn = httpsRequest,
): Promise<{ events_received?: number }> {
  try {
    return await requestOnce(url, token, payload, requestFn);
  } catch (error) {
    // A lost response may mean Meta accepted the first request. Reuse the exact
    // payload and event_id so Meta can deduplicate the retry.
    if (error instanceof Error && /^HTTP_\d{3}$/.test(error.message) && !/^HTTP_5\d\d$/.test(error.message)) throw error;
    return requestOnce(url, token, payload, requestFn);
  }
}
