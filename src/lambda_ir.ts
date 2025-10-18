export interface Redex {
	parent: LambdaTree,
	is_right_child: boolean
}

export abstract class LambdaObject {
	protected free_vars: Set<Variable>;

	public constructor(free_vars: Set<Variable>) {
		this.free_vars = free_vars;
	}

	public get_free_vars() : Set<Variable> {
		return this.free_vars;
	}

	public abstract copy(copies: Record<string, Variable>) : LambdaObject;
	public abstract norm_ord_redex() : Redex | null | LambdaObject;
	public abstract replace(variable: Variable, replacement: LambdaObject) : void;
}

export abstract class LambdaTree extends LambdaObject {
	protected left: LambdaObject;
	protected right: LambdaObject;
	
	public constructor(left: LambdaObject, right: LambdaObject) {
		console.log(`left ${left}`);
		console.log(`right ${right}`);
		let free_vars = new Set([...left.get_free_vars(), ...right.get_free_vars()]);
		super(free_vars);
		this.left = left;
		this.right = right;
	}

	public replace(variable: Variable, replacement: LambdaObject) : void {
		if (variable === this.right) {
			this.right = replacement.copy({});
		} else if (this.right.get_free_vars().has(variable)) {
			this.right.replace(variable, replacement);
		}
		if (variable === this.left) {
			this.left = replacement.copy({});
		} else if (this.left.get_free_vars().has(variable)) {
			this.left.replace(variable, replacement);
		}
		this.constructor(this.left, this.right);
	}
	
	public reduce_child(is_right_child: boolean) : void {
		if (is_right_child && this.right instanceof Application) {
			this.right.reduce();
		} else if (!is_right_child && this.left instanceof Application) {
			this.left.reduce();
		}
	}

	public norm_ord_redex() : Redex | null | LambdaObject {
		let right = this.right.norm_ord_redex();
		if (right !== null) {
			return right;
		}
		let left = this.left.norm_ord_redex();
		return left;
	}
}

export class Lambda extends LambdaTree {
	public constructor(parameter: Variable, body: LambdaObject) {
		super(parameter, body);
		this.free_vars.delete(parameter);
	}

	public copy(copies: Record<string, Variable> = {}) : Lambda {
		let left = this.left.copy(copies) as Variable;
		let right = this.right.copy(copies);
		return new Lambda(left, right);
	}

	public replace(variable: Variable, replacement: LambdaObject) : void {
		if (variable !== this.left) {
			super.replace(variable, replacement);
		}
	}

	public call(replacement: LambdaObject) : LambdaObject {
		let result = this.right;
		this.right.replace(this.left as Variable, replacement);
		this.constructor(new Variable(""), new Variable(""));
		return result;
	}

	public toString() : string {
		return `λ${this.left}.(${this.right})`
	}
}

export class Application extends LambdaTree {
	public constructor(left: LambdaObject, right: LambdaObject) {
		super(left, right);
	}

	public copy(copies: Record<string, Variable> = {}) : Application {
		let left = this.left.copy(copies);
		let right = this.right.copy(copies);
		return new Application(left, right);
	}

	public reduce() : LambdaObject | null {
		if (this.left instanceof Lambda) {
			return this.left.call(this.right);
		}
		return null;
	}

	public norm_ord_redex() : Redex | null | LambdaObject {
		if (this.left instanceof Lambda) {
			return this;
		} else {
			return super.norm_ord_redex();
		}
	}

	public toString() : string {
		/*
		let left = String(this.left);
		if (this.left instanceof Lambda) {
			left = `(${left})`;
		}

		let right = String(this.right);
		if (this.right instanceof Application) {
			right = `(${right})`;
		}
	         */

		return `(${left}) (${right})`;
	}
}

export class Variable extends LambdaObject {
	protected symbol: string;

	public constructor(symbol: string) {
		super(new Set([]));
		this.free_vars.add(this);
		this.symbol = symbol;
	}

	public copy(copies: Record<string, Variable> = {}) : Variable {
		if (copies.has(this.symbol)) {
			return copies[this.symbol];
		} else {
			return copies[this.symbol] = new Variable(this.symbol);
		}
	}

	public toString() : string {
		return this.symbol;
	}
}

export class Assignment {
	public variable: Variable;
	public value: LambdaObject;

	public constructor(variable: Variable, value: LambdaObject) {
		this.variable = variable;
		this.value = value;
	}

	public toString() : string {
		return `${String(variable)} = ${String(value)}`;
	}
}
