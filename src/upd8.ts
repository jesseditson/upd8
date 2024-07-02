const views: Map<string, Upd8View<any, any>> = new Map();
let initialized = false;
const visibleViews = new Set();

export type Config<State, Event> = {
  setHidden?: (el: HTMLElement, hidden: boolean) => void;
  viewUpdated?: (screen: Upd8View<State, Event>) => void;
  didUpdate?: (state: State) => void;
};

export type ImperativeUpd8Fn<State, Event> = (
  id: string,
  upd8: (view: Upd8View<State, Event>) => void
) => void;
export type Upd8<State, Event> = {
  (state: State, eventHandler: (evt: Event) => void): (
    state: State
  ) => Promise<void>;
  imperative: ImperativeUpd8Fn<State, Event>;
};

export type Upd8ViewConstructor<State, Event> = (new (
  state: State,
  didUpdate: (view: Upd8View<State, Event>) => void
) => Upd8View<State, Event>) & { get id(): string };

export const cre8 = <State, Event>(
  allViews: Upd8ViewConstructor<State, Event>[],
  _config: Config<State, Event> = {}
): Upd8<State, Event> => {
  if (!_config.viewUpdated) {
    _config.viewUpdated = (_view) => {};
  }
  if (!_config.didUpdate) {
    _config.didUpdate = () => {};
  }
  const config = _config as Required<Config<State, Event>>;
  const initUpd8 = (state: State, eventHandler: (evt: Event) => void) => {
    if (initialized) {
      throw new Error("upd8 may only be initialized once.");
    }
    for (const ViewK of allViews) {
      const view = new ViewK(state, config.viewUpdated);
      if (views.has(view.id)) {
        throw new Error(`View ${view.id} already exists.`);
      }
      views.set(view.id, view);
      view.listen(eventHandler);
    }
    const upd8 = async (state: State) => {
      for (const view of views.values()) {
        const visible = view.showing(state);
        if (visible) {
          if (!visibleViews.has(view.id)) {
            view.show();
            visibleViews.add(view.id);
            view.update(state);
            view.becameVisible();
          } else {
            view.update(state);
          }
        } else {
          view.hide();
          visibleViews.delete(view.id);
        }
      }
      config.didUpdate(state);
    };
    setTimeout(() => upd8(state), 0);
    return upd8;
  };
  initUpd8.imperative = (
    id: string,
    upd8: (view: Upd8View<State, Event>) => void
  ) => {
    for (const view of views.values()) {
      if (view.id === id) {
        upd8(view);
        break;
      }
    }
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
  protected get rootElement(): HTMLElement | undefined {
    return document.getElementById(this.id) as HTMLElement | undefined;
  }
  protected state!: State;
  private _upd8_els: Map<string, HTMLElement> = new Map();
  private _upd8_templates: Map<string, HTMLElement> = new Map();
  private _upd8_eventListeners: Set<(evt: Event) => void> = new Set();
  protected didUpdate(_view: this) {}
  constructor(state: State, updated: (view: Upd8View<State, Event>) => void) {
    this.state = state;
    this.didUpdate = updated;
  }

  private _upd8_lazyInit() {
    if (!this._upd8_initialized) {
      if (!this.rootElement) {
        throw new Error(`Upd8View element not found: ${this.id}`);
      }
      this._upd8_initElements();
      this.mount();
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
    this._upd8_lazyInit();
    this.errored(message);
  }

  errored(message: string) {}

  showing(state: State): boolean {
    return !!this.rootElement;
  }

  update(state: State) {
    this._upd8_lazyInit();
    this.state = state;
    this.updated();
  }
  internalUpdate() {
    this.updated();
    this.didUpdate(this);
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
    } else {
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
    const els = rootEl.querySelectorAll(selector);
    if (!els.length) {
      throw new Error(`Couldn't find element ${el} ${selector} in ${raw}`);
    }
    return Array.from(els) as HTMLElement[];
  }

  setContent(
    el: string | HTMLElement,
    value: (string | Node)[] | (string | Node),
    selector?: string
  ) {
    if (selector) {
      const els = this._upd8_findElements(el, selector);
      for (const el of els) {
        this.setContent(el, value);
      }
    } else {
      const htmlEl = this.findElement(el);
      if (Array.isArray(value)) {
        htmlEl?.replaceChildren(...value);
      } else {
        htmlEl?.replaceChildren(value);
      }
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
    this.rootElement?.querySelectorAll("[id]").forEach((el) => {
      this._upd8_els.set(el.id, el as HTMLElement);
    });
    this.rootElement?.querySelectorAll("[data-template]").forEach((el) => {
      const e = el as HTMLElement;
      this._upd8_templates.set(e.dataset["template"]!, e);
      delete e.dataset["template"];
      e.parentNode?.removeChild(e);
    });
  }
}
