import test from "node:test";
import assert from "node:assert/strict";

import { extractFilePaths } from "../src/utils/fileDrop.ts";

test("extractFilePaths filters empty paths and dedupes", () => {
  const paths = extractFilePaths([
    { path: "/a.png" },
    { path: "" },
    { path: "/a.png" },
    {},
    { path: "/b.pdf" },
  ]);

  assert.deepEqual(paths, ["/a.png", "/b.pdf"]);
});

