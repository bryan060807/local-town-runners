import { test } from "node:test";
import assert from "node:assert/strict";
import { imageUpload } from "../src/lib/uploads";
import { HttpError } from "../src/lib/server/errors";

function request(form: FormData) {
  return new Request("https://example.test/api/assets", {
    method: "POST",
    body: form,
  });
}
function form() {
  const data = new FormData();
  data.set("data", JSON.stringify({ target: "runner" }));
  data.set("file", new File([new Uint8Array([137, 0, 255, 128])], "test.png"));
  return data;
}
function invalid(error: unknown) {
  return error instanceof HttpError && error.status === 400;
}

test("multipart upload preserves binary bytes and accepts one metadata and image pair", async () => {
  const parsed = await imageUpload(request(form()));
  assert.deepEqual(JSON.parse(parsed.data), { target: "runner" });
  assert.deepEqual(
    new Uint8Array(await parsed.file.arrayBuffer()),
    new Uint8Array([137, 0, 255, 128]),
  );
});

test("malformed multipart and non-multipart uploads are client errors", async () => {
  for (const contentType of [
    "application/json",
    "multipart/form-data",
    "multipart/form-data; boundary=missing",
  ]) {
    await assert.rejects(
      () =>
        imageUpload(
          new Request("https://example.test", {
            method: "POST",
            headers: { "Content-Type": contentType },
            body: "not a multipart body",
          }),
        ),
      invalid,
    );
  }
});

test("ambiguous, missing and unexpected multipart fields cannot choose an upload target", async () => {
  for (const mutate of [
    (data: FormData) => data.append("data", '{"target":"logo"}'),
    (data: FormData) => data.append("file", new File(["x"], "other.png")),
    (data: FormData) => data.set("data", new File(["{}"], "metadata.json")),
    (data: FormData) => data.delete("data"),
    (data: FormData) => data.delete("file"),
    (data: FormData) => data.set("file", "a file name is not a file"),
    (data: FormData) => data.set("ownerId", "forged"),
  ]) {
    const data = form();
    mutate(data);
    await assert.rejects(() => imageUpload(request(data)), invalid);
  }
});

test("empty images and images over 5 MB are rejected even within the multipart body limit", async () => {
  for (const size of [0, 5 * 1024 * 1024 + 1]) {
    const data = form();
    data.set("file", new File([new Uint8Array(size)], "test.png"));
    await assert.rejects(() => imageUpload(request(data)), invalid);
  }
});

test("oversized multipart requests stop before parsing or allocating an uploaded file", async () => {
  await assert.rejects(
    () =>
      imageUpload(
        new Request("https://example.test", {
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data; boundary=test",
            "Content-Length": String(6 * 1024 * 1024 + 1),
          },
          body: "small actual body",
        }),
      ),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
});
