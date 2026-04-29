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

