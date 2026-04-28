import test from "node:test";
import assert from "node:assert/strict";

import { resolveLocalAssetRequest } from "../src/main/localProtocol.ts";

test("local protocol resolves local://assets/... to assets-relative path and enforces assets root", () => {
  const userDataPath = "/tmp/app";

  const ok = resolveLocalAssetRequest({
    requestUrl: "local://assets/cities/330100-杭州/trips/t1/photos/a__b.jpg",
    userDataPath,
  });

  assert.equal(ok.allowed, true);
  assert.equal(ok.relativePath, "assets/cities/330100-杭州/trips/t1/photos/a__b.jpg");
  assert.equal(ok.absolutePath, "/tmp/app/assets/cities/330100-杭州/trips/t1/photos/a__b.jpg");
});

test("local protocol resolves legacy local:///assets/... format", () => {
  const userDataPath = "/tmp/app";

  const ok = resolveLocalAssetRequest({
    requestUrl: "local:///assets/cities/330100-杭州/trips/t1/photos/a__b.jpg",
    userDataPath,
  });

  assert.equal(ok.allowed, true);
  assert.equal(ok.relativePath, "assets/cities/330100-杭州/trips/t1/photos/a__b.jpg");
  assert.equal(ok.absolutePath, "/tmp/app/assets/cities/330100-杭州/trips/t1/photos/a__b.jpg");
});

test("local protocol denies path traversal", () => {
  const userDataPath = "/tmp/app";

  const denied = resolveLocalAssetRequest({
    requestUrl: "local://assets/%2e%2e/%2e%2e/%2e%2e/etc/passwd",
    userDataPath,
  });

  assert.equal(denied.allowed, false);
});
