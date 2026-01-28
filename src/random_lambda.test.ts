import { random_lambda } from './random_lambda';

test("ignore this test", () => {
	expect(true).toEqual(true);
});

/*
test("check random lambda", () => {
	for (let i = 0; i < 50; i++) {
		let result = random_lambda(["w", "x", "y", "z"], 5);
		if (result.redexes().length >= 2) {
			console.log(`${result}`);
		}
	}
});
 */
