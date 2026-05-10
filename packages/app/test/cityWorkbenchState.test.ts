import test from "node:test";
import assert from "node:assert/strict";

import { SCHEMA_V1 } from "../src/main/db/schema.ts";
import { ensureCityVisitStateColumn } from "../src/main/db/cityVisitStateMigration.ts";

test("schema includes visit_state for fresh databases", () => {
  assert.match(SCHEMA_V1, /visit_state TEXT NOT NULL DEFAULT 'unrecorded'/);
});

test("ensureCityVisitStateColumn adds the column only when missing", () => {
  const executed: string[] = [];
  const db = {
    pragma(sql: string) {
      assert.equal(sql, "table_info(City)");
      return [
        { name: "city_id" },
        { name: "province_id" },
        { name: "name" },
      ];
    },
    exec(sql: string) {
      executed.push(sql);
    },
  };

  ensureCityVisitStateColumn(db);
  assert.equal(executed.length, 1);
  assert.match(executed[0], /ALTER TABLE City ADD COLUMN visit_state/);
});

test("ensureCityVisitStateColumn is a no-op when column already exists", () => {
  const executed: string[] = [];
  const db = {
    pragma() {
      return [
        { name: "city_id" },
        { name: "visit_state" },
      ];
    },
    exec(sql: string) {
      executed.push(sql);
    },
  };

  ensureCityVisitStateColumn(db);
  assert.equal(executed.length, 0);
});
