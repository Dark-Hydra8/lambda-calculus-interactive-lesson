import React, { useState } from 'react';
import './styles.css';
import { LambdaObject, Variable, Application, Lambda } from './lambda_ir';
import { Parser } from './parser';
import { random_lambda } from './random_lambda';

type Question = {
  question: LambdaObject;
  questionStr: string;
  answer: LambdaObject;
  answerStr: string;
};

type Response = {
  lambdaExpr: LambdaObject;
  lambdaExprStr: string;
  userAnswer: LambdaObject;
  userAnswerStr: string;
  correctAnswer: LambdaObject;
  correctAnswerStr: string;
  isCorrect: boolean;
  showCorrectAnswer: boolean;
};

function has_variable(obj: LambdaObject, vari: Variable) : boolean {
  if (obj instanceof Variable) {
    return obj.get_symbol() === vari.get_symbol();
  } else if (obj instanceof Application) {
    return has_variable(obj.get_left(), vari) || has_variable(obj.get_right(), vari);
  } else if (obj instanceof Lambda) {
    return obj.get_parameter().get_symbol() !== vari.get_symbol() && has_variable(obj.get_body(), vari);
  }
  return false;
}

function count_redexes(obj: LambdaObject) : number {
  let redexes = 0;
  for (let redex of obj.redexes()) {
    console.log(`redex ${redex}`);
    let lambda = (redex as Application).get_left() as Lambda;
    console.log(`lambda ${lambda}`);
    if (has_variable(lambda.get_body(), lambda.get_parameter())) {
      redexes++;
    }
  }
  return redexes;
}

function new_question() : LambdaObject {
  let lambda: LambdaObject;
  let redexes = Math.floor(2 * Math.random()) + 1;
  let vari: Variable | null = null;
  let body: LambdaObject | null = null;
  do {
    lambda = random_lambda(["w", "x", "y", "z"], 4);
    let norm = lambda.norm_ord_redex();
    if (norm === null) {
	    continue;
    }
    let l = norm.get_left() as Lambda;
    vari = l.get_parameter();
    body = l.get_body();
    console.log(`Checking: ${norm}, has variable ${has_variable(body, vari)}`);
  } while (lambda.redexes().length < redexes || !(body !== null && vari !== null && has_variable(body, vari)));
  return lambda;
}

let questions: Question[] = [];

const App: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [responses, setResponses] = useState<Response[]>([]);
  const [showResult, setShowResult] = useState(false);

  if (questions.length === 0) {
    let question = new_question();
    let answer = question.copy();
    let redex = answer.norm_ord_redex();
    if (redex === answer) {
      answer = redex.reduce();
    } else if (redex !== null) {
      redex.reduce();
    } else {
      throw new Error("inital statement has no redex");
    }
    if (redex !== null) {
      questions.push({question, questionStr: String(question), answer, answerStr: String(answer)});
    } else {
      throw Error("No redex found");
    }
  }

  const handleSubmit = () => {
    console.log(currentIndex, questions.length);
    if (currentIndex !== questions.length - 1) {
	    //return;
    }
    const correctAnswer = questions[currentIndex].answer;
    let parsedAnswer = (new Parser(userAnswer).parse_line() as LambdaObject);
    const isCorrect = parsedAnswer.eq(correctAnswer, null);
    if (isCorrect) {
      const question = new_question();
      let answer = correctAnswer.copy();
      let redex = answer.norm_ord_redex();
      console.log(`before ${answer}`);
      if (answer === redex) {
        answer = redex.reduce();
      } else if (redex !== null) {
        redex.reduce();
      }
      console.log(`after ${answer}`);
      console.log(`question ${question}`);
      if (redex !== null) {
      	questions.push({
		question,
		questionStr: String(question),
		answer,
		answerStr: String(answer)
	});
      }
      console.log(questions);
    } else {
      questions.push(questions[questions.length - 1]);
    }

    const newResponse: Response = {
      lambdaExpr: questions[currentIndex].question,
      lambdaExprStr: String(questions[currentIndex].question),
      userAnswer: parsedAnswer,
      userAnswerStr: String(parsedAnswer),
      correctAnswer,
      correctAnswerStr: String(correctAnswer),
      isCorrect,
      showCorrectAnswer: false,
    };

    setResponses([...responses, newResponse]);
    setUserAnswer('');

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowResult(true);
    }
  };

  return (
    <div className="container">
      <h1>Enter the normal order resolution of each expression</h1>

      {responses.map((res, idx) => (
        <div key={idx} className="response">
          <p><strong>Reduce:</strong> {res.lambdaExprStr}</p>
          <p>
            {res.isCorrect ? (
              <span className="correct">Correct! Answer: {res.correctAnswerStr}</span>
            ) : (
              <>
                <span className="incorrect"> Incorrect answer: {res.userAnswerStr}</span>
                <br></br>
                {res.showCorrectAnswer ? (
                  <span className="incorrect"> Correct answer was: {res.correctAnswerStr} </span>
                ) : (
                  <button
                    onClick={() => {
                      const updated = [...responses];
                      updated[idx] = { ...updated[idx], showCorrectAnswer: true };
                      setResponses(updated);
                    }}
                  >
                    Show correct answer
                  </button>
                )}
              </>
            )}
          </p>
        </div>
      ))}

      {!showResult ? (
        <div>
          <p><strong>Reduce:</strong> {questions[currentIndex].questionStr}</p>
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Reduced Expression"
          />
          <button onClick={handleSubmit}>Submit</button>
        </div>
      ) : <>
            <strong>Finished Resolving</strong>
	    <br></br>
	    {questions[currentIndex-1].answerStr}
	  </>
      }
    </div>
  );
};

export default App;

/*
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
	 * /
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
*/
