import { Application, Lambda, Variable, LambdaObject, norm_ord_reduce } from './lambda_ir';
import { Parser } from './parser';
import { replace_globals } from "./handle_dependencies";


test("test the reduction of a lambda function", () => {
	// (λy.y z) x
	let obj1 = new Application(
		new Lambda(
			new Variable("y"),
			new Application(
				new Variable("y"),
				new Variable("z")
			)
		),
		new Variable("x")
	);
	expect(String(obj1)).toEqual("(λy.y z) x");
	let result1 = (obj1.norm_ord_redex() as Application).reduce();
	expect(String(result1)).toEqual("x z");
	
	// (λy.y z) x z
	let obj2 = new Application(
		new Application(
			new Lambda(
				new Variable("y"),
				new Application(
					new Variable("y"),
					new Variable("z")
				)
			),
			new Variable("x")
		),
		new Variable("z")
	);
	expect(String(obj2)).toEqual("(λy.y z) x z");
	(obj2.norm_ord_redex() as Application).reduce();
	expect(String(obj2)).toEqual("x z z");
	
	// (λz.λx.x z) x
	let obj3 = new Application(
		new Lambda(
			new Variable("z"),
			new Lambda(
				new Variable("x"),
				new Application(
					new Variable("x"),
					new Variable("z")
				)
			)
		),
		new Variable("x")
	);
	expect(String(obj3)).toEqual("(λz.λx.x z) x");
	let result3 = (obj3.norm_ord_redex() as Application).reduce();
	expect(String(result3)).toEqual("λx'.x' x");	
});


test("test the reduction of a lambda function that was causing issues", () => {
	let objs = new Parser(
		"(λx.x)λx.x\n" +
		"λx.x\n" +
		"y((λx.x)λx.x)\n" +
		"y(λx.x)"
	).parse_input() as LambdaObject[];
	// console.log(`${objs[0]}\n${objs[1]}`);
	expect(objs.length).toEqual(4);
	let redex = objs[0].norm_ord_redex() as Application;
	objs[0] = redex.reduce();
	// console.log(`${objs[0]}\n${objs[1]}`);
	expect(objs[0].eq(objs[1], null)).toEqual(true);
	(objs[2].norm_ord_redex() as Application).reduce();
	expect(objs[2].eq(objs[3], null)).toEqual(true);
});

test("test the eq function of LambdaObject children classes", () => {
	// λx.x
	let simple1 = new Lambda(
		new Variable("x"),
		new Variable("x")
	);
	
	// λx.x
	let simple2 = new Lambda(
		new Variable("x"),
		new Variable("x")
	);
	expect(simple1.eq(simple2, null)).toEqual(true);

	// λy.y
	let simple3 = new Lambda(
		new Variable("y"),
		new Variable("y")
	);
	expect(simple1.eq(simple3, null)).toEqual(true);

	// λy.x
	let simple4 = new Lambda(
		new Variable("y"),
		new Variable("x")
	);
	expect(simple1.eq(simple4, null)).toEqual(false);

	// (λx.xx) x
	let obj1 = new Application(
		new Lambda(
			new Variable("x"),
			new Application(
				new Variable("x"),
				new Variable("x")
			)
		),
		new Variable("x")
	);

	// (λx.xx) x
	// same as above
	let obj2 = new Application(
		new Lambda(
			new Variable("x"),
			new Application(
				new Variable("x"),
				new Variable("x")
			)
		),
		new Variable("x")
	);
	expect(obj1.eq(obj2, null)).toEqual(true);
	
	// (λx.xy) x
	// One variable changed
	let obj3 = new Application(
		new Lambda(
			new Variable("x"),
			new Application(
				new Variable("x"),
				new Variable("y")
			)
		),
		new Variable("x")
	);
	expect(obj1.eq(obj3, null)).toEqual(false);
	
	// (λy.xx) x
	// One variable changed
	let obj4 = new Application(
		new Lambda(
			new Variable("y"),
			new Application(
				new Variable("x"),
				new Variable("x")
			)
		),
		new Variable("x")
	);
	expect(obj1.eq(obj4, null)).toEqual(false);

	// (λy.yy) x
	let obj5 = new Application(
		new Lambda(
			new Variable("y"),
			new Application(
				new Variable("y"),
				new Variable("y")
			)
		),
		new Variable("x")
	);
	expect(obj1.eq(obj5, null)).toEqual(true);
});

test("ensure that parentesis are placed correctly", () => {
	// (λz.λx.x z) x
	let expected = "λn.λm.n λn.λm.n (λx.λn.λt.n (x n t)) m m";
	let actual = new Parser(expected).parse_input()[0];
	expect(String(actual)).toEqual(expected);
});

test("ensure that reducing redexes many in a chain results in the correct result", () => {
	let exprs = replace_globals(new Parser(
		"scc 6\n" +
		"plus 3 11\n" +
		"times 9 5\n" +
		"prd 17\n" +
		"minus 13 9\n" +
		"fact = fix L f. L x. isZero x 1 (times x (f (prd x)))\n" +
		"fact 4\n" +
		"fst (pair tru fls)\n" +
		"snd (pair tru fls)\n" +
		"list = L x. L y. pair tru (pair x y)\n" +
		"l = pair tru (pair 2 (pair 3 fls))\n" +
		"head l\n" +
		"tail l\n" +
		"gteq 12 4\n" +
		"gteq 4 12\n" +
		"equal 17 17"
	).parse_input());
	let results = new Parser(
		"7\n" +
		"14\n" +
		"45\n" +
		"16\n" +
		"4\n" +
		"24\n" +
		"L x. L y. x\n" +
		"L x. L y. y\n" +
		"2\n" +
		"L x. x 3 (L x. L y. y)\n" +
		"L x. L y. x\n" +
		"L x. L y. y\n" +
		"L x. L y. x"
	).parse_input() as LambdaObject[];
	expect(exprs.length).toEqual(results.length);
	for (let i = 0; i < exprs.length; i++) {
		let reduced;
		let before = exprs[i].copy();
		while (exprs[i].norm_ord_redex() !== null) {
			exprs[i] = norm_ord_reduce(exprs[i]) as Lambda;
		}
		// console.log(`${i}:\nbefore: ${before}\nafter: ${exprs[i]}\nexpected: ${results[i]}`);
		expect(exprs[i].eq(results[i], null)).toEqual(true);
	}
});
