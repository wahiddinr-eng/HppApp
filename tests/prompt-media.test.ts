import assert from "node:assert/strict";
import test from "node:test";
import { detectPromptImage, MAX_PROMPT_IMAGE_BYTES } from "../src/server/prompt-media";

test("prompt image accepts PNG by signature, not extension", () => {
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pFYAAAAASUVORK5CYII=","base64");
  assert.deepEqual(detectPromptImage(png),{mime:"image/png",ext:"png"});
});

test("prompt image rejects SVG and files over 8 MB", () => {
  assert.throws(() => detectPromptImage(Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>")),{code:"INVALID_PROMPT_IMAGE"});
  assert.throws(() => detectPromptImage(new Uint8Array(MAX_PROMPT_IMAGE_BYTES+1)),{code:"INVALID_PROMPT_IMAGE"});
});
