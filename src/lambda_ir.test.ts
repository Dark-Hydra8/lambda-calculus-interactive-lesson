import { Application, Lambda, Variable } from './lambda_ir';


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

test("test the eq function of LambdaObject children classes", () => {
	/*
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
	expect(obj1.eq(obj2, {})).toEqual(false);
	
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
	expect(obj1.eq(obj3, {})).toEqual(false);
	
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
	expect(obj1.eq(obj4, {})).toEqual(false);

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
	expect(obj1.eq(obj5, {})).toEqual(true);
       */
})
