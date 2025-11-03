import { Parser } from './parser';
import { Lambda, Application, Variable, LambdaObject, Assignment } from './lambda_ir';

test("Test the parser for lambda functions", () => {
	let actual: LambdaObject;
	let expected: LambdaObject;

	actual = new Parser("L x. x x").parse_input()[0] as LambdaObject;
	expected = new Lambda(
		new Variable("x"),
		new Application(
			new Variable("x"),
			new Variable("x")
		)
	);
	expect(actual.eq(expected, null)).toEqual(true);
	
	actual = new Parser("(L x. (x (x)))").parse_input()[0] as LambdaObject;
	expected = new Lambda(
		new Variable("x"),
		new Application(
			new Variable("x"),
			new Variable("x")
		)
	);
	expect(actual.eq(expected, null)).toEqual(true);
	
	actual = new Parser("a b c d").parse_input()[0] as LambdaObject;
	expected = new Application(
		new Application(
			new Application(
				new Variable("a"),
				new Variable("b")
			),
			new Variable("c")
		),
		new Variable("d")
	);
	expect(actual.eq(expected, null)).toEqual(true);
	
	actual = new Parser("((((a) b) c) d)").parse_input()[0] as LambdaObject;
	expected = new Application(
		new Application(
			new Application(
				new Variable("a"),
				new Variable("b")
			),
			new Variable("c")
		),
		new Variable("d")
	);
	expect(actual.eq(expected, null)).toEqual(true);

	actual = new Parser("(a (b (c (d))))").parse_input()[0] as LambdaObject;
	expected = new Application(
		new Variable("a"),
		new Application(
			new Variable("b"),
			new Application(
				new Variable("c"),
				new Variable("d")
			)
		),
	);
	expect(actual.eq(expected, null)).toEqual(true);
});

test("Test the parser for assignments", () => {
	let actual1 = new Parser("add_1 = L x. L t. L s. x t (t s)").parse_input()[0] as Assignment;
	let expected1 = new Assignment(
		new Variable("add_1"),
		new Lambda(
			new Variable("x"),
			new Lambda(
				new Variable("t"),
				new Lambda(
					new Variable("s"),
					new Application(
						new Application(
							new Variable("x"),
							new Variable("t")
						),
						new Application(
							new Variable("t"),
							new Variable("s")
						)
					)
				)
			)
		)
	);
	expect(actual1.eq(expected1, null)).toEqual(true);

	let actual2 = new Parser(
		"\nval1 = L t. L s. t s\n" +
		"\tval2 = L t. L s. t (t s)\n \n\t \n" +
		"val1   val2 \n\t\n \n"
	).parse_input();
	let expected2 = [
		new Assignment(
			new Variable("val1"),
				new Lambda(
				new Variable("t"),
				new Lambda(
					new Variable("s"),
					new Application(
						new Variable("t"),
						new Variable("s")
					)
				)
			)
		),
		new Assignment(
			new Variable("val2"),
				new Lambda(
				new Variable("t"),
				new Lambda(
					new Variable("s"),
					new Application(
						new Variable("t"),
						new Application(
							new Variable("t"),
							new Variable("s")
						)
					)
				)
			)
		),
		new Application(
			new Variable("val1"),
			new Variable("val2")
		)
	];
	expect(actual2.length).toEqual(3);
	expect((actual2[0] as Assignment).eq(expected2[0] as Assignment, null)).toEqual(true);
	expect((actual2[1] as Assignment).eq(expected2[1] as Assignment, null)).toEqual(true);
	expect((actual2[2] as LambdaObject).eq(expected2[2] as LambdaObject, null)).toEqual(true);
});

test("ensure that handling of numbers works", () => {
	let nums = new Parser(
		"0\n" +
		"L x. L y. y\n" +
		"1\n" +
		"L x. L y. x y\n" +
		"2\n" +
		"L x. L y. x(x y)\n" +
		"12\n" +
		"L x. L y. x(x(x(x(x(x(x(x(x(x(x(x y)))))))))))"
	).parse_input() as Lambda[];
	expect(nums[0].eq(nums[1], null)).toEqual(true);
	expect(nums[2].eq(nums[3], null)).toEqual(true);
	expect(nums[4].eq(nums[5], null)).toEqual(true);
	expect(nums[6].eq(nums[7], null)).toEqual(true);
});
