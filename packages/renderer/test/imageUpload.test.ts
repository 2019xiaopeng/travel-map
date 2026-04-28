import test from "node:test";
import assert from "node:assert/strict";

import { deriveUploadFilename } from "../src/utils/imageUpload.ts";

test("deriveUploadFilename keeps original name when present", () => {
  assert.equal(deriveUploadFilename({ name: "a.png", type: "image/png" }), "a.png");
});

test("deriveUploadFilename generates stable name for pasted image when name is empty", () => {
  assert.equal(deriveUploadFilename({ name: "", type: "image/png" }), "pasted-image.png");
  assert.equal(deriveUploadFilename({ name: "", type: "image/jpeg" }), "pasted-image.jpg");
});

