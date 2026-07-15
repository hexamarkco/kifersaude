type TokenKind = 'number' | 'string' | 'identifier' | 'operator' | 'punctuation' | 'eof';

type Token = {
  kind: TokenKind;
  value: string;
};

type Expression =
  | { type: 'literal'; value: unknown }
  | { type: 'identifier'; name: string }
  | { type: 'member'; object: Expression; property: string }
  | { type: 'call'; name: string; arguments: Expression[] }
  | { type: 'unary'; operator: string; operand: Expression }
  | { type: 'binary'; operator: string; left: Expression; right: Expression };

export type SafeFormulaOptions = {
  now?: () => Date;
  formatDate?: (date: unknown, format?: unknown) => string;
};

const MAX_FORMULA_LENGTH = 4096;
const MAX_NESTING = 64;
const FORBIDDEN_PROPERTY_NAMES = new Set(['__proto__', 'constructor', 'prototype']);
const MULTI_CHARACTER_OPERATORS = ['===', '!==', '>=', '<=', '==', '!=', '&&', '||'];

const isDigit = (value: string | undefined) => Boolean(value && value >= '0' && value <= '9');
const isIdentifierStart = (value: string) => /[A-Za-z_$]/.test(value);
const isIdentifierPart = (value: string) => /[A-Za-z0-9_$]/.test(value);

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      const quote = character;
      let value = '';
      index += 1;

      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\\') {
          index += 1;
          if (index >= source.length) throw new Error('Invalid formula string');
          const escaped = source[index];
          value += escaped === 'n' ? '\n' : escaped === 'r' ? '\r' : escaped === 't' ? '\t' : escaped;
          index += 1;
          continue;
        }
        value += source[index];
        index += 1;
      }

      if (source[index] !== quote) throw new Error('Invalid formula string');
      tokens.push({ kind: 'string', value });
      index += 1;
      continue;
    }

    if (isDigit(character) || (character === '.' && isDigit(source[index + 1]))) {
      const match = source.slice(index).match(/^(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/);
      if (!match) throw new Error('Invalid formula number');
      tokens.push({ kind: 'number', value: match[0] });
      index += match[0].length;
      continue;
    }

    if (isIdentifierStart(character)) {
      const start = index;
      index += 1;
      while (index < source.length && isIdentifierPart(source[index])) index += 1;
      tokens.push({ kind: 'identifier', value: source.slice(start, index) });
      continue;
    }

    const operator = MULTI_CHARACTER_OPERATORS.find((candidate) => source.startsWith(candidate, index));
    if (operator) {
      tokens.push({ kind: 'operator', value: operator });
      index += operator.length;
      continue;
    }

    if ('+-*/%!<>'.includes(character)) {
      tokens.push({ kind: 'operator', value: character });
      index += 1;
      continue;
    }

    if ('(),.'.includes(character)) {
      tokens.push({ kind: 'punctuation', value: character });
      index += 1;
      continue;
    }

    throw new Error('Invalid formula token');
  }

  tokens.push({ kind: 'eof', value: '' });
  return tokens;
};

class FormulaParser {
  private position = 0;
  private nesting = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Expression {
    const expression = this.parseExpression();
    if (this.current().kind !== 'eof') throw new Error('Invalid formula syntax');
    return expression;
  }

  private parseExpression(): Expression {
    this.nesting += 1;
    if (this.nesting > MAX_NESTING) throw new Error('Formula nesting limit exceeded');
    try {
      return this.parseOr();
    } finally {
      this.nesting -= 1;
    }
  }

  private parseOr(): Expression {
    let expression = this.parseAnd();
    while (this.match('||')) {
      expression = this.binary('||', expression, this.parseAnd());
    }
    return expression;
  }

  private parseAnd(): Expression {
    let expression = this.parseEquality();
    while (this.match('&&')) {
      expression = this.binary('&&', expression, this.parseEquality());
    }
    return expression;
  }

  private parseEquality(): Expression {
    let expression = this.parseComparison();
    while (this.hasOperator('==', '===', '!=', '!==')) {
      const operator = this.advance().value;
      expression = this.binary(operator, expression, this.parseComparison());
    }
    return expression;
  }

  private parseComparison(): Expression {
    let expression = this.parseAdditive();
    while (this.hasOperator('>', '>=', '<', '<=')) {
      const operator = this.advance().value;
      expression = this.binary(operator, expression, this.parseAdditive());
    }
    return expression;
  }

  private parseAdditive(): Expression {
    let expression = this.parseMultiplicative();
    while (this.hasOperator('+', '-')) {
      const operator = this.advance().value;
      expression = this.binary(operator, expression, this.parseMultiplicative());
    }
    return expression;
  }

  private parseMultiplicative(): Expression {
    let expression = this.parseUnary();
    while (this.hasOperator('*', '/', '%')) {
      const operator = this.advance().value;
      expression = this.binary(operator, expression, this.parseUnary());
    }
    return expression;
  }

  private parseUnary(): Expression {
    if (this.hasOperator('!', '+', '-')) {
      return { type: 'unary', operator: this.advance().value, operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    const token = this.advance();
    let expression: Expression;

    if (token.kind === 'number') {
      expression = { type: 'literal', value: Number(token.value) };
    } else if (token.kind === 'string') {
      expression = { type: 'literal', value: token.value };
    } else if (token.kind === 'identifier') {
      if (token.value === 'true') {
        expression = { type: 'literal', value: true };
      } else if (token.value === 'false') {
        expression = { type: 'literal', value: false };
      } else if (token.value === 'null') {
        expression = { type: 'literal', value: null };
      } else if (this.match('(')) {
        const argumentsList: Expression[] = [];
        if (!this.match(')')) {
          do {
            argumentsList.push(this.parseExpression());
          } while (this.match(','));
          this.expect(')');
        }
        expression = { type: 'call', name: token.value, arguments: argumentsList };
      } else {
        expression = { type: 'identifier', name: token.value };
      }
    } else if (token.kind === 'punctuation' && token.value === '(') {
      expression = this.parseExpression();
      this.expect(')');
    } else {
      throw new Error('Invalid formula expression');
    }

    while (this.match('.')) {
      const property = this.advance();
      if (property.kind !== 'identifier') throw new Error('Invalid formula property');
      expression = { type: 'member', object: expression, property: property.value };
    }

    return expression;
  }

  private binary(operator: string, left: Expression, right: Expression): Expression {
    return { type: 'binary', operator, left, right };
  }

  private current(): Token {
    return this.tokens[this.position];
  }

  private advance(): Token {
    const token = this.current();
    this.position += 1;
    return token;
  }

  private match(value: string): boolean {
    const kind = '(),.'.includes(value) ? 'punctuation' : 'operator';
    if (this.current().kind !== kind || this.current().value !== value) return false;
    this.position += 1;
    return true;
  }

  private hasOperator(...operators: string[]): boolean {
    return this.current().kind === 'operator' && operators.includes(this.current().value);
  }

  private expect(value: string): void {
    if (!this.match(value)) throw new Error('Invalid formula syntax');
  }
}

const isForbiddenProperty = (name: string) => FORBIDDEN_PROPERTY_NAMES.has(name);

const getOwnValue = (value: object, property: string): unknown => {
  if (isForbiddenProperty(property)) throw new Error('Forbidden formula property');
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  if (!descriptor && property in value) throw new Error('Forbidden formula prototype property');
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
};

const getContextValue = (context: object, name: string): unknown => {
  if (isForbiddenProperty(name)) throw new Error('Forbidden formula variable');
  const descriptor = Object.getOwnPropertyDescriptor(context, name);
  if (!descriptor || !('value' in descriptor)) throw new Error('Unknown formula variable');
  return descriptor.value;
};

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return value instanceof Date ? value.toISOString() : '';
};

const toNumber = (value: unknown): number => {
  if (value === null) return 0;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return Number(value);
  }
  return Number.NaN;
};

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date(Number.NaN);
};

const defaultFormatDate = (date: unknown, format?: unknown): string => {
  const parsed = toDate(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return format === 'datetime'
    ? parsed.toLocaleString('pt-BR')
    : parsed.toLocaleDateString('pt-BR');
};

const evaluateHelper = (name: string, args: unknown[], options: SafeFormulaOptions): unknown => {
  switch (name) {
    case 'if':
      return args[0] ? args[1] : args[2];
    case 'concat':
      return args.map(toText).join('');
    case 'lower':
      return toText(args[0]).toLowerCase();
    case 'upper':
      return toText(args[0]).toUpperCase();
    case 'len':
      return toText(args[0]).length;
    case 'number':
      return toNumber(args[0]);
    case 'now':
      return options.now?.() ?? new Date();
    case 'dateAdd': {
      const base = toDate(args[0]);
      const unit = args[2];
      const delta = unit === 'days' ? 86_400_000 : unit === 'hours' ? 3_600_000 : 60_000;
      return new Date(base.getTime() + toNumber(args[1]) * delta);
    }
    case 'formatDate':
      return (options.formatDate ?? defaultFormatDate)(args[0], args[1]);
    default:
      throw new Error('Unknown formula helper');
  }
};

const add = (left: unknown, right: unknown): unknown =>
  typeof left === 'string' || typeof right === 'string'
    ? `${toText(left)}${toText(right)}`
    : toNumber(left) + toNumber(right);

const compare = (left: unknown, right: unknown, operator: string): boolean => {
  const [first, second] = typeof left === 'string' && typeof right === 'string'
    ? [left, right]
    : [toNumber(left), toNumber(right)];

  switch (operator) {
    case '>':
      return first > second;
    case '>=':
      return first >= second;
    case '<':
      return first < second;
    case '<=':
      return first <= second;
    default:
      throw new Error('Invalid formula comparison');
  }
};

const evaluateExpression = (expression: Expression, context: object, options: SafeFormulaOptions): unknown => {
  switch (expression.type) {
    case 'literal':
      return expression.value;
    case 'identifier':
      return getContextValue(context, expression.name);
    case 'member': {
      const object = evaluateExpression(expression.object, context, options);
      if ((typeof object !== 'object' && typeof object !== 'function') || object === null) return undefined;
      return getOwnValue(object, expression.property);
    }
    case 'call':
      return evaluateHelper(
        expression.name,
        expression.arguments.map((argument) => evaluateExpression(argument, context, options)),
        options,
      );
    case 'unary': {
      const operand = evaluateExpression(expression.operand, context, options);
      if (expression.operator === '!') return !operand;
      if (expression.operator === '+') return toNumber(operand);
      if (expression.operator === '-') return -toNumber(operand);
      throw new Error('Invalid formula unary operator');
    }
    case 'binary': {
      const left = evaluateExpression(expression.left, context, options);
      if (expression.operator === '&&') return left && evaluateExpression(expression.right, context, options);
      if (expression.operator === '||') return left || evaluateExpression(expression.right, context, options);

      const right = evaluateExpression(expression.right, context, options);
      switch (expression.operator) {
        case '==':
        case '===':
          return left === right;
        case '!=':
        case '!==':
          return left !== right;
        case '+':
          return add(left, right);
        case '-':
          return toNumber(left) - toNumber(right);
        case '*':
          return toNumber(left) * toNumber(right);
        case '/':
          return toNumber(left) / toNumber(right);
        case '%':
          return toNumber(left) % toNumber(right);
        case '>':
        case '>=':
        case '<':
        case '<=':
          return compare(left, right, expression.operator);
        default:
          throw new Error('Invalid formula binary operator');
      }
    }
  }
};

export const evaluateSafeFormula = (
  expression: string,
  context: object,
  options: SafeFormulaOptions = {},
): unknown | null => {
  const trimmed = expression.trim().replace(/^=+\s*/, '');
  if (!trimmed || trimmed.length > MAX_FORMULA_LENGTH) return null;

  try {
    return evaluateExpression(new FormulaParser(tokenize(trimmed)).parse(), context, options);
  } catch {
    return null;
  }
};
