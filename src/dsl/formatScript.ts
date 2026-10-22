/**
 * Formats a script: one space around `=`, `->` and binary operators, none
 * inside parentheses or around `.`, "25 °C" with a space before the unit,
 * trailing comments aligned within a block, at most one blank line in a row.
 * A line that does not tokenize is left as it is.
 */
import { NUMBER, tokenize, type Token } from "./parser";

const TIGHT_BEFORE = new Set([",", ")", "]", ".", ":"]);
const TIGHT_AFTER = new Set(["(", "[", "."]);
/** After these, a "-" is unary: "= -10 °C", "(-x". */
const OPERAND_EXPECTED = new Set([
  "=",
  "(",
  ",",
  ":",
  "+",
  "-",
  "*",
  "/",
  "^",
  "->",
  "[",
]);
/** Longest code part a trailing comment is aligned after. */
const ALIGN_LIMIT = 44;

/** Splits "code  # comment" outside strings. */
function splitComment(line: string): { code: string; comment?: string } {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    if (line[i] === "#" && !quoted) {
      return { code: line.slice(0, i), comment: line.slice(i + 1).trim() };
    }
  }
  return { code: line };
}

function tokenText(t: Token): string {
  if (t.kind === "string") return `"${t.text}"`;
  if (t.kind === "num" && t.unit) {
    // The unit as typed: "1m²" is "1 m²".
    const value = NUMBER.exec(t.text)![0];
    const unit = t.text.slice(value.length).trim();
    return t.unit === "%" ? `${value}%` : `${value} ${unit}`;
  }
  return t.text;
}

function formatCode(code: string): string {
  const tokens = tokenize(code).filter(
    (t) => t.kind !== "newline" && t.kind !== "eof",
  );
  let out = "";
  let prev: Token | undefined;
  let prevUnary = false;
  for (const t of tokens) {
    const punct = t.kind === "punct" ? t.text : undefined;
    const prevPunct = prev?.kind === "punct" ? prev.text : undefined;
    const tight =
      !prev ||
      prevUnary ||
      (punct !== undefined && TIGHT_BEFORE.has(punct)) ||
      (prevPunct !== undefined && TIGHT_AFTER.has(prevPunct)) ||
      punct === "^" ||
      prevPunct === "^" ||
      (punct === "(" && prev.kind === "word");
    out += (tight ? "" : " ") + tokenText(t);
    prevUnary =
      punct === "-" &&
      (!prev || (prevPunct !== undefined && OPERAND_EXPECTED.has(prevPunct)));
    prev = t;
  }
  return out;
}

export function formatScript(source: string): string {
  const lines = source.split("\n").map((raw) => {
    const { code, comment } = splitComment(raw);
    let formatted: string;
    try {
      formatted = code.trim() ? formatCode(code) : "";
    } catch {
      formatted = code.trim();
    }
    return { code: formatted, comment };
  });

  // Align trailing comments within runs of consecutive commented code lines.
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const { code, comment } = lines[i];
    if (code && comment !== undefined) {
      let j = i;
      while (
        j < lines.length &&
        lines[j].code &&
        lines[j].comment !== undefined
      )
        j++;
      const run = lines.slice(i, j);
      const width = Math.min(
        Math.max(...run.map((l) => l.code.length)),
        ALIGN_LIMIT,
      );
      for (const l of run) {
        out.push(`${l.code.padEnd(width)}  # ${l.comment}`.trimEnd());
      }
      i = j;
      continue;
    }
    out.push(comment !== undefined ? `# ${comment}`.trimEnd() : code);
    i++;
  }

  // At most one blank line in a row; none at the start or end.
  const compact = out.filter(
    (l, k) => l !== "" || (k > 0 && out[k - 1] !== ""),
  );
  while (compact[0] === "") compact.shift();
  while (compact[compact.length - 1] === "") compact.pop();
  return compact.join("\n") + "\n";
}
