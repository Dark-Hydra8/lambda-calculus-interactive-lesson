let debug = false;

export function set_debug(value: boolean) : void {
	debug = value;
}

export class IndexRange {
	// Inclusive start, exclusive end
	public constructor(public start: number, public end: number) {}

	public toString() : string {
		return `[${this.start}, ${this.end})`;
	}
}

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

export function norm_ord_reduce(obj: LambdaObject) : LambdaObject | null {
	let redex = obj.norm_ord_redex();
	let result;
	if (redex === null) {
		result = null;
	} else if (redex === obj) {
		result = redex.reduce();
	} else {
		redex.reduce();
		result = obj;
	}
	return result;
}

export function all_variables(obj: LambdaObject): Set<string> {
	const variables = new Set<string>();
	
	const collect_variables = (node: LambdaObject): void => {
		if (node instanceof Variable) {
			variables.add(node.get_symbol());
		} else if (node instanceof Lambda) {
			// Add the parameter
			variables.add(node.get_parameter().get_symbol());
			// Recursively collect from the body
			collect_variables(node.get_body());
		} else if (node instanceof Application) {
			// Recursively collect from left and right
			collect_variables(node.get_left());
			collect_variables(node.get_right());
		} else {
			throw new Error(`Unknown node type: ${node}`);
		}
	};
	
	collect_variables(obj);
	return variables;
}

class VariableName {
	public name: number | string;

	public constructor(name: number | string) {
		this.name = name;
	}

	public eq(other: VariableName) : boolean {
		return this.name === other.name;
	}
}

export class Range {
	public start: number;
	public end: number;

	public constructor(start: number, end: number) {
		this.start = start;
		this.end = end;
	}
}

class VariableMapping {
	protected sym_to_name_left: Record<string, VariableName[]>;
	protected sym_to_name_right: Record<string, VariableName[]>;
	protected lambda_funcs: number;

	public constructor() {
		this.sym_to_name_left = {};
		this.sym_to_name_right = {};
		this.lambda_funcs = 0;
	}

	public ingest(left_symbol: string, right_symbol: string) : boolean {
		let left_names = this.sym_to_name_left[left_symbol];
		let right_names = this.sym_to_name_right[right_symbol];
		return left_names[left_names.length - 1].eq(right_names[right_names.length - 1]);
	}

	public enter_lambda(left_lambda: Lambda, right_lambda: Lambda) : void {
		let name = new VariableName(this.lambda_funcs);
		this.lambda_funcs++;

		let left_symbol = (left_lambda.get_left() as Variable).get_symbol();
		if (left_symbol in this.sym_to_name_left) {
			this.sym_to_name_left[left_symbol].push(name);
		} else {
			this.sym_to_name_left[left_symbol] = [name];
		}

		let right_symbol = (right_lambda.get_left() as Variable).get_symbol();
		if (right_symbol in this.sym_to_name_right) {
			this.sym_to_name_right[right_symbol].push(name);
		} else {
			this.sym_to_name_right[right_symbol] = [name];
		}
	}

	public exit_lambda(left_lambda: Lambda, right_lambda: Lambda) : void {
		let left_symbol = (left_lambda.get_left() as Variable).get_symbol();
		this.sym_to_name_left[left_symbol].pop();
		let right_symbol = (right_lambda.get_left() as Variable).get_symbol();
		this.sym_to_name_right[right_symbol].pop();
	}

	public same(left: string, right: string) : boolean {
		if (!(left in this.sym_to_name_left) || this.sym_to_name_left[left].length === 0) {
			this.sym_to_name_left[left] = [new VariableName(left)];
		}
		if (!(right in this.sym_to_name_right) || this.sym_to_name_right[right].length === 0) {
			this.sym_to_name_right[right] = [new VariableName(right)];
		}
		let left_names = this.sym_to_name_left[left];
		let right_names = this.sym_to_name_right[right];
		return left_names[left_names.length - 1].eq(right_names[right_names.length - 1]);
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

	public all_variables() : Variable[] {
		let variables = [];
		if (this instanceof Variable) {
			variables.push(this);
		} else if (this instanceof LambdaTree) {
			variables.push(...this.get_left().all_variables());
			variables.push(...this.get_right().all_variables());
		} else {
			throw new Error(`Unknown node type: ${this}`);
		}
		return variables;
	}

	public lambda_depth() : number {
		if (this.parent === null) {
			return 0;
		} else if (this.parent instanceof Lambda) {
			return this.parent.lambda_depth() + 1;
		} else {
			return this.parent.lambda_depth();
		}
	}

	public abstract copy() : LambdaObject;
	public abstract redexes() : Application[];
	public abstract redex_ranges() : Range[];
	public abstract norm_ord_redex() : Application | null;
	public abstract replace(variable: Variable, replacement: LambdaObject) : void;
	public abstract eq(other: LambdaObject, var_mapping: VariableMapping | null) : boolean;
	public abstract toString() : string;
	public abstract repr() : string;
	public abstract get_free_vars_list() : Variable[];
	public abstract refresh_free_vars() : void;
	public abstract alpha_rename(variable: Variable, param_free_vars: Set<string>) : void;
	public abstract object_ranges() : [IndexRange, LambdaObject][]; // Does not include spaces
}

export abstract class LambdaTree extends LambdaObject {
	protected left: LambdaObject;
	protected right: LambdaObject;
	
	public constructor(left: LambdaObject, right: LambdaObject) {
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

	public alpha_rename(variable: Variable, param_free_vars: Set<string>) : void {
		if (this.right.get_free_vars().has(variable.get_symbol())) {
			this.right.alpha_rename(variable, param_free_vars);
		}
		if (this.left.get_free_vars().has(variable.get_symbol())) {
			this.left.alpha_rename(variable, param_free_vars);
		}
		this.reload_free_vars();
	}
	
	public reduce_child(is_right_child: boolean) : void {
		if (is_right_child && this.right instanceof Application) {
			this.right.reduce();
		} else if (!is_right_child && this.left instanceof Application) {
			this.left.reduce();
		}
	}

	public redexes() : Application[] {
		let redexes = this.left.redexes();
		redexes.push(...this.right.redexes());
		return redexes;
	}

	public norm_ord_redex() : Application | null {
		let left = this.left.norm_ord_redex();
		if (left !== null) {
			return left;
		}
		let right = this.right.norm_ord_redex();
		return right;
	}

	public abstract replace_child(old_child: LambdaObject, new_child: LambdaObject) : void;

	public reload_free_vars() : void {
		let old_free_vars = this.free_vars;
		this.free_vars = new Set([...this.left.get_free_vars(), ...this.right.get_free_vars()]);
		if (!sets_eq(this.free_vars, old_free_vars) && this.parent !== null) {
			this.parent.reload_free_vars();
		}
	}

	public get_left() : LambdaObject {
		return this.left;
	}

	public get_right() : LambdaObject {
		return this.right;
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
		if (!variable.eq(this.left, null) && this.get_free_vars().has(variable.get_symbol())) {
			let parameter = (this.left as Variable).get_symbol();
			// alpha renaming
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

	public alpha_rename(variable: Variable, param_free_vars: Set<string>) : void {
		if (!variable.eq(this.left, null) && this.get_free_vars().has(variable.get_symbol())) {
			let parameter = (this.left as Variable).get_symbol();
			// alpha renaming
			if (param_free_vars.has(parameter)) {
				let new_parameter = parameter;
				do {
					new_parameter = `${new_parameter}'`;
				} while (param_free_vars.has(new_parameter));
				let old_variable = this.left as Variable;
				let new_variable = new Variable(new_parameter);
				this.left = new_variable;
				new_variable.set_parent(this);
				this.right.replace(old_variable, new_variable);
				this.reload_free_vars();
			}
			super.alpha_rename(variable, param_free_vars);
		}
	}

	public call(replacement: LambdaObject) : LambdaObject {
		let result;
		if (this.right instanceof Variable
		    && (this.right as Variable).get_symbol() === (this.left as Variable).get_symbol()) {
			result = replacement;
		} else {
			result = this.right;
			this.right.replace(this.left as Variable, replacement);
		}
		this.left = new Variable("");
		this.right = new Variable("");
		this.free_vars = new Set();
		return result;
	}

	public redex_ranges() : Range[] {
		const body = this.get_body();
		const start =
			String(this).replace(/\s/g, '').length - String(body).replace(/\s/g, '').length;
		const redexes: Range[] = [];
		for (let redex of body.redex_ranges()) {
			redexes.push(new Range(redex.start + start, redex.end + start));
		}
		return redexes;
	}

	public object_ranges() : [IndexRange, LambdaObject][] {
		let left_ranges = this.left.object_ranges();
		let right_ranges = this.right.object_ranges();
		let left_max_end = 0;
		let max_end = 0;
		for (let [range, _] of left_ranges) {
			range.start += 1; // +1 for the lambda
			range.end += 1;
			left_max_end = Math.max(left_max_end, range.end);
		}
		for (let [range, _] of right_ranges) {
			range.start += left_max_end + 1; // +1 for the space
			range.end += left_max_end + 1;
			max_end = Math.max(max_end, range.end);
		}
		let this_range = new IndexRange(0, max_end);
		if (debug) {
			console.log(`this: ${this} range: ${this_range}`);
		}
		return [[this_range, this], ...left_ranges, ...right_ranges];
	}

	public toString() : string {
		return `λ${this.left}.${this.right}`
	}

	public repr() : string {
		return `(λ${this.left.repr()}.${this.right.repr()})`;
	}

	public replace_child(old_body: LambdaObject, new_body: LambdaObject) : void {
		if (this.right === old_body) {
			this.right = new_body;
			new_body.set_parent(this);
		// } else {
		//	throw new Error("old body was not found");
		}
	}

	public eq(other: LambdaObject, var_mapping: VariableMapping | null) : boolean {
		if (!(other instanceof Lambda)) {
			return false;
		}
		if (var_mapping === null) {
			var_mapping = new VariableMapping();
		}

		var_mapping.enter_lambda(this, other);
		let result = this.right.eq(other.right, var_mapping);
		var_mapping.exit_lambda(this, other);
		return result;
	}

	public get_parameter() : Variable {
		return this.left as Variable;
	}

	public get_body() : LambdaObject {
		return this.right;
	}

	public get_free_vars_list() : Variable[] {
		let body_list = this.right.get_free_vars_list();
		body_list = body_list.filter(variable => variable.get_symbol() !== this.get_parameter().get_symbol());
		return body_list;
	}

	public refresh_free_vars() : void {
		this.free_vars = new Set([...this.get_body().get_free_vars()]);
		this.free_vars.delete(this.get_parameter().get_symbol());
		if (this.parent !== null) {
			this.parent.refresh_free_vars();
		}
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
		let t_prime = this.left.call(this.right);
		if (this.parent !== null) {
			this.parent.replace_child(this, t_prime);
			this.parent.reload_free_vars();
		}
		return t_prime;
	}

	public redexes() : Application[] {
		let redexes = this.left.redexes();
		if (this.left instanceof Lambda) {
			redexes.push(this);
		}
		redexes.push(...this.right.redexes());
		return redexes;
	}

	public redex_ranges() : Range[] {
		const pairs = this.object_ranges();
		const result: Range[] = [];
		for (const redex of this.redexes()) {
			const found = pairs.find(([, obj]) => obj === redex);
			if (found) {
				result.push(new Range(found[0].start, found[0].end));
			}
		}
		return result;
	}

	public norm_ord_redex() : Application | null {
		if (this.left instanceof Lambda) {
			return this;
		} else {
			return super.norm_ord_redex();
		}
	}

	public toString() : string {
		let left;
		if (this.left instanceof Lambda) {
			left = `(${this.left})`;
		} else {
			left = String(this.left);
		}

		let right;
		if (
			this.right instanceof Application
		    || (
				this.right instanceof Lambda
				&& this.parent instanceof Application
				&& this.parent.left === this
			)
		) {
			right = `(${this.right})`;
		} else {
			right = String(this.right);
		}
		return `${left} ${right}`;
	}

	public repr() : string {
		return `(${this.left.repr()} ${this.right.repr()})`;
	}

	public object_ranges() : [IndexRange, LambdaObject][] {
		let left_ranges = this.left.object_ranges();
		let right_ranges = this.right.object_ranges();
		let has_left_parans = this.left instanceof Lambda;
		let has_right_parans = this.right instanceof Application
		|| (
			this.right instanceof Lambda
			&& this.parent instanceof Application
			&& this.parent.left === this
		);

		let left_start;
		if (has_left_parans) {
			left_start = 1; // +1 for (
		} else {
			left_start = 0;
		}

		let left_max_end = 0;
		for (let [range, _] of left_ranges) {
			range.start += left_start; // +1 for the lambda
			range.end += left_start;
			left_max_end = Math.max(left_max_end, range.end);
		}

		let right_start = left_max_end;
		if (has_left_parans) {
			right_start++; // +1 for )
		}
		if (has_right_parans) {
			right_start++; // +1 for (
		}

		let max_end = 0;
		for (let [range, _] of right_ranges) {
			range.start += right_start;
			range.end += right_start;
			max_end = Math.max(max_end, range.end);
		}
		if (has_right_parans) {
			max_end++; // +1 for )
		}
		let this_range = new IndexRange(0, max_end);
		if (debug) {
			console.log(`this: ${this} range: ${this_range} has_left_parans: ${has_left_parans} has_right_parans: ${has_right_parans}\n` +
						`left_start: ${left_start} left_max_end: ${left_max_end} right_start: ${right_start} max_end: ${max_end}`);
		}
		return [[this_range, this], ...left_ranges, ...right_ranges];
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
	
	public eq(other: LambdaObject, var_mapping: VariableMapping | null) : boolean {
		if (!(other instanceof Application)) {
			return false;
		}
		if (var_mapping === null) {
			var_mapping = new VariableMapping();
		}
		return this.right.eq(other.right, var_mapping) && this.left.eq(other.left, var_mapping);
	}

	public get_free_vars_list() : Variable[] {
		return [...this.left.get_free_vars_list(), ...this.right.get_free_vars_list()];
	}

	public refresh_free_vars() : void {
		this.free_vars = new Set([...this.left.get_free_vars(), ...this.right.get_free_vars()]);
		if (this.parent !== null) {
			this.parent.refresh_free_vars();
		}
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

	public repr() : string {
		return this.symbol;
	}

	public object_ranges() : [IndexRange, LambdaObject][] {
		let this_range = new IndexRange(0, this.symbol.length);
		if (debug) {
			console.log(`this: ${this} range: ${this_range}`);
		}
		return [[this_range, this]];
	}
	
	public redexes() : Application[] {
		return [];
	}

	public redex_ranges() : Range[] {
		return [];
	}

	public norm_ord_redex() : Application | null {
		return null;
	}

	public replace(variable: Variable, replacement: LambdaObject) : void {}

	public alpha_rename(variable: Variable, param_free_vars: Set<string>) : void {}

	public get_symbol() : string {
		return this.symbol;
	}
	
	public eq(other: LambdaObject, var_mapping: VariableMapping | null) : boolean {
		if (!(other instanceof Variable)) {
			return false;
		}
		if (var_mapping === null) {
			var_mapping = new VariableMapping();
		}
		return var_mapping.same(this.get_symbol(), other.get_symbol());
	}

	public get_bound_lambda() : Lambda | null {
		let parent = this.get_parent();
		while (parent !== null) {
			if (parent instanceof Lambda && parent.get_parameter().get_symbol() === this.get_symbol()) {
				return parent;
			}
			parent = parent.get_parent();
		}
		return null;
	}

	public is_parameter() : boolean {
		let parent = this.get_parent();
		let is_parameter;
		if (parent instanceof Lambda) {
			is_parameter = parent.get_parameter() === this;
		} else {
			is_parameter = false;
		}
		return is_parameter;
	}

	public get_free_vars_list() : Variable[] {
		return [this];
	}

	public set_symbol(symbol: string) : void {
		this.symbol = symbol;
		this.refresh_free_vars();
	}
	
	public refresh_free_vars() : void {
		this.free_vars = new Set([this.get_symbol()]);
		if (this.parent !== null) {
			this.parent.refresh_free_vars();
		}
	}
}

export class Assignment {
	public name: Variable;
	public value: LambdaObject;

	public constructor(name: Variable, value: LambdaObject) {
		this.name = name;
		this.value = value;
	}

	public toString() : string {
		return `${String(this.name)} = ${String(this.value)}`;
	}

	public eq(other: Assignment, var_mapping: VariableMapping | null) : boolean {
		if (var_mapping === null) {
			var_mapping = new VariableMapping();
		}
		return this.name.eq(other.name, var_mapping) && this.value.eq(other.value, var_mapping);
	}
}
