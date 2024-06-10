# ⬆️ upd8

### An HTML-friendly Typescript/Javascript mini-framework

**What?**

While developing [archival](https://archival.dev), I was looking for a bare-minimum "view only" framework that would work well with pages that were statically generated, while still maintaining event-based reactive UI conventions. This is that library.

**TL:DR;**

- Roughly 8k unzipped and <2k gzipped
- Simple, understandable event-based API
- No DSL, just DOM APIs
- Designed to operate on static html

**Simple usage**

This library assumes that it is running on a pre-existing html page, and that most HTML elements that will need to exist on your site already exist at load. An example of an html snippet that could become an upd8 view would be:

```html
<section id="main" class="main">
  <input id="toggle-all" class="toggle-all" type="checkbox" />
  <label for="toggle-all">Mark all as complete</label>
  <ul id="todo-list" class="todo-list">
    <li data-template="todo" class="todo">
      <div class="view">
        <input class="toggle" type="checkbox" />
        <label></label>
        <button class="destroy"></button>
      </div>
      <input class="edit" value="" />
    </li>
  </ul>
</section>
```

Note the `data-template` and the use of `id`s to identify elements.

A corresponding Upd8View would look like this:

```javascript
export class TODOView extends Upd8View {
  static get id() {
    return "main";
  }

  get id() {
    return TODOView.id;
  }

  clearInput() {
    this.el("new-todo").value = "";
  }

  mount() {
    return [
      this.eventListener(
        "todo-list",
        "change",
        (_, el) => {
          this.dispatchEvent({
            name: "toggleTodo",
            value: el.closest(".todo").dataset.id,
          });
        },
        ".toggle"
      ),
      this.eventListener("toggle-all", "change", (_, el) => {
        this.dispatchEvent({ name: "toggleAll" });
      }),
    ];
  }

  updated() {
    let completedCount = 0;
    this.setContent(
      "todo-list",
      this.state.todos.map((todo) => {
        const todoEl = this.template("todo");
        todoEl.classList.toggle("completed", todo.completed);
        this.findElement(todoEl, ".toggle").checked = !!todo.completed;
        todoEl.classList.toggle("editing", this.state.editing === todo.id);
        this.setContent(todoEl, todo.title, "label");
        this.setData(todoEl, { id: todo.id });
        const editField = this.findElement(todoEl, ".edit");
        editField.value = todo.title;
        return todoEl;
      })
    );
  }
}
```

`Upd8View` has a few main APIs that upd8 uses to manage rendering state:

- `show/hide/showing` manage view visibility, which allows you to render multiple views and let upd8 handle showing them based on global state.

- `eventListener` allows you to add interactivity and generally just results in `dispatchEvent` calls

- `el`, `findElement` and `template` help with you locating or creating HTML elements, and `setContent/setData/setAttrs` help you to modify them. These methods are used inside `update` to make your UI reactively represent `this.state` concisely.

There are a few more APIs for complex or imperative use cases, which you can explore in the [documentation](https://upd8.dev/docs).

To wire this view up to a document, you'd create an upd8 function by setting up views and initializing your app:

```javascript
import { cre8 } from "upd8";
import { TODOView } from "./todo-view";

const initUI = cre8([TODOView]);

const state = {};

const handleEvent = (name, value) => {
  // TODO: modify state
};

window.addEventListener("load", () => {
  const upd8 = initUI(state, (event) => {
    ViewModel.handleEvent(event.name, event.value);
    upd8(state);
  });
});
```

The general assumption of upd8 apps is that state changes happen outside of your app, and that your app can be represented by a large global state object. For instance, the [archival editor](https://editor.archival.dev) uses a (WASM compiled) rust library to manage state and API calls, and the UI is rendered by `upd8`.

**More**

`upd8` is designed to work extra well with [`archival`](https://archival.dev), but works anywhere that you're generating static HTML. To explore the full API and view examples, check out the [documentation](https://upd8.dev/docs).

### Contributing

This package is intended to be very small, but all ideas and contributions are welcome. Feel free to create discussions on this repository or email me at jesse@archival.dev with any ideas or observations, or file a pull request.

### License

This library is licensed under [The Unlicense](https://unlicense.org/), and is created and maintained in service of anarchistic goals. I'd prefer you didn't use it to make money for monopolists or governments, but this license is permissive to all uses.
