import { z } from "zod";

const mathInputSchema = z.object({
  expression: z.string().min(1).max(500),
});

type Token =
  | { type: "number"; value: number }
  | { type: "operator"; value: Operator }
  | { type: "paren"; value: "(" | ")" };

type Operator = "+" | "-" | "*" | "/" | "^";

function tokenize(expression: string) {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let raw = char;
      index += 1;

      while (index < expression.length && /[0-9.]/.test(expression[index])) {
        raw += expression[index];
        index += 1;
      }

      const value = Number(raw);

      if (!Number.isFinite(value)) {
        throw new Error(`Invalid number: ${raw}`);
      }

      tokens.push({ type: "number", value });
      continue;
    }

    if (["+", "-", "*", "/", "^"].includes(char)) {
      tokens.push({ type: "operator", value: char as Operator });
      index += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unsupported character: ${char}`);
  }

  return tokens;
}

function parseExpression(tokens: Token[]) {
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function consume() {
    const token = tokens[index];
    index += 1;
    return token;
  }

  function parsePrimary(): number {
    const token = consume();

    if (!token) {
      throw new Error("Unexpected end of expression.");
    }

    if (token.type === "operator" && token.value === "-") {
      return -parsePrimary();
    }

    if (token.type === "operator" && token.value === "+") {
      return parsePrimary();
    }

    if (token.type === "number") {
      return token.value;
    }

    if (token.type === "paren" && token.value === "(") {
      const value = parseAddSubtract();
      const next = consume();

      if (!next || next.type !== "paren" || next.value !== ")") {
        throw new Error("Missing closing parenthesis.");
      }

      return value;
    }

    throw new Error("Expected a number or parenthesized expression.");
  }

  function parsePower(): number {
    const left = parsePrimary();
    const token = peek();

    if (token?.type === "operator" && token.value === "^") {
      consume();
      return left ** parsePower();
    }

    return left;
  }

  function parseMultiplyDivide(): number {
    let value = parsePower();

    while (true) {
      const token = peek();

      if (token?.type !== "operator" || (token.value !== "*" && token.value !== "/")) {
        return value;
      }

      consume();
      const right = parsePower();

      if (token.value === "*") {
        value *= right;
      } else {
        if (right === 0) {
          throw new Error("Division by zero.");
        }

        value /= right;
      }
    }
  }

  function parseAddSubtract(): number {
    let value = parseMultiplyDivide();

    while (true) {
      const token = peek();

      if (token?.type !== "operator" || (token.value !== "+" && token.value !== "-")) {
        return value;
      }

      consume();
      const right = parseMultiplyDivide();
      value = token.value === "+" ? value + right : value - right;
    }
  }

  const result = parseAddSubtract();

  if (index !== tokens.length) {
    throw new Error("Unexpected trailing input.");
  }

  if (!Number.isFinite(result)) {
    throw new Error("Calculation did not produce a finite number.");
  }

  return result;
}

export const mathTool = {
  description:
    "Evaluate a safe arithmetic expression using numbers, parentheses, +, -, *, /, and ^.",
  execute(input: z.infer<typeof mathInputSchema>) {
    const result = parseExpression(tokenize(input.expression));

    return {
      expression: input.expression,
      result,
    };
  },
  inputSchema: mathInputSchema,
  name: "math.calculate" as const,
};
