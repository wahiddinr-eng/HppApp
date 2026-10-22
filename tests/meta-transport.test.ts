import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import { postMetaEvent } from "../src/server/meta-transport";

type Outcome = { status: number; body: string } | { error: string };

function fakeRequest(outcomes: Outcome[], calls: { body: string; family?: number; token: unknown }[]) {
  return ((_url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
    const request = new EventEmitter() as ClientRequest;
    request.end = ((body: string) => {
      calls.push({ body, family: options.family, token: (options.headers as Record<string, unknown>)?.Authorization });
      const outcome = outcomes.shift();
      queueMicrotask(() => {
        if (!outcome || "error" in outcome) {
          request.emit("error", new Error(outcome?.error ?? "NETWORK_FAILED"));
          return;
        }
        const response = new EventEmitter() as IncomingMessage;
        response.statusCode = outcome.status;
        response.resume = (() => response) as IncomingMessage["resume"];
        callback(response);
        response.emit("data", Buffer.from(outcome.body));
        response.emit("end");
      });
      return request;
    }) as ClientRequest["end"];
    return request;
  });
}

test("CAPI retries a transient failure with unchanged event ID and IPv4 transport", async () => {
  const calls: { body: string; family?: number; token: unknown }[] = [];
  const event = { data: [{ event_name: "ViewContent", event_id: "same-event" }], test_event_code: "TEST123" };
  const response = await postMetaEvent("https://graph.facebook.com/v26.0/123/events", "secret", event,
    fakeRequest([{ error: "timeout" }, { status: 200, body: '{"events_received":1}' }], calls));
  assert.equal(response.events_received, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body, calls[1].body);
  assert.equal(JSON.parse(calls[1].body).data[0].event_id, "same-event");
  assert.deepEqual(calls.map(call => call.family), [4, 4]);
  assert.deepEqual(calls.map(call => call.token), ["Bearer secret", "Bearer secret"]);
});

test("CAPI does not retry a permanent HTTP client error", async () => {
  const calls: { body: string; family?: number; token: unknown }[] = [];
  await assert.rejects(postMetaEvent("https://graph.facebook.com/v26.0/123/events", "secret", { data: [] },
    fakeRequest([{ status: 400, body: "invalid" }], calls)), /HTTP_400/);
  assert.equal(calls.length, 1);
});
