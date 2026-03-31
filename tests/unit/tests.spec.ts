import test, { after, afterEach, before, describe } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { cre8, Upd8View } from "../../src/upd8";
import { rejects } from "node:assert";

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

test("it scopes nested templates to their owning view when parent initializes first", () => {
  class ParentTemplateView extends Upd8View<{}, {}> {
    static get id() {
      return "parent-template-view";
    }

    get id() {
      return ParentTemplateView.id;
    }

    parentTemplate(): HTMLElement {
      return this.template("parent");
    }

    childTemplate(): HTMLElement {
      return this.template("child");
    }
  }

  class ChildTemplateView extends Upd8View<{}, {}> {
    static get id() {
      return "child-template-view";
    }

    get id() {
      return ChildTemplateView.id;
    }

    childTemplate(): HTMLElement {
      return this.template("child");
    }
  }

  const dom = new JSDOM(
    `<!DOCTYPE html><body>
      <div id="parent-template-view">
        <div data-template="parent"><span>parent</span></div>
        <div id="child-template-view">
          <div data-template="child"><span>child</span></div>
        </div>
      </div>
    </body>`
  );
  const initUI = cre8([ParentTemplateView, ChildTemplateView], {
    document: dom.window.document,
  });
  const previousHTMLElement = (globalThis as any).HTMLElement;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  try {
    initUI({}, () => {});

    assert.doesNotThrow(() =>
      initUI.imperative(ChildTemplateView.id, (v) => v.childTemplate())
    );
    assert.throws(
      () => initUI.imperative(ParentTemplateView.id, (v) => v.childTemplate()),
      /does not exist/
    );

    const parentTemplate = initUI.imperative<ParentTemplateView, HTMLElement>(
      ParentTemplateView.id,
      (v) => v.parentTemplate()
    );
    assert.match(parentTemplate.textContent || "", /parent/);
  } finally {
    initUI.teardown();
    dom.window.close();
    if (previousHTMLElement) {
      (globalThis as any).HTMLElement = previousHTMLElement;
    } else {
      delete (globalThis as any).HTMLElement;
    }
  }
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
