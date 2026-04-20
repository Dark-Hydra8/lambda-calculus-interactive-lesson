import { Application, Lambda, Variable, LambdaObject } from './lambda_ir';

export function random_variable(variables: string[]) : Variable {
	return new Variable(variables[Math.floor(variables.length * Math.random())]);
}

export function random_lambda(variables: string[], depth: number = 10) : LambdaObject {
	let result: LambdaObject;
	if (depth <= 0) {
		return random_variable(variables);
	}
	let rand_max = 3;
	switch (Math.floor(rand_max * Math.random())) {
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
				random_lambda(variables, depth),
				random_lambda(variables, depth-1)
			);
			break;
		default:
			throw new Error("branch unreachable");
	}
	return result;
}

// let rand_calls = 0;

export function random_with_unique_lambdas(variables: string[], depth: number = 10, lambda_parameters: string[] | null = null) : LambdaObject {
	// let is_first_call = lambda_parameters === null;
	if (lambda_parameters === null) {
		lambda_parameters = variables;
		// rand_calls = 0;
	}
	// rand_calls++;
	let rand_max: number = 3;
	if (depth <= 0) {
		rand_max = 1;
	} else if (lambda_parameters.length === 0) {
		rand_max = 2;
	}
	let result: LambdaObject;
	switch (Math.floor(rand_max * Math.random())) {
		case 0:
			result = random_variable(variables);
			break;
		case 1:
			result = new Application(
				random_with_unique_lambdas(variables, depth, lambda_parameters),
				random_with_unique_lambdas(variables, depth-1, lambda_parameters)
			);
			break;
		case 2:
			let parameter = random_variable(lambda_parameters);
			lambda_parameters = lambda_parameters.filter(v => v !== parameter.get_symbol());
			let body: LambdaObject;
			do {
				body = random_with_unique_lambdas(variables, depth-1, lambda_parameters);
			} while (body.get_free_vars().size === 0);
			if (!body.get_free_vars().has(parameter.get_symbol())) {
				let free_vars: Variable[] = body.get_free_vars_list();
				let to_replace: Variable = free_vars[Math.floor(free_vars.length * Math.random())];
				to_replace.set_symbol(parameter.get_symbol());
			}
			result = new Lambda(parameter, body);
			break;
		default:
			throw new Error("branch unreachable");
	}
	/*
	if (is_first_call) {
		console.log("rand_calls", rand_calls);
	}
	*/
	return result;
}
