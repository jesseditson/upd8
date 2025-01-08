const views: Map<string, Upd8View<any, any>> = new Map();
let initialized = false;
const visibleViews = new Set();

export type Config<State, Event> = {
  setHidden?: (el: HTMLElement, hidden: boolean) => void;
  viewUpdated?: (view: Upd8View<State, Event>) => void;
  didUpdate?: (state: State) => void;
  document?: Document;
};

export type ImperativeUpd8Fn<State, Event> = <
  ViewType extends Upd8View<State, Event> = Upd8View<State, Event>,
  R = any
>(
  id: string,
  upd8: (view: ViewType) => R
) => R | undefined;
export type Upd8<State, Event> = {
  (
    state: State,
    eventHandler: (evt: Event) => void,
    skipAutoUpdate?: boolean
  ): (state: State) => Promise<void>;
  imperative: ImperativeUpd8Fn<State, Event>;
  teardown: () => void;
};

export type Upd8ViewConstructor<State, Event> = (new (
  getState: () => State,
  viewUpdated: (view: Upd8View<State, Event>, state: State) => void
) => Upd8View<State, Event>) & { get id(): string };

export const cre8 = <State, Event>(
  allViews: Upd8ViewConstructor<State, Event>[],
  _config: Config<State, Event> = {}
): Upd8<State, Event> => {
  initialized = false;
  views.clear();
  visibleViews.clear();
  if (!_config.viewUpdated) {
    _config.viewUpdated = (_view) => {};
  }
  if (!_config.didUpdate) {
    _config.didUpdate = (_state) => {};
  }
  if (!_config.document) {
    try {
      _config.document = document;
    } catch (e) {
      throw new Error(
        `upd8 either requires a global document object, or a config entry containing a document. (${e})`
      );
    }
  }
  const config = _config as Required<Config<State, Event>>;
  let globalState: State;
  const upd8 = async (state: State) => {
    globalState = state;
    for (const view of views.values()) {
      const visible = view.showing(state);
      if (visible) {
        if (!visibleViews.has(view.id)) {
          view.show();
          visibleViews.add(view.id);
          view._upd8_update();
          view.becameVisible();
        } else {
          view._upd8_update();
        }
      } else {
        view.hide();
        visibleViews.delete(view.id);
      }
    }
    config.didUpdate(state);
  };
  const initUpd8 = (
    state: State,
    eventHandler: (evt: Event) => void,
    skipAutoUpdate = false
  ) => {
    if (initialized) {
      throw new Error("upd8 may only be initialized once.");
    }
    globalState = state;
    for (const ViewK of allViews) {
      const view = new ViewK(
        () => globalState,
        (view, state) => {
          config.viewUpdated(view);
          config.didUpdate(state);
        }
      );
      view._upd8_document = config.document;
      if (views.has(view.id)) {
        throw new Error(`View ${view.id} already exists.`);
      }
      views.set(view.id, view);
      view.listen(eventHandler);
      if (!skipAutoUpdate) {
        upd8(state);
      }
    }
    return upd8;
  };
  initUpd8.imperative = <
    ViewType extends Upd8View<State, Event> = Upd8View<State, Event>,
    R = any
  >(
    id: string,
    upd8: (view: ViewType) => R
  ) => {
    for (const view of views.values()) {
      if (view.id === id) {
        return upd8(view as ViewType);
      }
    }
  };
  initUpd8.teardown = () => {
    for (const view of views.values()) {
      view.teardown();
    }
    initialized = false;
  };
  return initUpd8;
};

export const errored = (error: string) => {
  for (const view of views.values()) {
    view.internalError(error);
  }
};

export type EventListenerOptions = {
  useCapture?: boolean;
  selector?: string;
};

export class Upd8View<State, Event> {
  get id(): string {
    throw new Error("Upd8View subclasses must define id");
  }
  private _upd8_initialized = false;
  _upd8_document!: Document;
  private _rootElement!: HTMLElement;
  protected get rootElement(): HTMLElement | undefined {
    if (this._rootElement) {
      return this._rootElement;
    }
    const els = this._upd8_document.querySelectorAll(`#${this.id}`);
    if (els.length === 0) {
      return undefined;
    }
    let el = els.item(0);
    if (els.length > 1) {
      // The document will by default return elements in child order, then
      // document order. However, we need the outer-most element, which there
      // is no native API for retrieving. Therefore we have to check the depth
      // of each match and return the smallest.
      const pc: Record<number, number> = {};
      let pcmin = Infinity;
      for (let i = 0; i < els.length; i++) {
        let cel = els.item(i);
        if (!cel.parentElement) {
          // early break if we're at the root, since we can't do better than
          // that by traversing.
          el = cel;
          break;
        }
        // Set a depth
        pc[i] = 0;
        while (cel.parentElement) {
          pc[i]++;
          if (pc[i] > pcmin) {
            // No need to check further
            delete pc[i];
            break;
          }
          cel = cel.parentElement;
        }
        if (pc[i] < pcmin) {
          pcmin = pc[i];
        }
      }
      const ixs: { d: number; i: number }[] = [];
      for (let i = 0; i < Object.keys(pc).length; i++) {
        if (pc[i] >= pcmin) {
          ixs.push({ d: pc[i], i });
        }
      }
      el = els.item(ixs.sort((a, b) => (a.d < b.d ? -1 : 1))[0].i) || undefined;
      console.warn(
        `[${this.id}] Found more than one element with ID "${this.id}". Choosing the outer-most element:`,
        el
      );
    }
    if (el) {
      this._rootElement = el as HTMLElement;
    }
    return el as HTMLElement | undefined;
  }
  private _getState: () => State;
  protected get state(): State {
    return this._getState();
  }
  private _upd8_els: Map<string, HTMLElement> = new Map();
  private _upd8_templates: Map<string, HTMLElement> = new Map();
  private _upd8_eventListeners: Set<(evt: Event) => void> = new Set();
  private _upd8_teardownFns: Function[] = [];
  protected didUpdate(_view: this, _state: State) {}
  constructor(
    getState: () => State,
    updated: (view: Upd8View<State, Event>, state: State) => void
  ) {
    this._getState = getState;
    this.didUpdate = updated;
  }
  teardown() {
    this._upd8_templates.forEach((el) => {
      this._rootElement.appendChild(el);
    });
    this._upd8_templates = new Map();
    this._upd8_teardownFns.forEach((teardown) => {
      teardown();
    });
    this._upd8_teardownFns = [];
    this._upd8_initialized = false;
  }

  private _upd8_lazyInit() {
    if (!this._upd8_initialized) {
      if (!this.rootElement) {
        throw new Error(`Upd8View element not found: ${this.id}`);
      }
      this._upd8_initElements();
      this._upd8_teardownFns = this._upd8_teardownFns.concat(this.mount());
      this._upd8_initialized = true;
    }
  }

  hide() {
    this.rootElement?.classList.add("hidden");
  }

  show() {
    this._upd8_lazyInit();
    this.rootElement?.classList.remove("hidden");
  }

  internalError(message: string) {
    try {
      this._upd8_lazyInit();
      this.errored(message);
    } catch (e) {
      console.error(`[${this.id}] errored while handling internalError:`, e);
    }
  }

  errored(message: string) {}

  showing(state: State): boolean {
    return !!this.rootElement;
  }

  _upd8_update() {
    this._upd8_lazyInit();
    this.updated();
  }
  internalUpdate() {
    this.updated();
    this.didUpdate(this, this.state);
  }

  dispatchEvent(event: Event) {
    this._upd8_eventListeners.forEach((listener) => listener(event));
  }

  listen(handler: (event: Event) => void) {
    this._upd8_eventListeners.add(handler);
    return () => this._upd8_eventListeners.delete(handler);
  }

  updated() {}

  mount(): Function[] {
    return [];
  }

  becameVisible() {}

  template<T extends HTMLElement = HTMLElement>(name: string): T {
    const t = this._upd8_templates.get(name)?.cloneNode(true);
    if (!t) {
      throw new Error(`upd8 template ${name} does not exist.`);
    }
    return t as T;
  }

  el<T extends HTMLElement = HTMLElement>(id: string): T {
    let el = this._upd8_els.get(id);
    if (!el) {
      throw new Error(`ID ${id} does not exist.`);
    }
    return el as T;
  }

  eventListener<T extends HTMLElement, K extends keyof HTMLElementEventMap>(
    el: string | T,
    event: K | K[],
    handler: (this: T, ev: HTMLElementEventMap[K], element: T) => any,
    selectorOrOptions?: string | EventListenerOptions
  ): Function {
    let htmlEl: T;
    if (typeof el === "string") {
      htmlEl = this._upd8_els.get(el) as T;
      if (!htmlEl) {
        throw new Error(
          `[${this.id}] eventListener failed: couldn't find element with id "${el}" for ${event} in ${this.rootElement?.outerHTML}`
        );
      }
    } else {
      if (!el) {
        throw new Error(
          `[${this.id}] eventListener failed: element was undefined for ${event}`
        );
      }
      htmlEl = el as T;
    }
    let targetSelector = null;
    let useCapture = false;
    if (typeof selectorOrOptions === "string") {
      targetSelector = selectorOrOptions;
    } else if (selectorOrOptions) {
      targetSelector = selectorOrOptions.selector;
      useCapture = !!selectorOrOptions.useCapture;
    }
    const listenedHandler = targetSelector
      ? (e: HTMLElementEventMap[K]) => {
          const el = e.target as T;
          const matchedEl = el.matches(targetSelector)
            ? el
            : (el.closest(targetSelector) as T);
          if (matchedEl) {
            handler.call(matchedEl, e, matchedEl);
          }
        }
      : (e: HTMLElementEventMap[K]) => {
          handler.call(htmlEl, e, htmlEl);
        };
    const events = typeof event === "string" ? [event] : event;
    events.forEach((event) => {
      htmlEl.addEventListener(event, listenedHandler, useCapture);
    });
    return () => {
      events.forEach((event) => {
        htmlEl.removeEventListener(event, listenedHandler, useCapture);
      });
    };
  }

  public findElement(el: string | HTMLElement, selector?: string): HTMLElement {
    this._upd8_lazyInit();
    let htmlEl;
    const isSel = typeof el === "string";
    if (isSel) {
      htmlEl = this._upd8_els.get(el);
    } else {
      htmlEl = el;
    }
    const raw = htmlEl?.outerHTML;
    if (selector) {
      htmlEl = htmlEl?.querySelector(selector);
    }
    if (!htmlEl) {
      throw new Error(
        `Couldn't find element ${isSel ? el : ""}${
          selector ? (isSel ? " " : "") + selector : ""
        } in ${raw}`
      );
    }
    return htmlEl as HTMLElement;
  }
  private _upd8_findElements(
    el: string | HTMLElement,
    selector: string
  ): HTMLElement[] {
    let rootEl;
    if (typeof el === "string") {
      rootEl = this._upd8_els.get(el);
    } else {
      rootEl = el;
    }
    if (!rootEl) {
      throw new Error(`Couldn't find element ${el}`);
    }
    const raw = rootEl.innerHTML;
    const els = rootEl.querySelectorAll(`:scope ${selector}`);
    if (!els.length) {
      throw new Error(`Couldn't find element ${el} ${selector} in ${raw}`);
    }
    return Array.from(els) as HTMLElement[];
  }

  setContent(
    el: string | HTMLElement,
    value: (string | Node)[] | (string | Node)
  ): HTMLElement;
  setContent(
    el: string | HTMLElement,
    value: (string | Node)[] | (string | Node),
    selector?: string
  ): HTMLElement[];
  setContent(
    el: string | HTMLElement,
    value: (string | Node)[] | (string | Node),
    selector?: string
  ): HTMLElement | HTMLElement[] {
    if (selector) {
      const els = this._upd8_findElements(el, selector);
      const modified = [];
      for (const el of els) {
        modified.push(this.setContent(el, value));
      }
      return modified;
    } else {
      const htmlEl = this.findElement(el);
      if (Array.isArray(value)) {
        htmlEl?.replaceChildren(...value);
      } else {
        htmlEl?.replaceChildren(value);
      }
      return htmlEl;
    }
  }

  setData(
    el: string | HTMLElement,
    data: Record<string, string>,
    selector?: string
  ) {
    const htmlEl = this.findElement(el, selector);
    Object.entries(data).forEach((d) => {
      const [k, v] = d;
      htmlEl.dataset[k] = v;
    });
  }
  setAttrs(
    el: string | HTMLElement,
    data: Record<string, string>,
    selector?: string
  ) {
    const htmlEl = this.findElement(el, selector);
    Object.entries(data).forEach((d) => {
      const [k, v] = d;
      if (typeof v === "boolean") {
        if (v) {
          htmlEl.setAttribute(k, "");
        } else {
          htmlEl.removeAttribute(k);
        }
      } else {
        htmlEl.setAttribute(k, v);
      }
    });
  }

  private _upd8_initElements() {
    if (this.rootElement) {
      const elementsWithIds = traverse(this.rootElement, el => !!(el instanceof HTMLElement && el.id), el => views.has(el.id));
      elementsWithIds.forEach(el => {
        this._upd8_els.set(el.id, el as HTMLElement);
      })
    }
    this._upd8_initTemplates();
  }

  private _upd8_initTemplates() {
    if (this.rootElement) {
      const templates = traverse(this.rootElement, el => !!(el instanceof HTMLElement && el.dataset["template"]), el => views.has(el.id));
      templates.forEach(el => {
        const templateName = (el as HTMLElement).dataset["template"]!;
        this._upd8_templates.set(templateName, el as HTMLElement);
        el.parentNode?.removeChild(el);
      })
    }
  }
}

const traverse = (el: Element, select: (el: Element) => boolean, stop: (el: Element) => boolean, _acc: Element[] = []): Element[] => {
  for (let i = 0; i < el.children.length; i++) {
    const cel = el.children.item(i) as Element
    if (select(cel)) {
      _acc.push(cel)
    }
    if (stop(cel)) {
      continue;
    }
    traverse(cel, select, stop, _acc);
  }
  return _acc;
}
