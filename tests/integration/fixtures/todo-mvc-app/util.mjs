export const makeid = (length) => {
	let result = "";
	const characters =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const charactersLength = characters.length;
	let counter = 0;
	while (counter < length) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
		counter += 1;
	}
	return result;
};

export const debounce = (fn, timeout = 0) => {
	let pt = null;
	return (...args) => {
		if (pt) {
			clearTimeout(pt);
		}
		pt = setTimeout(() => {
			pt = null;
			fn(...args);
		}, timeout);
	};
};
