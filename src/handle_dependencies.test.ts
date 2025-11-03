import { DependencyError, topological_sort, replace_globals } from "./handle_dependencies"
import { Parser } from "./parser";
import { Assignment, Variable, Application, Lambda } from "./lambda_ir";

test("ensure that topological_sort works", () => {
	let assignments = new Parser(
		"a = b\n" +
		"b = c\n" +
		"c = d\n" +
		"d = e\n" +
		"e = a\n" +
		"x = y\n" +
		"x = z\n" +
		"z = y\n"
	).parse_input() as Assignment[];
	try {
		topological_sort(assignments);
		expect(false).toEqual(true);
	} catch (error) {
		if (!(error instanceof DependencyError)) {
			throw error;
		}
	}

	assignments = new Parser(
		"a = a"
	).parse_input() as Assignment[];
	try {
		topological_sort(assignments);
		expect(false).toEqual(true);
	} catch (error) {
		if (!(error instanceof DependencyError)) {
			throw error;
		}
	}assignments = new Parser(
		"a = b\n" +
		"a = c\n"
	).parse_input() as Assignment[];
	try {
		topological_sort(assignments);
		expect(false).toEqual(true);
	} catch (error) {
		if (!(error instanceof DependencyError)) {
			throw error;
		}
	}

	assignments = new Parser(
		"e = f\n" +
		"c = z d e f\n" +
		"d = e f\n" +
		"b = y c d e f\n" +
		"a = x b c d e f"
	).parse_input() as Assignment[];
	assignments = topological_sort(assignments);
	let expected = ["a", "b", "c", "d", "e"];
	for (let i = 0; i < assignments.length; i++) {
		expect(assignments[i].name.get_symbol()).toEqual(expected[i]);
	}
	
	assignments = new Parser(
		"e = f\n" +
		"c = d\n" +
		"d = e\n" +
		"b = c\n" +
		"a = b"
	).parse_input() as Assignment[];
	assignments = topological_sort(assignments);
	expected = ["a", "b", "c", "d", "e"];
	for (let i = 0; i < assignments.length; i++) {
		expect(assignments[i].name.get_symbol()).toEqual(expected[i]);
	}
});


test("ensure that replace_globals works", () => {
	let actual = replace_globals(new Parser(
		"a = L x. L y. x\n" +
		"b = L x. L y. y\n" +
		"c = a b\n" +
		"b c a"
	).parse_input(), false);
	let expected = new Application(
		new Application(
			new Lambda(
				new Variable("x"),
				new Lambda(
					new Variable("y"),
					new Variable("y")
				)
			),
			new Application(
				new Lambda(
					new Variable("x"),
					new Lambda(
						new Variable("y"),
						new Variable("x")
					)
				),
				new Lambda(
					new Variable("x"),
					new Lambda(
						new Variable("y"),
						new Variable("y")
					)
				)
			)
		),
		new Lambda(
			new Variable("x"),
			new Lambda(
				new Variable("y"),
				new Variable("x")
			)
		)
	);
	expect(actual.length).toEqual(1);
	expect(actual[0].eq(expected, null)).toEqual(true);

	let lines = replace_globals(new Parser(
		"pair\n" +
		"λf. λs. λb. b f s\n" +
		"times\n" +
		"λn. λm. n ((λn. λm. n (λx. λn. λt. n (x n t)) m) m) λt. λs. s\n" +
		// "(λn. λm. n (λn. λm. n (λx. λn. λt. n (x n t)) m m) λt.λs.s)\n" +
		"or\n" +
		"(λx. λy. x (λx. λy. x) y)\n" +
		"pair times or\n" +
		"(λf. λs. λb. b f s) (λn. λm. n ((λn. λm. n (λx. λn. λt. n (x n t)) m) m) λt. λs. s) (λx. λy. x (λx. λy. x) y)"
	).parse_input());
	expect(lines.length).toEqual(8);
	expect(lines[0].eq(lines[1], null)).toEqual(true);
	expect(lines[2].eq(lines[3], null)).toEqual(true);
	expect(lines[4].eq(lines[5], null)).toEqual(true);
	expect(lines[6].eq(lines[7], null)).toEqual(true);
});
