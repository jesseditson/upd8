import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { cre8, Upd8View } from "../../src/upd8";

class TestMultiIDView extends Upd8View<{}, {}> {
  static get id() {
    return "multi-id";
  }

  get id() {
    return TestMultiIDView.id;
  }

  // mount(): Function[] {
  //     return [
  //         this.eventListener("")
  //     ]
  // }
  checkView(): string | undefined {
    const ds = this.rootElement?.dataset;
    if (ds) {
      return ds["correct"];
    }
  }
}

test("it chooses the outer-most of duplicate IDs when showing views", () => {
  let dom = new JSDOM(
    `<!DOCTYPE html><body><div id="different-view"><div id="multi-id" data-correct="no"></div></div><div id="multi-id" data-correct="yes"></div></body>`
  );
  let initUI = cre8([TestMultiIDView], {
    document: dom.window.document,
  });
  let upd8 = initUI({}, (event) => {});
  let correct = initUI.imperative<TestMultiIDView, string | undefined>(
    TestMultiIDView.id,
    (v) => v.checkView()
  );
  assert.equal(correct, "yes");
  // Make the second view come last, but still nested, to prove that we're not
  // just choosing on order.
  dom = new JSDOM(
    `<!DOCTYPE html><body><div id="multi-id" data-correct="yes"></div><div id="different-view"><div id="multi-id" data-correct="no"></div></div></body>`
  );
  initUI = cre8([TestMultiIDView], {
    document: dom.window.document,
  });
  upd8 = initUI({}, (event) => {});
  correct = initUI.imperative<TestMultiIDView, string | undefined>(
    TestMultiIDView.id,
    (v) => v.checkView()
  );
  assert.equal(correct, "yes");
});
