import test from "node:test";
import assert from "node:assert/strict";

import { ui, uiStores } from "../src/services/ui.ts";

test("ui.toast pushes and dismisses", () => {
  const id = ui.toast.info("hello");
  const list1 = uiStores.toast.getState().toasts;
  assert.equal(list1.some((t) => t.id === id), true);

  uiStores.toast.getState().dismiss(id);
  const list2 = uiStores.toast.getState().toasts;
  assert.equal(list2.some((t) => t.id === id), false);
});

test("ui.confirm resolves true/false and clears state", async () => {
  const p = ui.confirm({ title: "t", message: "m" });
  const state = uiStores.dialog.getState();
  assert.equal(Boolean(state.dialog), true);

  state.dialog?.resolve(true);
  const res = await p;
  assert.equal(res, true);
  assert.equal(uiStores.dialog.getState().dialog, null);
});

test("ui.prompt resolves value or null", async () => {
  const p = ui.prompt({ title: "t", message: "m", placeholder: "x" });
  const dialog = uiStores.dialog.getState().dialog;
  assert.equal(Boolean(dialog), true);
  dialog?.resolve(true, " ok ");
  const res = await p;
  assert.equal(res, "ok");
});

test("ui.form resolves values or null", async () => {
  const p = ui.form({
    title: "t",
    message: "m",
    fields: [
      { key: "category", label: "类别", type: "text" },
      { key: "amount", label: "金额", type: "number" },
    ],
  });
  const dialog = uiStores.dialog.getState().dialog;
  assert.equal(Boolean(dialog), true);
  dialog?.resolve(true, { category: "a", amount: "12.5" });
  const res = await p;
  assert.deepEqual(res, { category: "a", amount: "12.5" });
});
