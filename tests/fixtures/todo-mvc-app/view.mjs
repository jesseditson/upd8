import { Upd8View } from "./lib/upd8.js";

const FILTERS = ["all", "active", "completed"];

export class TODOView extends Upd8View {
	static get id() {
		return "app";
	}

	get id() {
		return TODOView.id;
	}

	clearInput() {
		this.el("new-todo").value = "";
	}

	mount() {
		return [
			this.eventListener("new-todo", "change", (_, el) => {
				const title = el.value.trim();
				if (title.length) {
					this.dispatchEvent({ name: "addTodo", value: title });
					this.clearInput();
				}
			}),
			this.eventListener("toggle-all", "change", (_, el) => {
				this.dispatchEvent({ name: "toggleAll" });
			}),
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
			this.eventListener(
				"todo-list",
				"dblclick",
				(_, el) => {
					this.dispatchEvent({ name: "edit", value: el.dataset.id });
				},
				".todo"
			),
			this.eventListener(
				"todo-list",
				"click",
				(_, el) => {
					this.dispatchEvent({
						name: "removeTodo",
						value: el.closest(".todo").dataset.id,
					});
				},
				".destroy"
			),
			this.eventListener(
				"todo-list",
				["change", "blur"],
				(e, el) => {
					this.dispatchEvent({
						name: "save",
						value: {
							id: el.closest(".todo").dataset.id,
							title: el.value.trim(),
						},
					});
				},
				".edit"
			),
			this.eventListener(
				"todo-list",
				"keydown",
				(e, el) => {
					if (e.key === "Escape") {
						this.dispatchEvent({ name: "cancelEditing" });
					}
				},
				{ useCapture: true, selector: ".edit" }
			),
			this.eventListener("clear-completed", "click", (e, el) => {
				this.dispatchEvent({ name: "clearCompleted" });
			}),
		];
	}

	showing() {
		return true;
	}

	updated() {
		this.el("main").classList.toggle("hidden", this.state.todos.length === 0);
		this.el("footer").classList.toggle("hidden", this.state.todos.length === 0);
		let completedCount = 0;
		this.setContent(
			"todo-list",
			this.state.todos.reduce((list, todo) => {
				const hidden =
					(this.state.filter === "active" && todo.completed) ||
					(this.state.filter === "completed" && !todo.completed);
				if (!hidden) {
					const todoEl = this.template("todo");
					if (todo.completed) {
						completedCount++;
					}
					todoEl.classList.toggle("completed", todo.completed);
					this.findElement(todoEl, ".toggle").checked = !!todo.completed;
					todoEl.classList.toggle("editing", this.state.editing === todo.id);
					this.setContent(todoEl, todo.title, "label");
					this.setData(todoEl, { id: todo.id });
					const editField = this.findElement(todoEl, ".edit");
					editField.value = todo.title;
					list.push(todoEl);
				}
				return list;
			}, [])
		);
		this.el("clear-completed").classList.toggle("hidden", completedCount === 0);
		const todoCount = this.state.todos.length;
		this.el("toggle-all").checked = completedCount === todoCount;
		const n = document.createElement("strong");
		n.innerText = todoCount;
		this.setContent("todo-count", [
			n,
			` item${todoCount === 1 ? "" : "s"} left`,
		]);
		for (const filter of FILTERS) {
			this.el(`filter-${filter}`).classList.toggle(
				"selected",
				this.state.filter === filter
			);
		}
	}
}
