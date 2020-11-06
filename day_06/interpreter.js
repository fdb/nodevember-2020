import { TokenType } from './scanner.js';

export default class Interpreter {
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
