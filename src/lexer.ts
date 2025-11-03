class GenericSyntaxError<TokenTypeType> extends Error {
	protected found: TokenTypeType | null;
	protected expected: (TokenTypeType | null)[]; 

	public constructor(found: TokenTypeType | null, expected: (TokenTypeType | null)[], message: string | null = null) {
		if (message === null) {
			let found_str;
			if (found === null) {
				found_str = "end of input";
			} else {
				found_str = String(found);
			}
			message = `Syntax error: found ${found_str}, but expected one of ${expected}`;
		}
		super(message);
		this.name = "GenericSyntaxError";
		this.found = found;
		this.expected = expected;
	}

	public get_found() : TokenTypeType | null {
		return this.found;
	}
	
	public get_expected() : (TokenTypeType | null)[] {
		return this.expected;
	}
}

class GenericLexerError extends Error {
	protected malformed_str: string;
	protected index: number;
	
	public constructor(malformed_str: string, index: number, message: string | null = null) {
		if (message === null) {
			message = `Could not lex this string: "${malformed_str}"`;
		}
		super(message);
		this.name = "GenericLexerError";
		this.malformed_str = malformed_str;
		this.index = index;
	}
}


function next_lexeme(str: string, regex: RegExp, start: number) : string | null {
	regex.lastIndex = start;
	let result: RegExpMatchArray | string | null = str.match(regex);
	if (result === null) {
		return null;
	} else {
		return result[0];
	}
}


export class GenericToken<TokenTypeType extends string | number | symbol> {
	public token_type: TokenTypeType;
	public lexeme: string;

	public constructor(token_type: TokenTypeType, lexeme: string) {
		this.token_type = token_type;
		this.lexeme = lexeme;
	}

	public is_type(token_type: TokenTypeType) : boolean {
		return this.token_type === token_type;
	}

	public toString() : string {
		return `GenericToken(${String(this.token_type)}, ${this.lexeme})`
	}
}

export class GenericLexer<TokenTypeType extends string | number | symbol> {
	protected token_index: number;
	protected str_index: number;
	protected str: string;
	protected token_types: Record<TokenTypeType, RegExp>;
	protected tokens: GenericToken<TokenTypeType>[];

	public constructor(str: string, token_types: Record<TokenTypeType, RegExp>) {
		this.str = str;
		this.token_index = 0;
		this.str_index = 0;
		this.token_types = token_types;
		this.tokens = [];
	}

	private lex_token() : GenericToken<TokenTypeType> | null {
		// console.log(`this.str_start ${this.str_index}`);
		let max_token = null;

		if (this.str.length <= this.str_index) {
			return null;
		}
			
		for (let token_type in this.token_types) {
			let lexeme = next_lexeme(this.str, this.token_types[token_type], this.str_index);
			if (lexeme !== null && (max_token === null
			    || (lexeme !== null && lexeme.length > max_token.lexeme.length))) {
				max_token = new GenericToken<TokenTypeType>(token_type, lexeme);
			}
		}
		if (max_token === null) {
			throw new GenericLexerError(this.str.substring(this.str_index, 30 + this.str_index), this.str_index);
		}

		this.tokens.push(max_token);
		// console.log(`${this.str_index} += ${max_token.lexeme.length} (${max_token})`);
		this.str_index += max_token.lexeme.length;

		return max_token;
	}

	public pop() : GenericToken<TokenTypeType> | null {
		let token = this.peek();
		if (token !== null) {
			this.token_index++;
		}
		return token;
	}
	
	public peek(token_index: number = 0) : GenericToken<TokenTypeType> | null {
		token_index += this.token_index;
		while (this.tokens.length <= token_index && this.lex_token() !== null) {}
		if (this.tokens.length <= token_index) {
			return null;
		} else {
			// console.log(`Accessing tokens at ${token_index} ${this.tokens}`);
			return this.tokens[token_index];
		}
	}

	public expect(token_type: TokenTypeType | null) : GenericToken<TokenTypeType> | null {
		let token = this.pop();
		let popped_type: TokenTypeType | null;
		if (token === null) {
			popped_type = null;
		} else {
			popped_type = token.token_type;
		}
		if (popped_type !== token_type) {
			throw new GenericSyntaxError<TokenTypeType>(popped_type, [token_type]);
		}
		return token;
	}

	public type_next(token_type: TokenTypeType, index: number = 0) : boolean {
		let token = this.peek(index);
		if (token === null) {
			return false;
		} else {
			return token.is_type(token_type);
		}
	}
}

export class LambdaSyntaxError extends GenericSyntaxError<TokenType> {
	protected line_number: number;

	public constructor(found: TokenType, expected: TokenType[], line_number: number, message: string | null = null) {
		if (message === null) {
			message = `Syntax error: found ${found}, but expected one of ${expected} on line ${line_number}`;
		}
		super(found, expected, message);
		this.name = "LambdaSyntaxError";
		this.line_number = line_number;
	}

	public static from_generic_syntax_error(error: GenericSyntaxError<TokenType>, line_number: number, message: string | null = null) : LambdaSyntaxError {
		let found = error.get_found();
		if (found === null) {
			found = TokenType.end_of_input;
		}
		let expected = [];
		for (let exp of error.get_expected()) {
			if (exp === null) {
				exp = TokenType.end_of_input;
			}
			expected.push(exp);
		}

		return new LambdaSyntaxError(found, expected, line_number, message);
	}

	public get_line_number() : number {
		return this.line_number;
	}
}

export class LambdaLexerError extends GenericLexerError {
	public constructor(malformed_str: string, index: number, message: string | null = null) {
		if (message === null) {
			message = `Could not lex this string: "${malformed_str}"`;
		}
		super(malformed_str, index, message);
		this.name = "LambdaLexerError";
	}
}

export enum TokenType {
	lambda = "lambda",
	dot = "dot",
	lparen = "lparen",
	rparen = "rparen",
	equals = "=",
	variable = "variable",
	whitespace = "white_space",
	new_line = "new_line",
	end_of_input = "end_of_input",
	number = "number"
}

export class LambdaToken extends GenericToken<TokenType> {
	protected line_number: number;

	public constructor(token_type: TokenType, lexeme: string, line_number: number) {
		super(token_type, lexeme);
		this.line_number = line_number;
	}

	public static from_generic_token(token: GenericToken<TokenType>, line_number: number) : LambdaToken {
		return new LambdaToken(token.token_type, token.lexeme, line_number);
	}

	public get_line_number() : number {
		return this.line_number;
	}
}

export class LambdaLexer extends GenericLexer<TokenType> {
	protected current_line_number: number;

	public constructor(str: string) {
		super(
			str,
			{
				[TokenType.lambda]: /L|λ/y,
				[TokenType.dot]: /\./y,
				[TokenType.lparen]: /\(/y,
				[TokenType.rparen]: /\)/y,
				[TokenType.equals]: /=/y,
				[TokenType.variable]: /[a-zA-Z][a-zA-Z_0-9]*/y,
				[TokenType.whitespace]: /[ \t]+/y,
				[TokenType.new_line]: /\n/y,
				[TokenType.number]: /([1-9][0-9]*)|0/y,
				[TokenType.end_of_input]: /a^/y
			}
		);
		this.current_line_number = 1;
		/*
		let new_tokens: LambdaToken[] = [];
		let current_line_number = 1;
		for (let i = 0; i < this.tokens.length; i++) {
			let token = this.tokens[i];
			if (token.is_type(TokenType.new_line)) {
				current_line_number++;
			}
			if (!token.is_type(TokenType.whitespace)) {
				token.set_line_number(current_line_number);
				new_tokens.push(token);
			}
		}
		this.tokens = new_tokens;
	         */
	}

	private peek_with_index(token_index: number = 0) : {token: LambdaToken, token_index: number} {
		let super_index = 0;
		let this_index = 0;
		let line_number = this.current_line_number;
		while (true) {
			let token = super.peek(super_index);
			if (token === null) {
				return {token: new LambdaToken(TokenType.end_of_input, "", line_number), token_index: super_index};
			}
			if (token.is_type(TokenType.new_line)) {
				line_number++;
			}
			if (token.is_type(TokenType.whitespace)) {
				super_index++;
			} else if (this_index < token_index) {
				this_index++;
				super_index++;
			} else {
				// console.log(`this_index=${this_index} super_index=${super_index} token=${token}`);
				return {
					token: LambdaToken.from_generic_token(token, line_number),
					token_index: super_index,
				};
			}
		}
	}

	public peek(token_index: number = 0) : LambdaToken {
		return this.peek_with_index(token_index).token;
	}

	public pop() : LambdaToken {
		let result = this.peek_with_index();
		this.token_index += result.token_index + 1;
		this.current_line_number = result.token.get_line_number();
		return result.token;
	}

	public get_current_line_number() : number {
		return this.current_line_number;
	}

	public expect(token_type: TokenType) : LambdaToken {
		let token;
		try {
			token = super.expect(token_type);
		} catch (error) {
			if (error instanceof GenericSyntaxError<TokenType>) {
				throw LambdaSyntaxError.from_generic_syntax_error(error, this.current_line_number);
			} else {
				throw error;
			}
		}
		let new_token;
		if (token === null) {
			new_token = new LambdaToken(TokenType.end_of_input, "", this.current_line_number);
		} else {
			new_token = LambdaToken.from_generic_token(token, this.current_line_number);
		}
		return new_token;
	}
}


/*
let lexer = new GenericLexer(
	"aabbabab",
	{
		"a": /a/y,
		"b": /b/y
	});
 */
// lexer.print_tokens();

