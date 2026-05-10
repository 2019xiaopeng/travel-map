type MinimalDb = {
  pragma: (sql: string, options?: { simple?: boolean }) => unknown;
  exec: (sql: string) => void;
};

type TableInfoRow = {
  name: string;
};

export function ensureCityVisitStateColumn(db: MinimalDb) {
  const columns = db.pragma("table_info(City)") as TableInfoRow[];
  const hasVisitState = columns.some((column) => column.name === "visit_state");

  if (!hasVisitState) {
    db.exec(`ALTER TABLE City ADD COLUMN visit_state TEXT NOT NULL DEFAULT 'unrecorded';`);
  }
}
