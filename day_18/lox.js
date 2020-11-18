export default class Lox {
  constructor() {
    this.hadError = false;
    this.interpreter = new Interpreter(this);
    const simplex = new SimplexNoise(42);
    this.interpreter.scope['abs'] = Math.abs;
    this.interpreter.scope['sin'] = Math.sin;
    this.interpreter.scope['cos'] = Math.cos;
    this.interpreter.scope['min'] = Math.min;
    this.interpreter.scope['max'] = Math.max;
    this.interpreter.scope['noise2d'] = (x, y) => simplex.noise2D(x, y);
  }

  _scan(expr) {
    const scanner = new Scanner(this, expr);
    scanner.scanTokens();
    if (this.hadError) return false;
    return scanner.tokens;
  }

  _parse(tokens) {
    const parser = new Parser(this, tokens);
    const expression = parser.parse();
    return expression;
  }

  parse(expression) {
    const tokens = this._scan(expression);
    if (!tokens) {
      return null;
    }
    return this._parse(tokens);
  }

  error(line, message) {
    this.report(line, '', message);
  }

  parseError(token, message) {
    if (token.type === TokenType.EOF) {
      this.report(token.line, ' at end', message);
    } else {
      this.report(token.line, " at '" + token.lexeme + "'", message);
    }
  }

  report(line, where, message) {
    console.error(`[line ${line}] Error ${where}: ${message}`);
    this.hadError = true;
  }
}

//// SCANNER ////

export const TokenType = {
  // Single-character tokens.
  LEFT_PAREN: 1,
  RIGHT_PAREN: 2,
  LEFT_BRACE: 3,
  RIGHT_BRACE: 4,
  COMMA: 5,
  DOT: 6,
  MINUS: 7,
  PLUS: 8,
  SEMICOLON: 9,
  SLASH: 10,
  STAR: 11,
  PERCENT: 12,

  // One or two character tokens.
  BANG: 13,
  BANG_EQUAL: 14,
  EQUAL: 15,
  EQUAL_EQUAL: 16,
  GREATER: 17,
  GREATER_EQUAL: 18,
  LESS: 19,
  LESS_EQUAL: 20,

  // Literals.
  IDENTIFIER: 21,
  STRING: 22,
  NUMBER: 23,

  // Keywords.
  AND: 24,
  CLASS: 25,
  ELSE: 26,
  FALSE: 27,
  FUN: 28,
  FOR: 29,
  IF: 30,
  NIL: 31,
  OR: 32,
  PRINT: 33,
  RETURN: 34,
  SUPER: 35,
  THIS: 36,
  TRUE: 37,
  VAR: 38,
  WHILE: 39,

  EOF: 40,
};

const keywords = {};
keywords['and'] = TokenType.AND;
keywords['class'] = TokenType.CLASS;
keywords['else'] = TokenType.ELSE;
keywords['false'] = TokenType.FALSE;
keywords['for'] = TokenType.FOR;
keywords['fun'] = TokenType.FUN;
keywords['if'] = TokenType.IF;
keywords['nil'] = TokenType.NIL;
keywords['or'] = TokenType.OR;
keywords['print'] = TokenType.PRINT;
keywords['return'] = TokenType.RETURN;
keywords['super'] = TokenType.SUPER;
keywords['this'] = TokenType.THIS;
keywords['true'] = TokenType.TRUE;
keywords['var'] = TokenType.VAR;
keywords['while'] = TokenType.WHILE;

class Token {
  constructor(type, lexeme, literal, line) {
    this.type = type;
    this.lexeme = lexeme;
    this.literal = literal;
    this.line = line;
  }
  toString() {
    return this.type + ' ' + this.lexeme + ' ' + this.literal;
  }
}

export class Scanner {
  constructor(lox, source) {
    this.lox = lox;
    this.source = source;
    this.tokens = [];
    this.start = 0;
    this.current = 0;
    this.line = 1;
  }

  scanTokens() {
    while (!this.isAtEnd()) {
      // We are at the beginning of the next lexeme.
      this.start = this.current;
      this.scanToken();
    }

    this.tokens.push(new Token(TokenType.EOF, '', null, this.line));
    return this.tokens;
  }

  isAtEnd() {
    return this.current >= this.source.length;
  }

  scanToken() {
    const c = this.advance();
    switch (c) {
      case '(':
        this.addToken(TokenType.LEFT_PAREN);
        break;
      case ')':
        this.addToken(TokenType.RIGHT_PAREN);
        break;
      case '{':
        this.addToken(TokenType.LEFT_BRACE);
        break;
      case '}':
        this.addToken(TokenType.RIGHT_BRACE);
        break;
      case ',':
        this.addToken(TokenType.COMMA);
        break;
      case '.':
        this.addToken(TokenType.DOT);
        break;
      case '-':
        this.addToken(TokenType.MINUS);
        break;
      case '+':
        this.addToken(TokenType.PLUS);
        break;
      case ';':
        this.addToken(TokenType.SEMICOLON);
        break;
      case '*':
        this.addToken(TokenType.STAR);
        break;
      case '%':
        this.addToken(TokenType.PERCENT);
        break;
      case '!':
        this.addToken(this.match('=') ? TokenType.BANG_EQUAL : TokenType.BANG);
        break;
      case '=':
        this.addToken(this.match('=') ? TokenType.EQUAL_EQUAL : TokenType.EQUAL);
        break;
      case '<':
        this.addToken(this.match('=') ? TokenType.LESS_EQUAL : TokenType.LESS);
        break;
      case '>':
        this.addToken(this.match('=') ? TokenType.GREATER_EQUAL : TokenType.GREATER);
        break;
      case '/':
        if (this.match('/')) {
          // A comment goes until the end of the line.
          while (this.peek() != '\n' && !this.isAtEnd()) this.advance();
        } else {
          this.addToken(TokenType.SLASH);
        }
        break;
      case ' ':
      case '\r':
      case '\t':
        // Ignore whitespace.
        break;
      case '\n':
        this.line++;
        break;
      case '"':
        this.string();
        break;
      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          this.lox.error(this.line, `Unexpected character "${c}".`);
        }
        break;
    }
  }

  advance() {
    this.current++;
    return this.source[this.current - 1];
  }

  addToken(type, literal = null) {
    const text = this.source.substring(this.start, this.current);
    this.tokens.push(new Token(type, text, literal, this.line));
  }

  match(expected) {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] != expected) return false;
    this.current++;
    return true;
  }

  peek() {
    if (this.isAtEnd()) return '\0';
    return this.source[this.current];
  }

  peekNext() {
    if (this.current + 1 >= this.source.length) return '\0';
    return this.source[this.current + 1];
  }

  string() {
    while (this.peek() != '"' && !this.isAtEnd()) {
      if (this.peek() === '\n') this.line++;
      this.advance();
    }

    if (this.isAtEnd()) {
      this.lox.error(this.line, 'Unterminated string.');
      return;
    }

    // The closing ".
    this.advance();

    // Trim the surrounding quotes.
    value = this.source.substring(this.start + 1, this.current - 1);
    addToken(TokenType.STRING, this.value);
  }

  number() {
    while (this.isDigit(this.peek())) this.advance();

    // Look for a fractional part.
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      // Consume the "."
      this.advance();

      while (this.isDigit(this.peek())) this.advance();
    }

    this.addToken(TokenType.NUMBER, parseFloat(this.source.substring(this.start, this.current)));
  }

  isDigit(c) {
    return c >= '0' && c <= '9';
  }

  identifier() {
    while (this.isAlphaNumeric(this.peek())) this.advance();
    const text = this.source.substring(this.start, this.current);
    let type = keywords[text];
    if (!type) type = TokenType.IDENTIFIER;
    this.addToken(type);
  }

  isAlpha(c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$';
  }

  isAlphaNumeric(c) {
    return this.isAlpha(c) || this.isDigit(c);
  }
}

//// PARSER ////

function makeExpression(type, ...attrs) {
  return [type, ...attrs];
}

export class Parser {
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

//// INTERPRETER ////

export class Interpreter {
  constructor(lox) {
    this.lox = lox;
    this.scope = {};
  }

  visitLiteral(expr) {
    return expr[1];
  }

  visitGrouping(expr) {
    return this.evaluate(expr[1]);
  }

  visitUnary(expr) {
    const right = this.evaluate(expr[2]);

    switch (expr[1]) {
      case TokenType.BANG:
        return !isTruthy(right);
      case TokenType.MINUS:
        return -right;
    }

    // Unreachable.
    return null;
  }

  visitBinary(expr) {
    const [_, leftExpr, operatorToken, rightExpr] = expr;
    const left = this.evaluate(leftExpr);
    const right = this.evaluate(rightExpr);

    switch (operatorToken.type) {
      case TokenType.MINUS:
        return left - right;
      case TokenType.PLUS:
        return left + right;
      case TokenType.SLASH:
        return left / right;
      case TokenType.STAR:
        return left * right;
      case TokenType.PERCENT:
        return left % right;
      default:
        throw new Error(`Invalid token type ${operatorToken}`);
    }

    // Unreachable.
    return null;
  }

  visitCall(expr) {
    const [_, calleeExpr, paren, argExprs] = expr;
    const callee = this.evaluate(calleeExpr);
    const args = [];
    for (const argExpr of argExprs) {
      const arg = this.evaluate(argExpr);
      args.push(arg);
    }
    const result = callee(...args);
    return result;
  }

  visitVariable(expr) {
    const token = expr[1];
    return this.scope[token.lexeme];
  }

  evaluate(expr) {
    const type = expr[0];
    switch (type) {
      case 'literal':
        return this.visitLiteral(expr);
      case 'unary':
        return this.visitUnary(expr);
      case 'binary':
        return this.visitBinary(expr);
      case 'call':
        return this.visitCall(expr);
      case 'variable':
        return this.visitVariable(expr);
      case 'grouping':
        return this.visitGrouping(expr);
      default:
        throw new Error(`Invalid expression ${expr}`);
    }
  }

  isTruthy(object) {
    if (object === null) return false;
    if (typeof object === 'boolean') return object;
    return true;
  }
}
