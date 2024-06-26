import { cre8 } from "./lib/upd8.js";
import { debounce } from "./util.mjs";
import { ViewModel } from "./view-model.js";
import { TODOView } from "./view.mjs";

// https://github.com/tastejs/todomvc/blob/master/app-spec.md

const initUI = cre8([TODOView], {});

ViewModel.init();

window.addEventListener("load", () => {
	const upd8 = debounce(
		initUI(ViewModel.state, (event) => {
			ViewModel.handleEvent(event.name, event.value);
			upd8(ViewModel.state);
		})
	);
	window.addEventListener("hashchange", () => {
		ViewModel.handleEvent("hashchange", window.location.hash);
		upd8(ViewModel.state);
	});
	ViewModel.handleEvent("hashchange", window.location.hash);
});
