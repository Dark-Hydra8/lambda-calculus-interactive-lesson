let debug = false;

/** Enable or disable debug logging for range / layout tracing. */
export function set_debug(value: boolean) : void {
	debug = value;
}

/** Half-open character index interval in a rendered term string. */
export class IndexRange {
	/** @param start Inclusive start index. @param end Exclusive end index. */
	public constructor(public start: number, public end: number) {}

	/** Returns `[start, end)` as a string. */
	public toString() : string {
		return `[${this.start}, ${this.end})`;
	}
}

/** Returns true if two sets contain the same elements. */
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

/**
 * Performs one leftmost-outermost β-reduction step if a redex exists.
 * @returns The reduced term, or null if there is no redex.
 */
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

/**
 * Collects every variable name that appears free in the given term (by symbol string).
 */
export function all_variables(obj: LambdaObject): Set<string> {
	const variables = new Set<string>();
	
	/** Depth-first walk that records variable symbols under the usual scoping rules. */
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

/** De Bruijn-style or symbolic name used to compare bound variables across terms during alpha-equivalence checks. */
class VariableName {
	public name: number | string;

	/** @param name De Bruijn index or placeholder symbol string. */
	public constructor(name: number | string) {
		this.name = name;
	}

	/** True if this name matches `other` in the current binding context. */
	public eq(other: VariableName) : boolean {
		return this.name === other.name;
	}
}

/** Inclusive/exclusive index range (used for redex spans in the pretty-printed string). */
export class Range {
	public start: number;
	public end: number;

	/** @param start Inclusive start. @param end Exclusive end. */
	public constructor(start: number, end: number) {
		this.start = start;
		this.end = end;
	}
}

/**
 * Tracks bound-variable renamings when comparing two lambda bodies for alpha-equivalence:
 * stacks of `VariableName` per symbol for the left and right terms being compared.
 */
class VariableMapping {
	protected sym_to_name_left: Record<string, VariableName[]>;
	protected sym_to_name_right: Record<string, VariableName[]>;
	protected lambda_funcs: number;

	/** Empty mapping; `lambda_funcs` counts generated names for nested lambdas. */
	public constructor() {
		this.sym_to_name_left = {};
		this.sym_to_name_right = {};
		this.lambda_funcs = 0;
	}

	/** True if the current top bindings for the two symbols refer to the same `VariableName`. */
	public ingest(left_symbol: string, right_symbol: string) : boolean {
		let left_names = this.sym_to_name_left[left_symbol];
		let right_names = this.sym_to_name_right[right_symbol];
		return left_names[left_names.length - 1].eq(right_names[right_names.length - 1]);
	}

	/** Pushes a fresh binding pair when entering corresponding lambdas in both terms. */
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

	/** Pops the binding pair after finishing comparison of two lambda bodies. */
	public exit_lambda(left_lambda: Lambda, right_lambda: Lambda) : void {
		let left_symbol = (left_lambda.get_left() as Variable).get_symbol();
		this.sym_to_name_left[left_symbol].pop();
		let right_symbol = (right_lambda.get_left() as Variable).get_symbol();
		this.sym_to_name_right[right_symbol].pop();
	}

	/** True if the two symbols are considered the same under the current mapping (creating trivial stacks if needed). */
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

/**
 * Any node in the lambda-calculus AST: variables, applications, and abstractions.
 * Tracks free variables and an optional parent link up the binary tree.
 */
export abstract class LambdaObject {
	protected free_vars: Set<string>;
	protected parent: LambdaTree | null;

	/** @param free_vars Initial free-variable set for this node. */
	public constructor(free_vars: Set<string>) {
		this.free_vars = free_vars;
		this.parent = null;
	}

	/** Set of variable names that occur free in this subterm. */
	public get_free_vars() : Set<string> {
		return this.free_vars;
	}
	
	/** Attaches this node to its parent in the AST (or clears the link). */
	public set_parent(parent: LambdaTree | null) : void {
		this.parent = parent;
	}

	/** Containing application or lambda, if any. */
	public get_parent() : LambdaTree | null {
		return this.parent;
	}

	/** Nesting depth of lambda abstractions from the root (0 if no enclosing lambda). */
	public lambda_depth() : number {
		if (this.parent === null) {
			return 0;
		} else if (this.parent instanceof Lambda) {
			return this.parent.lambda_depth() + 1;
		} else {
			return this.parent.lambda_depth();
		}
	}

	/** Deep copy of this node and descendants. */
	public abstract copy() : LambdaObject;
	/** All β-redexes (applications whose left child is a lambda) in this subtree. */
	public abstract redexes() : Application[];
	/** Character ranges of redexes in the pretty-printed string for this subtree. */
	public abstract redex_ranges() : Range[];
	/** Leftmost-outermost redex in this subtree, if any. */
	public abstract norm_ord_redex() : Application | null;
	/** Substitutes `replacement` for free occurrences of `variable` (capture-avoiding where implemented). */
	public abstract replace(variable: Variable, replacement: LambdaObject) : void;
	/** Structural equality; `var_mapping` is used for alpha-equivalence across lambdas. */
	public abstract eq(other: LambdaObject, var_mapping: VariableMapping | null) : boolean;
	/** Human-readable term with minimal parentheses. */
	public abstract toString() : string;
	/** Fully parenthesized representation for debugging. */
	public abstract repr() : string;
	/** Lists free variables as `Variable` nodes (order used by UI / highlighting). */
	public abstract get_free_vars_list() : Variable[];
	/** Recomputes `free_vars` from children and propagates upward if needed. */
	public abstract refresh_free_vars() : void;
	/** Renames bound variables when they would capture names in `param_free_vars`. */
	public abstract alpha_rename(variable: Variable, param_free_vars: Set<string>) : void;
	/** Maps each subterm to a character index range in the string without spaces. */
	public abstract object_ranges() : [IndexRange, LambdaObject][]; // Does not include spaces
	/** All variable nodes in this subtree (for collection / search). */
	public abstract all_variables() : Variable[];
}

/** Binary internal node: either an application or a lambda (abstracted as left/right children). */
export abstract class LambdaTree extends LambdaObject {
	protected left: LambdaObject;
	protected right: LambdaObject;
	
	/** Builds a tree node; wires `parent` on both children. */
	public constructor(left: LambdaObject, right: LambdaObject) {
		let free_vars = new Set([...left.get_free_vars(), ...right.get_free_vars()]);
		super(free_vars);
		this.left = left;
		this.right = right;
		left.set_parent(this);
		right.set_parent(this);
	}

	/** Substitutes in left/right subtrees and refreshes parent links and free variables. */
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

	/** Pushes alpha-renames into subtrees when their free sets mention `variable`. */
	public alpha_rename(variable: Variable, param_free_vars: Set<string>) : void {
		if (this.right.get_free_vars().has(variable.get_symbol())) {
			this.right.alpha_rename(variable, param_free_vars);
		}
		if (this.left.get_free_vars().has(variable.get_symbol())) {
			this.left.alpha_rename(variable, param_free_vars);
		}
		this.reload_free_vars();
	}
	
	/** If the chosen side is an application, performs one reduction on that subterm. */
	public reduce_child(is_right_child: boolean) : void {
		if (is_right_child && this.right instanceof Application) {
			this.right.reduce();
		} else if (!is_right_child && this.left instanceof Application) {
			this.left.reduce();
		}
	}

	/** Union of redexes in the left and right subtrees. */
	public redexes() : Application[] {
		let redexes = this.left.redexes();
		redexes.push(...this.right.redexes());
		return redexes;
	}

	/** Leftmost-outermost redex: prefers left subtree, then right. */
	public norm_ord_redex() : Application | null {
		let left = this.left.norm_ord_redex();
		if (left !== null) {
			return left;
		}
		let right = this.right.norm_ord_redex();
		return right;
	}

	/** Replaces a direct child reference (used after β-reduction or similar rewrites). */
	public abstract replace_child(old_child: LambdaObject, new_child: LambdaObject) : void;

	/** Recomputes free variables from children and bubbles up if the set changes. */
	public reload_free_vars() : void {
		let old_free_vars = this.free_vars;
		this.free_vars = new Set([...this.left.get_free_vars(), ...this.right.get_free_vars()]);
		if (!sets_eq(this.free_vars, old_free_vars) && this.parent !== null) {
			this.parent.reload_free_vars();
		}
	}

	/** Left subtree (function or binder position for applications / lambdas). */
	public get_left() : LambdaObject {
		return this.left;
	}

	/** Right subtree (argument or body). */
	public get_right() : LambdaObject {
		return this.right;
	}

	/** All variables under this node, left then right. */
	public all_variables() : Variable[] {
		return [...this.get_left().all_variables(), ...this.get_right().all_variables()];
	}
}

/** Lambda abstraction: left child is the parameter (`Variable`), right child is the body. */
export class Lambda extends LambdaTree {
	/** @param parameter Bound variable (left). @param body Body term (right). */
	public constructor(parameter: Variable, body: LambdaObject) {
		super(parameter, body);
		this.free_vars.delete(parameter.get_symbol());
	}

	/** Deep copy preserving structure; re-parents copied parameter and body. */
	public copy() : Lambda {
		let left = this.left.copy() as Variable;
		let right = this.right.copy();
		let lambda = new Lambda(left, right);
		left.set_parent(lambda as LambdaTree);
		right.set_parent(lambda as LambdaTree);
		return lambda;
	}

	/** Substitution into body, with alpha-renaming the parameter when it would be captured. */
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

	/** Renames the bound parameter if it clashes with `param_free_vars`. */
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

	/**
	 * β-reduction of `(λx. M) N`: returns `M` with `x` replaced by `replacement`,
	 * and clears this node's children (call site is discarded after in-place parent replace).
	 */
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

	/** Redex spans inside the body, shifted to positions in the full `λx. M` string. */
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

	/** Index ranges without spaces for this lambda and nested subterms (offsets include `λ` and spacing). */
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

	/** Pretty-print: `λx.M` (no extra spaces). */
	public toString() : string {
		return `λ${this.left}.${this.right}`
	}

	/** Fully parenthesized `λ` form. */
	public repr() : string {
		return `(λ${this.left.repr()}.${this.right.repr()})`;
	}

	/** Replaces the body (right child) when reducing into this lambda. */
	public replace_child(old_body: LambdaObject, new_body: LambdaObject) : void {
		if (this.right === old_body) {
			this.right = new_body;
			new_body.set_parent(this);
		// } else {
		//	throw new Error("old body was not found");
		}
	}

	/** Alpha-equivalence: compares bodies under `enter_lambda` / `exit_lambda` mapping. */
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

	/** Bound parameter variable (left child). */
	public get_parameter() : Variable {
		return this.left as Variable;
	}

	/** Body term (right child). */
	public get_body() : LambdaObject {
		return this.right;
	}

	/** Free variables in the body excluding the bound parameter. */
	public get_free_vars_list() : Variable[] {
		let body_list = this.right.get_free_vars_list();
		body_list = body_list.filter(variable => variable.get_symbol() !== this.get_parameter().get_symbol());
		return body_list;
	}

	/** Rebuilds free set from body minus the parameter and notifies ancestors. */
	public refresh_free_vars() : void {
		this.free_vars = new Set([...this.get_body().get_free_vars()]);
		this.free_vars.delete(this.get_parameter().get_symbol());
		if (this.parent !== null) {
			this.parent.refresh_free_vars();
		}
	}
}

/** Application node: left is the function, right is the argument (`M N`). */
export class Application extends LambdaTree {
	/** @param left Function subterm. @param right Argument subterm. */
	public constructor(left: LambdaObject, right: LambdaObject) {
		super(left, right);
	}

	/** Deep copy with parent links on the new application. */
	public copy() : Application {
		let left = this.left.copy();
		let right = this.right.copy();
		let application = new Application(left, right);
		left.set_parent(application);
		right.set_parent(application);
		return application;
	}

	/**
	 * β-redex step: requires left to be a lambda; substitutes argument into body and splices result into the parent.
	 * @returns The reduced term (`t′`).
	 */
	public reduce() : LambdaObject {
		if (!(this.left instanceof Lambda)) {
			throw new Error("Attempted to reduce a non redex");
		}
		let t_prime = this.left.call(this.right);
		if (this.parent !== null) {
			this.parent.replace_child(this, t_prime);
			this.parent.reload_free_vars();
		}
		return t_prime;
	}

	/** This node if it is a redex, plus redexes from left and right (left-first order). */
	public redexes() : Application[] {
		let redexes = this.left.redexes();
		if (this.left instanceof Lambda) {
			redexes.push(this);
		}
		redexes.push(...this.right.redexes());
		return redexes;
	}

	/** Character ranges for each redex in this application’s pretty-printed form. */
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

	/** If this application is a redex (`(λx.M) N`), returns this; else defers to children. */
	public norm_ord_redex() : Application | null {
		if (this.left instanceof Lambda) {
			return this;
		} else {
			return super.norm_ord_redex();
		}
	}

	/** Pretty-print with parentheses for left lambda and right when associativity requires. */
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

	/** Fully parenthesized `(M N)`. */
	public repr() : string {
		return `(${this.left.repr()} ${this.right.repr()})`;
	}

	/** Index ranges without spaces, accounting for optional parentheses around left/right. */
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

	/** Updates left or right child after reduction or rewrite. */
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
	
	/** Structural equality: compares left and right subterms under the same mapping. */
	public eq(other: LambdaObject, var_mapping: VariableMapping | null) : boolean {
		if (!(other instanceof Application)) {
			return false;
		}
		if (var_mapping === null) {
			var_mapping = new VariableMapping();
		}
		return this.right.eq(other.right, var_mapping) && this.left.eq(other.left, var_mapping);
	}

	/** Free variables from left then right. */
	public get_free_vars_list() : Variable[] {
		return [...this.left.get_free_vars_list(), ...this.right.get_free_vars_list()];
	}

	/** Union of free vars from both sides; propagates to parent if linked. */
	public refresh_free_vars() : void {
		this.free_vars = new Set([...this.left.get_free_vars(), ...this.right.get_free_vars()]);
		if (this.parent !== null) {
			this.parent.refresh_free_vars();
		}
	}
}

/** Leaf variable (name token). */
export class Variable extends LambdaObject {
	protected symbol: string;

	/** @param symbol Source-level variable name. */
	public constructor(symbol: string) {
		super(new Set([symbol]));
		this.symbol = symbol;
	}

	/** Fresh variable with the same symbol. */
	public copy() : Variable {
		return new Variable(this.symbol);
	}

	/** The bare symbol string. */
	public toString() : string {
		return this.symbol;
	}

	/** Same as {@link toString} for variables. */
	public repr() : string {
		return this.symbol;
	}

	/** Span covering this symbol in the no-space rendering. */
	public object_ranges() : [IndexRange, LambdaObject][] {
		let this_range = new IndexRange(0, this.symbol.length);
		if (debug) {
			console.log(`this: ${this} range: ${this_range}`);
		}
		return [[this_range, this]];
	}
	
	/** Variables contain no redexes. */
	public redexes() : Application[] {
		return [];
	}

	/** No redex ranges inside a bare variable. */
	public redex_ranges() : Range[] {
		return [];
	}

	/** Variables are never redexes. */
	public norm_ord_redex() : Application | null {
		return null;
	}

	/** No-op: substitution for variables is handled at enclosing tree nodes. */
	public replace(variable: Variable, replacement: LambdaObject) : void {}

	/** No-op at leaves. */
	public alpha_rename(variable: Variable, param_free_vars: Set<string>) : void {}

	/** This variable’s name as it appears in the term. */
	public get_symbol() : string {
		return this.symbol;
	}
	
	/** Same symbol or mapped equivalent under `VariableMapping.same`. */
	public eq(other: LambdaObject, var_mapping: VariableMapping | null) : boolean {
		if (!(other instanceof Variable)) {
			return false;
		}
		if (var_mapping === null) {
			var_mapping = new VariableMapping();
		}
		return var_mapping.same(this.get_symbol(), other.get_symbol());
	}

	/** Walks parents to the innermost lambda that binds this symbol, if any. */
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

	/** True if this node is the parameter of its immediate parent lambda. */
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

	/** Singleton list: this variable if it is free at this node (always here). */
	public get_free_vars_list() : Variable[] {
		return [this];
	}

	/** Renames the symbol and recomputes free-variable sets up the tree. */
	public set_symbol(symbol: string) : void {
		this.symbol = symbol;
		this.refresh_free_vars();
	}
	
	/** Free set is `{symbol}`; notifies parent. */
	public refresh_free_vars() : void {
		this.free_vars = new Set([this.get_symbol()]);
		if (this.parent !== null) {
			this.parent.refresh_free_vars();
		}
	}

	/** Singleton list containing this variable. */
	public all_variables() : Variable[] {
		return [this];
	}
}

/** Top-level assignment binding (e.g. for lesson environment). */
export class Assignment {
	public name: Variable;
	public value: LambdaObject;

	/** @param name Bound name. @param value Right-hand side term. */
	public constructor(name: Variable, value: LambdaObject) {
		this.name = name;
		this.value = value;
	}

	/** `name = value` as a string. */
	public toString() : string {
		return `${String(this.name)} = ${String(this.value)}`;
	}

	/** True if name and value match structurally under `var_mapping`. */
	public eq(other: Assignment, var_mapping: VariableMapping | null) : boolean {
		if (var_mapping === null) {
			var_mapping = new VariableMapping();
		}
		return this.name.eq(other.name, var_mapping) && this.value.eq(other.value, var_mapping);
	}
}
