import React from 'react';
import logo from './logo.svg';
import './App.css';
import { LambdaLexer, TokenType } from './lexer';
import { Parser } from './parser';
import { LambdaObject, Application } from './lambda_ir';


function App() {
	// console.log("start");
	// let lexer = new GenericLexer<string>("aabbabab", {"a": /a/y, "b": /b/y, "ab": /ab/y});
	// let lexer = new LambdaLexer("L x.(x x)");
	// lexer.print_tokens();
	/*
	for (let i = 0; i < 100; i++) {
		let token = lexer.pop();
		console.log(`token popped at ${i}: ${String(token)}`);
		// console.log(`token.is_type(TokenType.end_of_input) ${token.is_type(TokenType.end_of_input)}`);
		if (token.is_type(TokenType.end_of_input)) {
			break;
		}
	}
	lexer.print_tokens();
	 */
	let parser = new Parser("((L x.(x x) y)w)h");

	let result = parser.parse_input()
	// console.log("Parsing");
	// console.log(result);
	// console.log(String(result));

	let redex = (result[0] as LambdaObject).norm_ord_redex();
	// console.log("Normal order redex");
	// console.log(redex);
	// console.log(String(redex));

	let reduced = (redex as Application).reduce();
	// console.log("Reduced redex");
	// console.log(reduced);
	// console.log(String(reduced));

	// console.log("Over all structure redex");
	// console.log(result);
	// console.log(String(result));
	
	return (
		<div className="App">
			<header className="App-header">
				<img src={logo} className="App-logo" alt="logo" />
				<p>
					Edit <code>src/App.tsx</code> and save to reload.
				</p>
				<a
					className="App-link"
					href="https://reactjs.org"
					target="_blank"
					rel="noopener noreferrer"
				>
					Learn React
				</a>
			</header>
		</div>
	);
}

export default App;
