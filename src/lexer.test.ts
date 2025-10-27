import { LambdaLexer, GenericLexer, GenericToken } from './lexer';


test("test the peek, pop, expect functions of GenericLexer", () => {
	let token_types: Record<string, RegExp> = {};
	for (let i = 0; i < 3; i++) {
		token_types[`${i} type`] = RegExp(String(i), "y");
		token_types[`${i}2 type`] = RegExp(`${i}2`, "y");
	}
	let string = "";
	for (let i = 0; i < 100; i++) {
		let chr = Math.floor(Math.random() * 3);
		string += String(chr);
	}
	let expected_tokens = [];
	let token_index = 0;
	while (token_index < string.length) {
		if (token_index + 1 < string.length && string[token_index + 1] == "2") {
			expected_tokens.push(new GenericToken<string>(`${string[token_index]}2 type`, `${string[token_index]}2`));
			token_index += 2;
		} else {
			expected_tokens.push(new GenericToken<string>(`${string[token_index]} type`, `${string[token_index]}`));
			token_index++;
		}
	}

	let lexer = new GenericLexer<string>(string, token_types);
	token_index = 0;
	while (token_index < expected_tokens.length) {
		switch (Math.floor(Math.random() * 3)) {
			case 0: { // pop
				let token = lexer.pop() as GenericToken<string>;
				expect(token.lexeme).toEqual(expected_tokens[token_index].lexeme);
				expect(token.token_type).toEqual(expected_tokens[token_index].token_type);
				token_index++;
				break;
			}
			case 1: { // peek
				let token = lexer.peek() as GenericToken<string>;
				expect(token.lexeme).toEqual(expected_tokens[token_index].lexeme);
				expect(token.token_type).toEqual(expected_tokens[token_index].token_type);
				break;
			}
			case 2: { // expect
				let token = lexer.expect(expected_tokens[token_index].token_type);
				expect(token.lexeme).toEqual(expected_tokens[token_index].lexeme);
				expect(token.token_type).toEqual(expected_tokens[token_index].token_type);
				token_index++;
				break;
			}
		}
	}
});
