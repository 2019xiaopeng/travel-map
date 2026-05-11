import test from "node:test";
import assert from "node:assert/strict";

import {
  ensureCityExists,
  updateCityVisitStateRecord,
  createTripRecord,
} from "../src/main/cityEnsure.ts";

type ExecutedStatement = {
  sql: string;
  params: unknown[];
};

function createMockDb() {
  const executed: ExecutedStatement[] = [];
  return {
    executed,
    prepare(sql: string) {
      return {
        run(...params: unknown[]) {
          executed.push({ sql, params: params.length ? params : [] });
          return { changes: 1 };
        },
        get() {
          return undefined;
        },
        all() {
          return [];
        },
      };
    },
    exec(_sql: string) {},
    pragma(_sql: string, _options?: { simple?: boolean }) {
      return 0;
    },
    transaction(fn: () => void) {
      return () => fn();
    },
  } as any;
}

test("updateCityVisitStateRecord calls ensureCityExists then updates visit_state", () => {
  const db = createMockDb();

  updateCityVisitStateRecord(db, {
    provinceId: "330000",
    provinceName: "浙江省",
    cityId: "330100",
    cityName: "杭州市",
    visitState: "wishlist",
  });

  const sqls = db.executed.map((s) => s.sql);
  assert.ok(sqls.some((s) => s.includes("INSERT INTO Province")), "should insert province");
  assert.ok(sqls.some((s) => s.includes("INSERT INTO City")), "should insert city");
  assert.ok(sqls.some((s) => s.includes("UPDATE City SET visit_state")), "should update visit_state");

  const updateStmt = db.executed.find((s) => s.sql.includes("UPDATE City SET visit_state"));
  assert.deepEqual(updateStmt?.params, ["wishlist", "330100"]);
});

test("ensureCityExists inserts province and city", () => {
  const db = createMockDb();

  ensureCityExists(db, {
    provinceId: "330000",
    provinceName: "浙江省",
    cityId: "330100",
    cityName: "杭州市",
  });

  const provinceStmt = db.executed.find((s) => s.sql.includes("INSERT INTO Province"));
  assert.deepEqual(provinceStmt?.params, ["330000", "浙江省"]);

  const cityStmt = db.executed.find((s) => s.sql.includes("INSERT INTO City"));
  assert.deepEqual(cityStmt?.params, ["330100", "330000", "杭州市"]);
});

test("createTripRecord ensures city, then creates trip", () => {
  const db = createMockDb();

  const tripId = createTripRecord(db, {
    provinceId: "330000",
    provinceName: "浙江省",
    cityId: "330100",
    cityName: "杭州市",
    title: "春游杭州",
  });

  assert.ok(typeof tripId === "string" && tripId.length > 0, "should return a trip id");

  const sqls = db.executed.map((s) => s.sql);
  assert.ok(sqls.some((s) => s.includes("INSERT INTO Province")), "should insert province");
  assert.ok(sqls.some((s) => s.includes("INSERT INTO City")), "should insert city");
  assert.ok(sqls.some((s) => s.includes("INSERT INTO Trip")), "should insert trip");

  const tripStmt = db.executed.find((s) => s.sql.includes("INSERT INTO Trip"));
  assert.equal(tripStmt?.params[0], tripId, "first param should be trip id");
  assert.equal(tripStmt?.params[1], "330100", "second param should be city id");
  assert.equal(tripStmt?.params[2], "春游杭州", "third param should be title");
});
