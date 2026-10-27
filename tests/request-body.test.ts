import { test } from "node:test";
import assert from "node:assert/strict";
import { readLimited, readLimitedBytes } from "../src/lib/request-body";
test("oversized declared and chunked requests stop before unbounded buffering", async () => {
  await assert.rejects(
    () =>
      readLimited(
        new Request("https://example.test", {
          method: "POST",
          headers: { "Content-Length": "20000" },
          body: "x",
        }),
      ),
    /too large/,
  );
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(9000));
      controller.enqueue(new Uint8Array(9000));
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request("https://example.test", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  await assert.rejects(() => readLimited(req), /too large/);
  assert.equal(cancelled, true);
});
test("bounded JSON preserves UTF-8 catalog text", async () => {
  const json = JSON.stringify({ message: "cinnamon rolls 🥐" });
  assert.equal(
    await readLimited(
      new Request("https://example.test", { method: "POST", body: json }),
    ),
    json,
  );
});
test("bounded byte reads preserve binary uploads and enforce the exact byte boundary", async () => {
  const binary = new Uint8Array([0, 255, 128, 137, 10]);
  assert.deepEqual(
    await readLimitedBytes(
      new Request("https://example.test", { method: "POST", body: binary }),
      binary.length,
    ),
    binary,
  );
  await assert.rejects(
    () =>
      readLimitedBytes(
        new Request("https://example.test", { method: "POST", body: binary }),
        binary.length - 1,
      ),
    (error: unknown) =>
      error instanceof Error && "status" in error && error.status === 413,
  );
});
