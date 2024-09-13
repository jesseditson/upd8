import test, { after, afterEach, before, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { cre8, Upd8View } from "../../src/upd8";
import { rejects, throws } from "node:assert";

class TestMultiIDView extends Upd8View<{}, {}> {
  static get id() {
    return "multi-id";
  }

  get id() {
    return TestMultiIDView.id;
  }
  checkView(): string | undefined {
    const ds = this.rootElement?.dataset;
    if (ds) {
      return ds["correct"];
    }
  }
}

afterEach(async () => {
  // Pause for gc - otherwise old instances will continue to respond to event listeners.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test("it chooses the outer-most of duplicate IDs when showing views", async () => {
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
  initUI.teardown();
  dom.window.close();
});

describe("setContent", () => {
  class SetContentTest extends Upd8View<{}, {}> {
    static get id() {
      return "sct";
    }

    get id() {
      return SetContentTest.id;
    }

    checkSingle(): HTMLElement {
      return this.setContent("c-el", "hi!");
    }
    checkMulti(): HTMLElement[] {
      return this.setContent("m-el", "hi!", ".child");
    }
  }
  type RTC = ReturnType<typeof cre8<{}, {}>>;
  let dom: JSDOM, initUI: RTC, upd8: ReturnType<RTC>;
  before(() => {
    dom = new JSDOM(
      `<!DOCTYPE html><body>
        <div id="sct">
            <div id="c-el"></div>
            <div id="m-el">
                <div class="child"></div>
                <div class="child"></div>
                <div class="child"></div>
            </div>
        </div>
        </body>`
    );
    initUI = cre8([SetContentTest], {
      document: dom.window.document,
    });
    upd8 = initUI({}, (event) => {});
  });
  after(() => {
    initUI.teardown();
    dom.window.close();
  });
  test("setContent without a selector returns one element", () => {
    const val = initUI.imperative<SetContentTest, HTMLElement>(
      SetContentTest.id,
      (v) => v.checkSingle()
    );
    assert(val);
    assert(val instanceof dom.window.HTMLElement);
    assert.equal(val.innerHTML, "hi!");
  });
  test("setContent with a selector returns multiple elements", () => {
    const val = initUI.imperative<SetContentTest, HTMLElement[]>(
      SetContentTest.id,
      (v) => v.checkMulti()
    );
    assert(val);
    val.forEach((el) => {
      assert(el instanceof dom.window.HTMLElement);
      assert.equal(el.innerHTML, "hi!");
    });
  });
});

describe("mount", () => {
  class InitError extends Upd8View<{}, {}> {
    static get id() {
      return "ie";
    }

    get id() {
      return InitError.id;
    }

    mount(): Function[] {
      return [this.eventListener("not-exist", "click", () => {})];
    }
  }
  type RTC = ReturnType<typeof cre8<{}, {}>>;
  let dom: JSDOM, initUI: RTC, upd8: ReturnType<RTC>;
  before(() => {
    dom = new JSDOM(
      `<!DOCTYPE html><body>
          <div id="ie"></div>
        </body>`
    );
    initUI = cre8([InitError], {
      document: dom.window.document,
    });
  });
  after(() => {
    initUI.teardown();
    dom.window.close();
  });
  test("it emits a helpful error message when a listener fails to mount", () => {
    rejects(
      async () => {
        const upd8 = initUI({}, (event) => {}, true);
        await upd8({});
      },
      {
        message:
          '[ie] eventListener failed: couldn\'t find element with id "not-exist" for click in <div id="ie"></div>',
      }
    );
  });
});
