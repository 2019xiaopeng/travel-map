import test from "node:test";
import assert from "node:assert/strict";

import { getCityAssetPreviewKind } from "../src/components/drawer/cityAssetsPreview.ts";

test("getCityAssetPreviewKind classifies supported preview formats", () => {
  assert.equal(getCityAssetPreviewKind({ mime: "image/png", original_filename: "a.png" }), "image");
  assert.equal(getCityAssetPreviewKind({ mime: "application/pdf", original_filename: "a.pdf" }), "pdf");
  assert.equal(getCityAssetPreviewKind({ mime: "text/plain", original_filename: "a.txt" }), "text");
  assert.equal(
    getCityAssetPreviewKind({
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      original_filename: "a.docx",
    }),
    "external",
  );
});
