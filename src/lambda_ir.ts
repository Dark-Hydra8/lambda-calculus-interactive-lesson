function sets_eq<T>(set1: Set<T>, set2: Set<T>): boolean {
	if (set1.size !== set2.size) {
		return false;
	}
	for (let item of set1) {
		if (!set2.has(item)) {
			return false;
		}
	}
	return true;
}

class VariableMapping {
	protected a_to_b: Record<string, string>;
	protected b_to_a: Record<string, string>;

	public constructor() {
		this.a_to_b = {};
		this.b_to_a = {};
	}

	public copy() : VariableMapping {
		let copy = new VariableMapping();
		copy.a_to_b = {...this.a_to_b};
		copy.b_to_a = {...this.b_to_a};
		return copy;
	}

	public ingest(a: LambdaObject, b: LambdaObject) : boolean {
		return false;
	}
}


export abstract class LambdaObject {
	protected free_vars: Set<string>;
	protected parent: LambdaTree | null;

	public constructor(free_vars: Set<string>) {
		this.free_vars = free_vars;
		this.parent = null;
	}

	public get_free_vars() : Set<string> {
		return this.free_vars;
	}
	
	public set_parent(parent: LambdaTree | null) : void {
		this.parent = parent;
	}

	public get_parent() : LambdaTree | null {
		return this.parent;
	}

	public abstract copy() : LambdaObject;
	public abstract norm_ord_redex() : Application | null;
	public abstract replace(variable: Variable, replacement: LambdaObject) : void;
	public abstract eq(other: LambdaObject, var_mapping: Record<string, string>) : boolean;
}

export abstract class LambdaTree extends LambdaObject {
	protected left: LambdaObject;
	protected right: LambdaObject;
	
	public constructor(left: LambdaObject, right: LambdaObject) {
		// console.log(`left ${left}`);
		// console.log(`right ${right}`);
		let free_vars = new Set([...left.get_free_vars(), ...right.get_free_vars()]);
		super(free_vars);
		this.left = left;
		this.right = right;
		left.set_parent(this);
		right.set_parent(this);
	}

	public replace(variable: Variable, replacement: LambdaObject) : void {
		if (this.right instanceof Variable && variable.get_symbol() === this.right.get_symbol()) {
			this.right = replacement.copy();
		} else if (this.right.get_free_vars().has(variable.get_symbol())) {
			this.right.replace(variable, replacement);
		}
		if (this.left instanceof Variable && variable.get_symbol() === this.left.get_symbol()) {
			this.left = replacement.copy();
		} else if (this.left.get_free_vars().has(variable.get_symbol())) {
			this.left.replace(variable, replacement);
		}
		this.left.set_parent(this);
		this.right.set_parent(this);
		this.reload_free_vars();
	}
	
	public reduce_child(is_right_child: boolean) : void {
		if (is_right_child && this.right instanceof Application) {
			this.right.reduce();
		} else if (!is_right_child && this.left instanceof Application) {
			this.left.reduce();
		}
	}

	public norm_ord_redex() : Application | null {
		let right = this.right.norm_ord_redex();
		if (right !== null) {
			return right;
		}
		let left = this.left.norm_ord_redex();
		return left;
	}

	public abstract replace_child(old_child: LambdaObject, new_child: LambdaObject) : void;

	public reload_free_vars() : void {
		let old_free_vars = this.free_vars;
		this.free_vars = new Set([...this.left.get_free_vars(), ...this.right.get_free_vars()]);
		if (!sets_eq(this.free_vars, old_free_vars) && this.parent !== null) {
			this.parent.reload_free_vars();
		}
	}
}

export class Lambda extends LambdaTree {
	public constructor(parameter: Variable, body: LambdaObject) {
		super(parameter, body);
		this.free_vars.delete(parameter.get_symbol());
	}

	public copy() : Lambda {
		let left = this.left.copy() as Variable;
		let right = this.right.copy();
		let lambda = new Lambda(left, right);
		left.set_parent(lambda as LambdaTree);
		right.set_parent(lambda as LambdaTree);
		return lambda;
	}

	public replace(variable: Variable, replacement: LambdaObject) : void {
		if (variable !== this.left) {
			let parameter = (this.left as Variable).get_symbol();
			if (replacement.get_free_vars().has(parameter)) {
				let new_parameter = parameter;
				do {
					new_parameter = `${new_parameter}'`;
				} while (replacement.get_free_vars().has(new_parameter));
				let old_variable = this.left as Variable;
				let new_variable = new Variable(new_parameter);
				this.left = new_variable;
				new_variable.set_parent(this);
				this.right.replace(old_variable, new_variable);
				this.reload_free_vars();
			}
			super.replace(variable, replacement);
		}
	}

	public call(replacement: LambdaObject) : LambdaObject {
		let result = this.right;
		this.right.replace(this.left as Variable, replacement);
		this.left = new Variable("");
		this.right = new Variable("");
		this.free_vars = new Set();
		return result;
	}

	public toString() : string {
		return `λ${this.left}.${this.right}`
	}

	public replace_child(old_body: LambdaObject, new_body: LambdaObject) : void {
		if (this.right === old_body) {
			this.right = new_body;
			new_body.set_parent(this);
		} else {
			throw new Error("old body was not found");
		}
	}

	public eq(other: LambdaObject, var_mapping: Record<string, string>) {
		if (!(other instanceof Lambda)) {
			return false;
		}

		let this_symbol = (this.left as Variable).get_symbol();
		let other_symbol = (other.left as Variable).get_symbol();
		if (!(this_symbol in var_mapping)) {
			var_mapping[this_symbol] = other_symbol;
		} else if (this_symbol !== other_symbol) {
			return false;
		}
		return this.right.eq(other.right, var_mapping);
	}
}

export class Application extends LambdaTree {
	public constructor(left: LambdaObject, right: LambdaObject) {
		super(left, right);
	}

	public copy() : Application {
		let left = this.left.copy();
		let right = this.right.copy();
		let application = new Application(left, right);
		left.set_parent(application);
		right.set_parent(application);
		return application;
	}

	public reduce() : LambdaObject {
		if (!(this.left instanceof Lambda)) {
			throw new Error("Attempted to reduce a non redux");
		}
		// console.log(`Old body ${this.left}`);
		let t_prime = this.left.call(this.right);
		// console.log(`new body ${t_prime}`);
		if (this.parent !== null) {
			this.parent.replace_child(this, t_prime);
			this.parent.reload_free_vars();
		}
		return t_prime;
	}

	public norm_ord_redex() : Application | null {
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

		let left;
		if (this.left instanceof Lambda) {
			left = `(${this.left})`;
		} else {
			left = String(this.left);
		}

		let right;
		if (this.right instanceof Application) {
			right = `(${this.right})`;
		} else {
			right = String(this.right);
		}
		return `${left} ${right}`;
	}

	public replace_child(old_child: LambdaObject, new_child: LambdaObject) : void {
		if (this.right === old_child) {
			this.right = new_child;
			new_child.set_parent(this);
		} else if (this.left === old_child) {
			this.left = new_child;
			new_child.set_parent(this);
		} else {
			throw new Error("old child was not found");
		}
	}
	
	public eq(other: LambdaObject, var_mapping: Record<string, string>) {
		if (!(other instanceof Application)) {
			return false;
		}
		return this.right.eq(other.right, var_mapping) && this.left.eq(other.left, var_mapping);
	}
}

export class Variable extends LambdaObject {
	protected symbol: string;

	public constructor(symbol: string) {
		super(new Set([symbol]));
		this.symbol = symbol;
	}

	public copy() : Variable {
		return new Variable(this.symbol);
	}

	public toString() : string {
		return this.symbol;
	}
	
	public norm_ord_redex() : Application | null {
		return null;
	}

	public replace(variable: Variable, replacement: LambdaObject) : void {}

	public get_symbol() : string {
		return this.symbol;
	}
	
	public eq(other: LambdaObject, var_mapping: Record<string, string>) {
		if (!(other instanceof Variable)) {
			return false;
		}
		if (this.symbol in var_mapping) {
			return var_mapping[this.symbol] === other.symbol;
		} else {
			var_mapping[this.symbol] = other.symbol;
			return true;
		}
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
		return `${String(this.variable)} = ${String(this.value)}`;
	}
}
