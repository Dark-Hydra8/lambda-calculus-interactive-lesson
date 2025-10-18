import React from 'react';
import logo from './logo.svg';
import './App.css';
import { LambdaLexer } from './lexer';
import { Parser } from './parser';


function App() {
  console.log("start");
  // let lexer = new GenericLexer<string>("aabbabab", {"a": /a/y, "b": /b/y, "ab": /ab/y});
  // let lexer = new LambdaLexer("L x.(x x)");
  // lexer.print_tokens();
  test("test", undefined);
  // let parser = new Parser("L x.(x x) y");
  // console.log(parser.parse_input());
  // console.log(String(parser.parse_input()));
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
