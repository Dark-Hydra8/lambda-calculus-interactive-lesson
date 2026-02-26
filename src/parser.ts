import { LambdaLexer, TokenType, LambdaToken, LambdaSyntaxError } from './lexer';
import { Lambda, Variable, Application, LambdaObject, Assignment } from './lambda_ir';

// Used during testing
// function assert(value: boolean) : asserts value {}

export class Parser {
	private lexer: LambdaLexer;

	public constructor(input: string) {
		this.lexer = new LambdaLexer(input);
	}

	public parse_input() : (LambdaObject | Assignment)[] {
		// console.log("parse_input");
		// lines end_of_input | new_lines lines end_of_input 
		if (this.type_next(TokenType.new_line)) {
			this.parse_new_lines();
		}
		let objects = this.parse_lines();
		if (this.type_next(TokenType.new_line)) {
			this.parse_new_lines();
		}
		// console.log("return parse_input");
		this.expect(TokenType.end_of_input);
		return objects;
	}

	public parse_lines(objects: (LambdaObject | Assignment)[] = []) : (LambdaObject | Assignment)[] {
		// console.log("parse_lines");
		// line lines | line
		let obj = this.parse_line();
		objects.push(obj);
		if (!this.type_next(TokenType.end_of_input)) {
			this.parse_lines(objects)
		}
		// console.log("return parse_lines");
		return objects;
	}

	public parse_line() : LambdaObject | Assignment {
		// console.log("parse_line");
		// assignment | expression | assignment new_lines | expression new_lines
		let line;
		if (this.type_next(TokenType.variable) && this.peek(1).is_type(TokenType.equals)) {
			line = this.parse_assignment();
		} else {
			line = this.parse_expression() as LambdaObject;
		}
		if (this.type_next(TokenType.new_line)) {
			this.parse_new_lines();
		}
		// console.log("return parse_line");
		return line;
	}
	
	public parse_assignment() : Assignment {
		// console.log("parse_assignment");
		// variable = application
		let variable = this.parse_variable();
		this.expect(TokenType.equals);
		let value = this.parse_expression() as LambdaObject;
		// console.log("return parse_assignment");
		return new Assignment(variable, value);
	}

	public parse_expression(exprs: LambdaObject[] = []) : LambdaObject | null {
		// console.log("parse_expression");
		// term | term expression
		let is_root = exprs.length === 0;
		exprs.push(this.parse_term());
		let token = this.peek();
		if (token.is_type(TokenType.variable)
		   	|| token.is_type(TokenType.number)
		   	|| token.is_type(TokenType.lparen)
		   	|| token.is_type(TokenType.lambda)) {
			this.parse_expression(exprs);
		}
		// console.log("return parse_expression");
		if (is_root) {
			let expr = exprs[0];
			for (let i = 1; i < exprs.length; i++) {
				expr = new Application(expr, exprs[i]);
			}
			return expr;
		}
		return null;
	}

	public parse_term() : LambdaObject {
		// console.log("parse_term");
		// function | ( expression ) | variable | number
		let term;
		switch (this.peek().token_type) {
			case TokenType.lambda: {
				term = this.parse_function();
				break;
			}
			case TokenType.lparen: {
				this.expect(TokenType.lparen);
				term = this.parse_expression() as LambdaObject;
				this.expect(TokenType.rparen);
				break;
			}
			case TokenType.variable: {
				term = this.parse_variable();
				break;
			}
			case TokenType.number: {
				term = this.parse_number();
				break;
			}
			default: {
				throw new LambdaSyntaxError(
					this.peek().token_type,
					[
						TokenType.lambda,
						TokenType.lparen,
						TokenType.variable,
						TokenType.number
					],
					this.peek().get_line_number()
				);
			}
		}
		// console.log("return parse_term");
		return term;
	}

	public parse_variable() : Variable {
		// console.log("parse_variable");
		// variable
		let lexeme = this.expect(TokenType.variable).lexeme;
		let variable = new Variable(lexeme);
		// console.log("return parse_variable");
		return variable;
	}

	public parse_function() : Lambda {
		// console.log("parse_function");
		// lambda variable . expression
		this.expect(TokenType.lambda);
		let parameter = this.parse_variable();
		this.expect(TokenType.dot);
		let body = this.parse_expression() as LambdaObject;
		// console.log("return parse_function");
		return new Lambda(parameter, body);
	}

	public parse_new_lines() : void {
		// console.log("parse_new_lines");
		this.expect(TokenType.new_line);
		if (this.peek().is_type(TokenType.new_line)) {
			this.parse_new_lines();
		}
		// console.log("return parse_new_lines");
	}

	public parse_number() : Lambda {
		// console.log("parse_number");
		let num = parseInt(this.expect(TokenType.number).lexeme);
		// console.log("return parse_number");
		return load_number(num);
	}

	private expect(token_type: TokenType) : LambdaToken {
		let token = this.lexer.expect(token_type);
		// console.log(`expect result ${token}`);
		return token;
	}

	private peek(token_index: number = 0) : LambdaToken {
		let token = this.lexer.peek(token_index);
		// console.log(`peek result ${token}`);
		return token;
	}
	
	public pop() : LambdaToken {
		let token = this.lexer.pop();
		// console.log(`pop result ${token}`);
		return token;
	}

	public type_next(token_type: TokenType) : boolean {
		return this.lexer.type_next(token_type);
	}
}

function load_number(num: number) : Lambda {
	let n: Variable | Application = new Variable("s");
	for (let i = 0; i < num; i++) {
		n = new Application(new Variable("t"), n);
	}
	return new Lambda(new Variable("t"), new Lambda(new Variable("s"), n));
}
