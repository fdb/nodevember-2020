// Recursive descent parser
import { TokenType } from './scanner.js';

function makeExpression(type, ...attrs) {
  return [type, ...attrs];
}

export default class Parser {
  constructor(lox, tokens) {
    this.tokens = tokens;
    this.current = 0;
  }

  parse() {
    //try {
    return this.expression();
    //} catch (error) {
    //return null;
    //}
  }

  expression() {
    return this.equality();
  }

  // equality → comparison ( ( "!=" | "==" ) comparison )* ;
  equality() {
    let expr = this.comparison();

    while (this.match(TokenType.BANG_EQUAL, TokenType.EQUAL_EQUAL)) {
      const operator = this.previous();
      const right = this.comparison();
      expr = makeExpression('binary', expr, operator, right);
    }

    return expr;
  }

  comparison() {
    let expr = this.term();

    while (this.match(TokenType.GREATER, TokenType.GREATER_EQUAL, TokenType.LESS, TokenType.LESS_EQUAL)) {
      const operator = this.previous();
      const right = this.term();
      expr = makeExpression('binary', expr, operator, right);
    }

    return expr;
  }

  term() {
    let expr = this.factor();

    while (this.match(TokenType.MINUS, TokenType.PLUS)) {
      const operator = this.previous();
      const right = this.factor();
      expr = makeExpression('binary', expr, operator, right);
    }

    return expr;
  }

  factor() {
    let expr = this.unary();

    while (this.match(TokenType.SLASH, TokenType.STAR, TokenType.PERCENT)) {
      const operator = this.previous();
      const right = this.unary();
      expr = makeExpression('binary', expr, operator, right);
    }

    return expr;
  }

  // unary          → ( "!" | "-" ) unary | call ;
  unary() {
    if (this.match(TokenType.BANG, TokenType.MINUS)) {
      const operator = this.previous();
      const right = this.unary();
      return makeExpression('unary', operator, right);
    }

    return this.call();
  }

  // call           → primary ( "(" arguments? ")" )* ;
  // arguments      → expression ( "," expression )* ;
  call() {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LEFT_PAREN)) {
        expr = this.finishCall(expr);
      } else {
        break;
      }
    }
    return expr;
  }

  finishCall(callee) {
    const args = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        args.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }
    const paren = this.consume(TokenType.RIGHT_PAREN, "Expect ')' after args.");
    return makeExpression('call', callee, paren, args);
  }

  // primary        → NUMBER | STRING | "true" | "false" | "nil"
  //                | "(" expression ")" ;
  primary() {
    if (this.match(TokenType.FALSE)) return makeExpression('literal', false);
    if (this.match(TokenType.TRUE)) return makeExpression('literal', true);
    if (this.match(TokenType.NIL)) return makeExpression('literal', null);

    if (this.match(TokenType.NUMBER, TokenType.STRING)) {
      return makeExpression('literal', this.previous().literal);
    }

    if (this.match(TokenType.IDENTIFIER)) {
      return makeExpression('variable', this.previous());
    }

    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RIGHT_PAREN, "Expect ')' after expression.");
      return makeExpression('grouping', expr);
    }
  }

  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }

    return false;
  }

  check(type) {
    if (this.isAtEnd()) return false;
    return this.peek().type == type;
  }

  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  isAtEnd() {
    return this.peek().type === TokenType.EOF;
  }

  peek() {
    return this.tokens[this.current];
  }

  previous() {
    return this.tokens[this.current - 1];
  }

  consume(type, message) {
    if (this.check(type)) return this.advance();

    throw new Error(this.peek() + message);
  }

  error(token, message) {
    this.lox.error(token, message);
    return new Error();
  }
}
