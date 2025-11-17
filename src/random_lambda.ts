import { Application, Lambda, Variable, LambdaObject } from './lambda_ir';

export function random_variable(variables: string[]) : Variable {
	return new Variable(variables[Math.floor(variables.length * Math.random())]);
}

export function random_lambda(variables: string[], depth: number = 10) : LambdaObject {
	let result: LambdaObject;
	if (depth <= 0) {
		return random_variable(variables);
	}
	switch (Math.floor(3 * Math.random())) {
		case 0:
			result = random_variable(variables);
			break;
		case 1:
			result = new Lambda(
				random_variable(variables),
				random_lambda(variables, depth-1)
				);
			break;
		case 2:
			result = new Application(
				random_lambda(variables, depth-1),
				random_lambda(variables, depth)
				);
			break;
		default:
			throw new Error("branch unreachable");
	}
	return result;
}
