import { makeid } from "./util.mjs";

const STORAGE_NAME = "todos-upd8";

const readState = () => {
	let stored = localStorage.getItem(STORAGE_NAME);
	if (stored) {
		stored = JSON.parse(stored);
	} else {
		stored = {
			todos: [],
			filter: "all",
		};
	}
	return {
		...stored,
		editing: null,
	};
};
const writeState = (state) => {
	// State is partially persisted
	const { todos, filter } = state;
	localStorage.setItem(
		STORAGE_NAME,
		JSON.stringify({
			todos,
			filter,
		})
	);
};

export const ViewModel = {
	state: readState(),
	handleEvent: (name, value) => {
		console.log("EVENT:", name, value);
		switch (name) {
			case "addTodo":
				ViewModel.state.todos.push({
					id: makeid(12),
					title: value,
					completed: false,
				});
				break;
			case "toggleAll":
				const c = !ViewModel.state.todos.find((t) => t.completed);
				console.log(c);
				ViewModel.state.todos = ViewModel.state.todos.map((t) => {
					t.completed = c;
					return t;
				});
				break;
			case "toggleTodo":
				for (const todo of ViewModel.state.todos) {
					if (todo.id === value) {
						todo.completed = !todo.completed;
						break;
					}
				}
				break;
			case "removeTodo":
				ViewModel.state.todos = ViewModel.state.todos.filter(
					(t) => t.id === value
				);
				break;
			case "edit":
				ViewModel.state.editing = value;
				break;
			case "save":
				for (const todo of ViewModel.state.todos) {
					if (todo.id === value.id) {
						todo.title = value.title;
						ViewModel.state.editing = null;
						break;
					}
				}
				break;
			case "cancelEditing":
				ViewModel.state.editing = null;
				break;
			case "clearCompleted":
				ViewModel.state.todos = ViewModel.state.todos.filter(
					(t) => !t.completed
				);
				break;
			case "hashchange":
				switch (value) {
					case "#/":
					case "#!/":
						ViewModel.state.filter = "all";
						break;
					case "#/active":
					case "#!/active":
						ViewModel.state.filter = "active";
						break;
					case "#/completed":
					case "#!/completed":
						ViewModel.state.filter = "completed";
						break;
				}
				break;
		}
		writeState(ViewModel.state);
	},
};
