import { Application, Lambda, Variable, LambdaObject, norm_ord_reduce, set_debug } from './lambda_ir';
import { Parser } from './parser';
import { replace_globals } from "./handle_dependencies";
import { random_lambda } from './random_lambda';


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

	let obj6 = new Parser(
		"(λx.λy.x y) (λy.y)\n" +
		"λy.(λy.y) y"
	).parse_input() as LambdaObject[];
	obj6[0] = norm_ord_reduce(obj6[0]) as LambdaObject;
	expect(String(obj6[0])).toEqual(String(obj6[1]));

	let obj7 = new Parser(
		"(λx.λy.x y) (λx.y)\n" +
		"λy'.(λx.y) y'"
	).parse_input() as LambdaObject[];
	obj7[0] = norm_ord_reduce(obj7[0]) as LambdaObject;
	expect(String(obj7[0])).toEqual(String(obj7[1]));

	let obj8 = new Parser(
		"(λx.λy.x y) (λx.y')\n" +
		"λy.(λx.y') y"
	).parse_input() as LambdaObject[];
	obj8[0] = norm_ord_reduce(obj8[0]) as LambdaObject;
	expect(String(obj8[0])).toEqual(String(obj8[1]));

	let obj9 = new Parser(
		"(λx.λy.y y' y'' y''' y'''' x) (λx.y)\n" +
		"λy'''''. y''''' y' y'' y''' y'''' λx.y"
	).parse_input() as LambdaObject[];
	obj9[0] = norm_ord_reduce(obj9[0]) as LambdaObject;
	expect(String(obj7[0])).toEqual(String(obj7[1]));
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

test("test redex_ranges function", () => {
	// Variable should have no redex ranges
	let var1 = new Variable("x");
	let varRanges = var1.redex_ranges();
	expect(varRanges.length).toEqual(0);

	// Simple redex: (λx.x) y
	let simpleRedex = new Application(
		new Lambda(
			new Variable("x"),
			new Variable("x")
		),
		new Variable("y")
	);
	let simpleRanges = simpleRedex.redex_ranges();
	let simpleStr = String(simpleRedex).replace(/\s/g, '');
	expect(simpleRanges.length).toEqual(1);
	expect(simpleRanges[0].start).toEqual(0);
	expect(simpleRanges[0].end).toEqual(simpleStr.length);
	
	// Verify the range points to the full redex
	expect(simpleStr.substring(simpleRanges[0].start, simpleRanges[0].end)).toEqual(simpleStr);

	// Nested redexes: (λx.x) ((λy.y) z)
	let nestedRedex = new Application(
		new Lambda(
			new Variable("x"),
			new Variable("x")
		),
		new Application(
			new Lambda(
				new Variable("y"),
				new Variable("y")
			),
		new Variable("z")
		)
	);
	let nestedRanges = nestedRedex.redex_ranges();
	let nestedStr = String(nestedRedex).replace(/\s/g, '');
	// Should have 2 redexes: the outer one and the left inner one
	expect(nestedRanges.length).toEqual(2);
	// The outer redex should span the entire expression
	let outerRange = nestedRanges.find(r => r.start === 0 && r.end === nestedStr.length);
	expect(outerRange).toBeDefined();
	expect(nestedRanges.find(r => r.start === 7 && r.end === 14)).toBeDefined();
	
	// One redex: (λx.x) y (λz.z) w
	let multiRedex = new Application(
		new Application(
			new Application(
				new Lambda(
					new Variable("x"),
					new Variable("x")
				),
				new Variable("y")
			),
			new Lambda(
				new Variable("z"),
				new Variable("z")
			)
		),
		new Variable("w")
	);
	let multiRanges = multiRedex.redex_ranges();
	let multiStr = String(multiRedex).replace(/\s/g, '');
	expect(multiRanges.length).toEqual(1);
	expect(multiRanges[0].start).toEqual(0);
	expect(multiRanges[0].end).toEqual(7);
	
	// Lambda with no redexes in body: λx.y
	let lambdaNoRedex = new Lambda(
		new Variable("x"),
		new Variable("y")
	);
	let lambdaRanges = lambdaNoRedex.redex_ranges();
	expect(lambdaRanges.length).toEqual(0);
	
	// Lambda with redex in body: λx.(λy.y) z
	let lambdaWithRedex = new Lambda(
		new Variable("x"),
		new Application(
			new Lambda(
				new Variable("y"),
				new Variable("y")
			),
			new Variable("z")
		)
	);
	let lambdaWithRedexRanges = lambdaWithRedex.redex_ranges();
	let lambdaWithRedexStr = String(lambdaWithRedex).replace(/\s/g, '');
	// Should have 1 redex in the body
	expect(lambdaWithRedexRanges.length).toEqual(1);
	// The range should be adjusted for the lambda prefix (λx.)
	let prefixLength = String(lambdaWithRedex.get_parameter()).length + 2; // "λx."
	expect(lambdaWithRedexRanges[0].start).toBeGreaterThanOrEqual(prefixLength);
	expect(lambdaWithRedexRanges[0].end).toBeLessThanOrEqual(lambdaWithRedexStr.length);
	
	// Verify ranges don't exceed string bounds
	for (let range of lambdaWithRedexRanges) {
		expect(range.start).toBeGreaterThanOrEqual(0);
		expect(range.end).toBeLessThanOrEqual(lambdaWithRedexStr.length);
		expect(range.start).toBeLessThan(range.end);
	}
});

test("test alpha renaming functionality", () => {
	let lambdaObjs = new Parser(
		"(λx.λy.x) y\n" +
		"λy'.y"
	).parse_input() as LambdaObject[];
	let reduced = norm_ord_reduce(lambdaObjs[0]) as LambdaObject;
	expect(reduced.eq(lambdaObjs[1], null)).toEqual(true);

	lambdaObjs = new Parser(
		"z((λx.λy.x) y x)\n" +
		"z((λy'.y) x)"
	).parse_input() as LambdaObject[];
	reduced = norm_ord_reduce(lambdaObjs[0]) as LambdaObject;
	expect(reduced.eq(lambdaObjs[1], null)).toEqual(true);

	lambdaObjs = new Parser(
		"(λx.λy.λz.λy.x) (y z)\n" +
		"λy'.λz'.λy'. y z"
	).parse_input() as LambdaObject[];
	reduced = norm_ord_reduce(lambdaObjs[0]) as LambdaObject;
	expect(reduced.eq(lambdaObjs[1], null)).toEqual(true);

	lambdaObjs = new Parser(
		"(λx.λy'.λy.x) y\n" +
		"λy'.λy''.y"
	).parse_input() as LambdaObject[];
	reduced = norm_ord_reduce(lambdaObjs[0]) as LambdaObject;
	expect(reduced.eq(lambdaObjs[1], null)).toEqual(true);
});

test("test the detection of free variables", () => {
	let lambdaObj = new Parser(
		"λx.(λy.y) x"
	).parse_input()[0] as LambdaObject;
	expect(lambdaObj.get_free_vars()).toEqual(new Set());

	lambdaObj = new Parser(
		"λx.(λy.w y) z"
	).parse_input()[0] as LambdaObject;
	expect(lambdaObj.get_free_vars()).toEqual(new Set(["z", "w"]));
});

test("test the alpha renaming functionality", () => {
	let lambdaObjs = new Parser(
		"λx.x y\n" +
		"λx'.x' y"
	).parse_input() as LambdaObject[];
	lambdaObjs[0].alpha_rename(new Variable("y"), new Set(["x"]));
	expect(String(lambdaObjs[0])).toEqual(String(lambdaObjs[1]));

	lambdaObjs = new Parser(
		"x y\n" +
		"x y"
	).parse_input() as LambdaObject[];
	lambdaObjs[0].alpha_rename(new Variable("y"), new Set(["x"]));
	expect(String(lambdaObjs[0])).toEqual(String(lambdaObjs[1]));
	
	lambdaObjs = new Parser(
		"λx.λy.x y z\n" +
		"λx'.λy'.x' y' z"
	).parse_input() as LambdaObject[];
	lambdaObjs[0].alpha_rename(new Variable("z"), new Set(["x", "y"]));
	expect(String(lambdaObjs[0])).toEqual(String(lambdaObjs[1]));

	lambdaObjs = new Parser(
		"λx.λy.x y z\n" +
		"λx.λy'.x y' z"
	).parse_input() as LambdaObject[];
	lambdaObjs[0].alpha_rename(new Variable("z"), new Set(["y"]));
	expect(String(lambdaObjs[0])).toEqual(String(lambdaObjs[1]));

	lambdaObjs = new Parser(
		"λx.λy.x y\n" +
		"λx.λy.x y"
	).parse_input() as LambdaObject[];
	lambdaObjs[0].alpha_rename(new Variable("z"), new Set(["x", "y"]));
	expect(String(lambdaObjs[0])).toEqual(String(lambdaObjs[1]));

	lambdaObjs = new Parser(
		"λx.λy.x y z\n" +
		"λx.λy.x y z"
	).parse_input() as LambdaObject[];
	lambdaObjs[0].alpha_rename(new Variable("x"), new Set(["x", "y"]));
	expect(String(lambdaObjs[0])).toEqual(String(lambdaObjs[1]));

	lambdaObjs = new Parser(
		"λx.λy.x y z\n" +
		"λx.λy.x y z"
	).parse_input() as LambdaObject[];
	lambdaObjs[0].alpha_rename(new Variable("z"), new Set());
	expect(String(lambdaObjs[0])).toEqual(String(lambdaObjs[1]));

	lambdaObjs = new Parser(
		"(λv.λw.λz.v w z) ((λv.v) (v y) z)\n" +
		"(λv.λw.λz'.v w z') ((λv.v) (v y) z)"
	).parse_input() as LambdaObject[];
	((lambdaObjs[0] as Application).get_left() as Lambda).get_body().alpha_rename(new Variable("v"), new Set(["v", "y", "z"]));
	expect(String(lambdaObjs[0])).toEqual(String(lambdaObjs[1]));
});

test("test that parsing the string version of a random lambda expression results in the same lambda object", () => {
	for (let i = 0; i < 100; i++) {
		let lambdaObj = random_lambda(["a", "b", "c", "d", "e", "f", "g", "e"], 8);
		let lambdaStr = String(lambdaObj);
		let parsedObj = new Parser(lambdaStr).parse_input()[0] as LambdaObject;
		expect(lambdaObj.eq(parsedObj, null)).toEqual(true);
	}
});

test("test the object_ranges function", () => {
	let lambdaObjs = new Parser(
		"λx.x y\n" +
		"x\n" +
		"x y\n" +
		"y"
	).parse_input() as LambdaObject[];
	let is_first = true;
	for (let [range, obj] of lambdaObjs[0].object_ranges()) {
		if (lambdaObjs[0].eq(obj, null)) {
			// Whole expression
			expect(range.start).toEqual(0);
			expect(range.end).toEqual(5);
		} else if (lambdaObjs[1].eq(obj, null) && is_first) {
			// first x
			expect(range.start).toEqual(1);
			expect(range.end).toEqual(2);
			is_first = false;
		} else if (lambdaObjs[1].eq(obj, null) && !is_first) {
			// second x
			expect(range.start).toEqual(3);
			expect(range.end).toEqual(4);
		} else if (lambdaObjs[2].eq(obj, null)) {
			// x y
			expect(range.start).toEqual(3);
			expect(range.end).toEqual(5);
		} else if (lambdaObjs[3].eq(obj, null)) {
			// y
			expect(range.start).toEqual(4);
			expect(range.end).toEqual(5);
		} else {
			throw new Error(`Unknown object: ${obj}`);
		}
	}

	lambdaObjs = new Parser(
		"( (  ( λ x . ( ( x y ) ) ) ) )\n" +
		"λx.x y"
	).parse_input() as LambdaObject[];
	let range1 = lambdaObjs[0].object_ranges();
	let range2 = lambdaObjs[1].object_ranges();
	for (let i = 0; i < range1.length; i++) {
		expect(range1[i][0].start).toEqual(range2[i][0].start);
		expect(range1[i][0].end).toEqual(range2[i][0].end);
		expect(range1[i][1].eq(range2[i][1], null)).toEqual(true);
	}

	lambdaObjs = new Parser(
		"(λx.x) y\n" +
		"x\n" +
		"λx.x\n" +
		"y"
	).parse_input() as LambdaObject[];
	is_first = true;
	for (let [range, obj] of lambdaObjs[0].object_ranges()) {
		if (lambdaObjs[0].eq(obj, null)) {
			// Whole expression
			expect(range.start).toEqual(0);
			expect(range.end).toEqual(7);
		} else if (lambdaObjs[1].eq(obj, null) && is_first) {
			// first x
			expect(range.start).toEqual(2);
			expect(range.end).toEqual(3);
			is_first = false;
		} else if (lambdaObjs[1].eq(obj, null) && !is_first) {
			// second x
			expect(range.start).toEqual(4);
			expect(range.end).toEqual(5);
		} else if (lambdaObjs[2].eq(obj, null)) {
			// λx.x
			expect(range.start).toEqual(1);
			expect(range.end).toEqual(5);
		} else if (lambdaObjs[3].eq(obj, null)) {
			// y
			expect(range.start).toEqual(6);
			expect(range.end).toEqual(7);
		} else {
			throw new Error(`Unknown object: ${obj}`);
		}
	}

	lambdaObjs = new Parser(
		"(λx.y) (a b)\n" +
		"λx.y\n" +
		"x\n" +
		"y\n" +
		"a b\n" +
		"a\n" +
		"b"
	).parse_input() as LambdaObject[];
	for (let [range, obj] of lambdaObjs[0].object_ranges()) {
		if (lambdaObjs[0].eq(obj, null)) {
			// Whole expression
			expect(range.start).toEqual(0);
			expect(range.end).toEqual(10);
		} else if (lambdaObjs[1].eq(obj, null)) {
			// λx.y
			expect(range.start).toEqual(1);
			expect(range.end).toEqual(5);
		} else if (lambdaObjs[2].eq(obj, null)) {
			// x
			expect(range.start).toEqual(2);
			expect(range.end).toEqual(3);
		} else if (lambdaObjs[3].eq(obj, null)) {
			// y
			expect(range.start).toEqual(4);
			expect(range.end).toEqual(5);
		} else if (lambdaObjs[4].eq(obj, null)) {
			// a b
			expect(range.start).toEqual(7);
			expect(range.end).toEqual(9);
		} else if (lambdaObjs[5].eq(obj, null)) {
			// a
			expect(range.start).toEqual(7);
			expect(range.end).toEqual(8);
		} else if (lambdaObjs[6].eq(obj, null)) {
			// b
			expect(range.start).toEqual(8);
			expect(range.end).toEqual(9);
		} else {
			throw new Error(`Unknown object: ${obj}`);
		}
	}

	lambdaObjs = new Parser(
		"a (λb.c) d\n" +
		"a (λb.c)\n" +
		"a\n" +
		"λb.c\n" +
		"b\n" +
		"c\n" +
		"d"
	).parse_input() as LambdaObject[];
	for (let [range, obj] of lambdaObjs[0].object_ranges()) {
		if (lambdaObjs[0].eq(obj, null)) {
			// Whole expression
			expect(range.start).toEqual(0);
			expect(range.end).toEqual(8);
		} else if (lambdaObjs[1].eq(obj, null)) {
			// a (λb.c)
			expect(range.start).toEqual(0);
			expect(range.end).toEqual(7);
		} else if (lambdaObjs[2].eq(obj, null)) {
			// a
			expect(range.start).toEqual(0);
			expect(range.end).toEqual(1);
		} else if (lambdaObjs[3].eq(obj, null)) {
			// λb.c
			expect(range.start).toEqual(2);
			expect(range.end).toEqual(6);
		} else if (lambdaObjs[4].eq(obj, null)) {
			// b
			expect(range.start).toEqual(3);
			expect(range.end).toEqual(4);
		} else if (lambdaObjs[5].eq(obj, null)) {
			// c
			expect(range.start).toEqual(5);
			expect(range.end).toEqual(6);
		} else if (lambdaObjs[6].eq(obj, null)) {
			// d
			expect(range.start).toEqual(7);
			expect(range.end).toEqual(8);
		} else {
			throw new Error(`Unknown object: ${obj}`);
		}
	}

	for (let i = 0; i < 100; i++) {
		let lambdaObj = random_lambda(["a", "b", "c", "d", "e", "f", "g", "h"], 8);
		for (let [range, obj] of lambdaObj.object_ranges()) {
			let no_space_str = String(obj).replace(/\s/g, '');
			expect(range.end - range.start).toEqual(no_space_str.length);
		}
	}
});