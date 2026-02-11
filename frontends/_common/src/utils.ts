
export function randomString(length?: number) {
	length = length || 6;
	const arr = [];
	const base = Math.pow(10, length);
	for (let i = 0; i < length; i++) {
		arr.push(parseInt((Math.random() * 10).toString()));
	}
	return arr.join("");
}