import test from "node:test";
import assert from "node:assert/strict";

import { saveAssetBytesCore } from "../src/main/saveAssetBytesCore.ts";

test("saveAssetBytesCore stores new asset and returns local url", async () => {
  const writes: string[] = [];
  const unlinks: string[] = [];
  const inserted: any[] = [];

  const res = await saveAssetBytesCore({
    userDataPath: "/tmp/app",
    destRelativeDir: "cities/1/trips/t1/photos",
    originalFilename: "p.png",
    bytes: new Uint8Array([1, 2, 3]),
    mime: "image/png",
    now: 1,
    makeId: () => "00000000-0000-0000-0000-000000000001",
    store: {
      getBySha256: async () => null,
      insert: async (record) => {
        inserted.push(record);
        return record.assetId;
      },
    },
    fs: {
      mkdirp: async () => {},
      writeFile: async (absPath) => writes.push(absPath),
      unlink: async (absPath) => unlinks.push(absPath),
    },
  });

  assert.equal(res.assetId, "00000000-0000-0000-0000-000000000001");
  assert.equal(res.localUrl, "local://assets/cities/1/trips/t1/photos/00000000-0000-0000-0000-000000000001__p.png");
  assert.equal(writes.length, 1);
  assert.equal(unlinks.length, 0);
  assert.equal(inserted.length, 1);
});

test("saveAssetBytesCore dedupes by sha256 and deletes newly written file", async () => {
  const writes: string[] = [];
  const unlinks: string[] = [];

  const res = await saveAssetBytesCore({
    userDataPath: "/tmp/app",
    destRelativeDir: "cities/1/trips/t1/photos",
    originalFilename: "p.png",
    bytes: new Uint8Array([1, 2, 3]),
    mime: "image/png",
    now: 1,
    makeId: () => "00000000-0000-0000-0000-000000000002",
    store: {
      getBySha256: async () => ({ assetId: "existing", localPath: "assets/x.png" }),
      insert: async () => {
        throw new Error("should not insert");
      },
    },
    fs: {
      mkdirp: async () => {},
      writeFile: async (absPath) => writes.push(absPath),
      unlink: async (absPath) => unlinks.push(absPath),
    },
  });

  assert.equal(res.assetId, "existing");
  assert.equal(res.localUrl, "local://assets/x.png");
  assert.equal(writes.length, 1);
  assert.equal(unlinks.length, 1);
});

