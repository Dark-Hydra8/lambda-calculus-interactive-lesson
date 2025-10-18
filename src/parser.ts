import { LambdaLexer, TokenType, LambdaSyntaxError } from './lexer';
import { Lambda, Variable, Application, LambdaObject, Assignment } from './lambda_ir';

function assert(value: boolean) : asserts value {}

export class Parser {
	private lexer: LambdaLexer;
	private variables: Record<string, Variable>;

	public constructor(input: str) {
		this.lexer = new LambdaLexer(input);
		this.variables = {};
	}

	public parse_input() : Lambda[] {
		console.log("parse_input");
		// lines end_of_input | lines new_lines end_of_input 
		let objects = this.parse_lines();
		if (this.type_next(TokenType.new_line)) {
			this.parse_new_line();
		}
		console.log("return parse_input");
		this.expect(TokenType.end_of_input);
		return objects;
	}

	public parse_lines(objects: Lambda[] = []) : (Assignment | LambdaObj)[] {
		console.log("parse_lines");
		// line new_line lines | line
		let obj = this.parse_line();
		objects.push(obj);
		if (this.type_next(TokenType.new_line)) {
			this.parse_new_line(objects);
		} else if (!this.type_next(TokenType.end_of_input)) {
			throw new LambdaSyntaxError(
				this.peek().token_type,
				[TokenType.end_of_input, TokenType.new_line]
			);
		}
		console.log("return parse_lines");
		return objects;
	}

	public parse_line() : Assignment | LambdaObj {
		console.log("parse_line");
		// assignment | expression
		let line;
		if (this.type_next(TokenType.Variable) && this.type_next(TokenType.equals)) {
			line = this.parse_assignment();
		} else {
			line = this.parse_expression();
		}
		console.log("return parse_line");
		return line;
	}
	
	public parse_assignment() : Assignment {
		console.log("parse_assignment");
		// variable = application
		let varable = this.parse_variable();
		this.expect(TokenType.equals);
		let value = this.parse_lambda_obj();
		console.log("return parse_assignment");
		return new Assignment(variable, value);
	}

	public parse_expression() : LambdaObject {
		console.log("parse_expression");
		// term | term expression
		let expression: LambdaObject = this.parse_term();
		assert(expression === undefined);
		assert(expression !== undefined);
		let token = this.peek();
		if (token.is_type(TokenType.variable)
		   	|| token.is_type(TokenType.number)
		   	|| token.is_type(TokenType.lparen)) {
			expression = new Application(expression, this.parse_expression());
		}
		console.log("return parse_expression");
		return expression;
	}

	public parse_term() : LambdaObject {
		console.log("parse_term");
		// function | ( expression ) | variable | number
		let term;
		switch (this.peek().token_type) {
			case TokenType.lambda: {
				term = this.parse_function();
				break;
			}
			case TokenType.lparen: {
				this.expect(TokenType.lparen);
				term = this.parse_expression();
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
					this.peek().line_number
				);
			}
		}
		console.log("return parse_term");
		return term;
	}

	public parse_variable() : Variable {
		console.log("parse_variable");
		// variable
		let lexeme = this.expect(TokenType.variable).lexeme;
		let variable;
		if (lexeme in this.variables) {
			variable = this.variables[lexeme];
		} else {
			variable = this.variables[lexeme] = new Variable(lexeme);
		}
		console.log("return parse_variable");
	}

	public parse_function() : Lambda {
		console.log("parse_function");
		// lambda variable . expression
		this.expect(TokenType.lambda);
		let parameter = this.parse_variable();
		this.expect(TokenType.dot);
		let body = this.parse_expression();
		console.log("return parse_function");
		return new Lambda(parameter, body);
	}

	public parse_new_lines() : void {
		console.log("parse_new_lines");
		token = this.expect(TokenType.new_line);
		if (this.peek().is_type(TokenType.new_line)) {
			this.parse_new_lines();
		}
		console.log("return parse_new_lines");
	}

	public parse_number() : Lambda {
		console.log("parse_number");
		// number
		throw new Error("parse_number not implemented");
	}

	private expect(token_type: TokenType) : void {
		let token = this.lexer.expect(token_type);
		console.log(`expect result ${token}`);
		return token;
	}

	private peek(token_index: number = 0) : Token<TokenType> {
		let token = this.lexer.peek(token_index);
		console.log(`peek result ${token}`);
		return token;
	}
	
	public pop() : Token<TokenType> {
		let token = this.lexer.pop();
		console.log(`pop result ${token}`);
		return token;
	}

	public type_next(token_type: Token<TokenType>) : boolean {
		return this.lexer.type_next(token_type);
	}
}

