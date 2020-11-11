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

export default class Scanner {
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
