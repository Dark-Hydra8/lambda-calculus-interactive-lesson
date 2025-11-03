import { Parser } from './parser';
import { Assignment, LambdaObject, Variable } from './lambda_ir';
import { Queue } from './utils';

export class DependencyError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "CyclicalDependencyError";
	}
}

class DependNode {
	public assignment: Assignment;
	public in_degree: number;

	public constructor(assignment: Assignment) {
		this.assignment = assignment;
		this.in_degree = 0;
	}
}

export function topological_sort(assignments: Assignment[]) : Assignment[] {
	let nodes: Record<string, DependNode> = {};
	for (let assignment of assignments) {
		let name = assignment.name.get_symbol();
		if (name in nodes) {
			throw new DependencyError(`variable defined twice: ${name}`);
		}
		nodes[name] = new DependNode(assignment);
	}
	for (let name in nodes) {
		let dep_node = nodes[name];
		for (let free_var of dep_node.assignment.value.get_free_vars()) {
			if (free_var in nodes) {
				nodes[free_var].in_degree++;
			}
		}
	}

	let queue = new Queue<DependNode>();

	for (let name in nodes) {
		let dep_node = nodes[name];
		if (dep_node.in_degree === 0) {
			queue.push(dep_node);
		}
	}

	let result = [];
	while (!queue.is_empty()) {
		let dep_node = queue.pop() as DependNode;
		result.push(dep_node.assignment);

		for (let free_var of dep_node.assignment.value.get_free_vars()) {
			if (free_var in nodes) {
				let free_node = nodes[free_var];
				free_node.in_degree--;
				if (free_node.in_degree <= 0) {
					queue.push(free_node);
				}
			}
		}
	}
	
	if (result.length !== assignments.length) {
		throw new DependencyError("Cycle found in global dependencies");
	}

	return result;
}

export function replace_globals(lines: (Assignment | LambdaObject)[], include_std: boolean = true) : LambdaObject[] {
	let globals: Assignment[];
	if (include_std) {
		globals = new Parser(
			"scc = λx. λn. λt. n (x n t)\n" +
			"plus = λn. λm. n scc m\n" +
			"times = λn. λm. n (plus m) 0\n" +
			"tru = λx. λy. x\n" +
			"fls = λx. λy. y\n" +
			"and = λx. λy. x y fls\n" +
			"or = λx. λy. x tru y\n" +
			"not = λb. b fls tru\n" +
			"gteq = λn. λm. isZero (minus m n)\n" +
			"lteq = λn. λm. isZero (minus n m)\n" +
			"equal = λn. λm. and (lteq m n) (lteq n m)\n" +
			"head = λl. fst (snd l)\n" +
			"tail = λl. snd (snd l)\n" +
			"isEmpty = λl. not (fst l)\n" +
			"fix = λf. (λx. f (λy. x x y)) (λx. f (λy. x x y))\n" +
			"isZero = λn. n (λx. fls) tru\n" +
			"fst = λp. p tru\n" +
			"snd = λp. p fls\n" +
			"prd = λn. fst (n (λp. pair (snd p) (scc (snd p))) (pair 0 0))\n" +
			"minus = λm. λn. n prd m\n" +
			"pair = λf. λs. λb. b f s"
		).parse_input() as Assignment[];
	} else {
		globals = [];
	}
	let objs = [];
	for (let line of lines) {
		if (line instanceof Assignment) {
			globals.push(line);
		} else {
			objs.push(line);
		}
	}
	globals = topological_sort(globals);

	for (let i = 0; i < globals.length; i++) {
		for (let j = i + 1; j < globals.length; j++) {
			if (globals[j].value instanceof Variable && globals[i].value.eq(globals[j].value, null)) {
				globals[j].value = globals[i].value.copy();
			} else {
				globals[j].value.replace(globals[i].name, globals[i].value);
			}
		}
	}
	
	for (let g of globals) {
		for (let i = 0; i < objs.length; i++) {
			let obj = objs[i];
			// console.log(`processing: ${obj}`);
			if (obj instanceof Variable && obj.eq(g.name, null)) {
				objs[i] = g.value.copy();
			} else {
				obj.replace(g.name, g.value);
			}
		}
	}

	return objs;
}
