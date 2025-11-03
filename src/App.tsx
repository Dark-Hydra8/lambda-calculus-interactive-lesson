import React, { useState } from 'react';
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
	// let parser = new Parser("((L x.(x x) y)w)h");

	// let result = parser.parse_input()
	// console.log("Parsing");
	// console.log(result);
	// console.log(String(result));

	// let redex = (result[0] as LambdaObject).norm_ord_redex();
	// console.log("Normal order redex");
	// console.log(redex);
	// console.log(String(redex));

	// let reduced = (redex as Application).reduce();
	// console.log("Reduced redex");
	// console.log(reduced);
	// console.log(String(reduced));

	// console.log("Over all structure redex");
	// console.log(result);
	// console.log(String(result));
	
	function trace_resolution(input: string): string[] {
		let parser = new Parser(input);
		let lambda_obj = parser.parse_input()[0] as LambdaObject;
		let lines = [String(lambda_obj)];
		let redex = lambda_obj.norm_ord_redex();
		for (let i = 0; i < 10_000 && redex !== null; i++) {
			if (redex === lambda_obj) {
				lambda_obj = redex.reduce();
			} else {
				redex.reduce()
			}
			lines.push(String(lambda_obj));
			redex = lambda_obj.norm_ord_redex();
		}
		if (redex !== null) {
			lines.push("Max iterations reached");
		}
		return lines.map((expr, index) => `${index + 1}. ${expr}`);
	}
	
	const [input, setInput] = useState('');
	const [outputLines, setOutputLines] = useState<string[]>([]);

	const handleProcess = () => {
		const result = trace_resolution(input);
		setOutputLines(result);
	};

	return (
		<div style={{ padding: '2rem', fontFamily: 'Arial' }}>
			<h2>Enter your lambda expression</h2>
			<input
				type="text"
				value={input}
				onChange={(e) => setInput(e.target.value)}
				placeholder="Enter lambda expression here"
				style={{ width: '300px', padding: '0.5rem' }}
			/>
			<button onClick={handleProcess} style={{ marginLeft: '1rem', padding: '0.5rem' }}>
				Process
			</button>
			<div style={{ marginTop: '2rem' }}>
				{outputLines.map((line, index) => (
					<div key={index}>{line}</div>
				))}
			</div>
		</div>
	);
}

export default App;
