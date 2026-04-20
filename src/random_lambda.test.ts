import { random_lambda } from './random_lambda';
import { Variable } from './lambda_ir';

test("ignore this test", () => {
	expect(true).toEqual(true);
});

test("check random lambda", () => {
	let lambdas: string = "";
	for (let i = 0; i < 50; i++) {
		let result = random_lambda(["w", "x", "y", "z"], 5);
		if (result instanceof Variable) {
			continue;
		}
		lambdas += `${result}\n`;
	}
	console.log(lambdas);
});
