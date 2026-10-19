/**
 * Hover cards: a state's solved properties, a property's value, a
 * variable's value, or the documentation of a keyword, process or function.
 */
import { hoverTooltip, type Tooltip } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import type { Diagnostic as CmDiagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import type { Diagnostic } from "../parser";
import { formatQuantity } from "../format";
import {
  CLAUSE_WORDS,
  FUNCTIONS,
  KEYWORDS,
  PROCESSES,
  PROPERTIES,
} from "../vocabulary";
import { textbookProperty } from "../evaluate";
import { lineKind, type CompletionData } from "./completions";
import { phaseLabel, propertyValue } from "./describe";

const CARD_PROPERTIES = ["T", "P", "h", "s", "x", "D"];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function card(
  title: string,
  subtitle?: string,
): { root: HTMLElement; body: HTMLElement } {
  const root = el("div", "script-hover");
  const head = el("div", "script-hover__head");
  head.append(el("strong", "", title));
  if (subtitle) head.append(el("span", "script-hover__sub", subtitle));
  const body = el("div", "script-hover__body");
  root.append(head, body);
  return { root, body };
}

function docCard(title: string, detail: string, info: string): HTMLElement {
  const { root, body } = card(title, detail);
  body.append(el("p", "", info));
  return root;
}

function wordAround(state: EditorState, pos: number) {
  const word = state.wordAt(pos);
  if (!word) return null;
  const line = state.doc.lineAt(pos);
  return {
    from: word.from,
    to: word.to,
    text: state.sliceDoc(word.from, word.to),
    before: line.text.slice(0, word.from - line.from),
    after: line.text.slice(word.to - line.from),
    line: line.text,
  };
}

export function scriptHover(get: () => CompletionData) {
  return hoverTooltip((view, pos): Tooltip | null => {
    const w = wordAround(view.state, pos);
    if (!w || /#/.test(w.before)) return null;
    const { result } = get();
    const units = result?.unitSystem ?? "celsius";
    const statement = lineKind(w.line);
    const make = (dom: HTMLElement): Tooltip => ({
      pos: w.from,
      end: w.to,
      create: () => ({ dom }),
    });

    // A property read from a state: "1.h", "h1".
    const tb = textbookProperty(w.text);
    const owner =
      /(\w+)\.$/.exec(w.before)?.[1] ??
      (tb &&
      w.before.trim() !== "" &&
      result?.states.some((s) => s.name === tb.state)
        ? tb.state
        : undefined);
    if (owner) {
      const name = tb && !w.before.endsWith(".") ? tb.prop : w.text;
      const prop = PROPERTIES.find((p) => p.name === name);
      const st = result?.states.find((s) => s.name === owner);
      if (!prop) return null;
      const value = st ? propertyValue(st, prop.field, units) : undefined;
      const { root, body } = card(
        w.before.endsWith(".") ? `${owner}.${prop.name}` : w.text,
        `${prop.info} of state ${owner}`,
      );
      body.append(
        el(
          "p",
          "script-hover__value",
          value ?? (st?.error ? "State not solved" : "—"),
        ),
      );
      return make(root);
    }

    // A state: defined, read ("2s.", "from 2") or listed in a draw.
    const st = result?.states.find((s) => s.name === w.text);
    const isStateHere =
      w.after.startsWith(".") ||
      statement === "draw" ||
      (statement === "state" && /^\s*$/.test(w.before)) ||
      (statement === "state" && /\bfrom\s+$/.test(w.before));
    if (isStateHere && st) {
      const { root, body } = card(
        `State ${st.name}`,
        [st.fluid, st.how].filter(Boolean).join(" · "),
      );
      if (st.state) {
        const grid = el("dl", "script-hover__grid");
        for (const name of CARD_PROPERTIES) {
          const p = PROPERTIES.find((x) => x.name === name)!;
          const v = propertyValue(st, p.field, units);
          if (!v) continue;
          grid.append(el("dt", "", p.name), el("dd", "", v));
        }
        body.append(
          grid,
          el("p", "script-hover__sub", phaseLabel(st.state.phase)),
        );
      } else {
        body.append(el("p", "script-hover__error", st.error ?? "Not solved"));
      }
      return make(root);
    }

    // A variable.
    const v = result?.values.find((x) => x.name === w.text);
    if (v && !w.after.startsWith(".") && !w.after.startsWith("(")) {
      const { root, body } = card(v.name, "variable");
      body.append(
        v.value
          ? el("p", "script-hover__value", formatQuantity(v.value, units))
          : el("p", "script-hover__error", v.error ?? "No value"),
      );
      return make(root);
    }

    // Documentation.
    if (/^\s*$/.test(w.before)) {
      const k = KEYWORDS.find((x) => x.name === w.text);
      if (k) return make(docCard(k.name, k.detail, k.info));
    }
    const proc = PROCESSES.find((x) => x.name === w.text);
    if (proc && statement === "state" && !/^\s*=/.test(w.after))
      return make(docCard(proc.name, proc.detail, proc.info));
    const clause = CLAUSE_WORDS.find(
      (x) => x.name === (w.text === "saturated" ? "sat" : w.text),
    );
    if (
      clause &&
      !/^\s*=/.test(w.after) &&
      (statement === "state" || (statement === "print" && clause.name === "in"))
    )
      return make(docCard(w.text, clause.detail, clause.info));
    const fn = FUNCTIONS.find((x) => x.name === w.text);
    if (fn && w.after.startsWith("("))
      return make(docCard(fn.name, fn.detail, fn.info));
    const prop = PROPERTIES.find((x) => x.name === w.text);
    if (prop && /^\s*=/.test(w.after) && statement === "state") {
      return make(docCard(prop.name, prop.detail, prop.info));
    }
    return null;
  });
}

/** Evaluator diagnostics as editor ranges: the word at the position, or the line. */
export function toCmDiagnostics(
  doc: Text,
  diagnostics: Diagnostic[],
): CmDiagnostic[] {
  return diagnostics.flatMap((d) => {
    if (d.line < 1 || d.line > doc.lines) return [];
    const line = doc.line(d.line);
    const from = Math.min(line.from + d.col - 1, line.to);
    const indent = /^\s*/.exec(line.text)![0].length;
    // At the start of a statement, the error is about all of it.
    if (from >= line.to || from === line.from + indent) {
      const start = line.from + indent;
      return [
        {
          from: start,
          to: Math.max(line.to, start),
          severity: "error" as const,
          message: d.message,
        },
      ];
    }
    const word = /^[\w°%.]+|^\S/.exec(line.text.slice(from - line.from))![0];
    return [
      {
        from,
        to: from + word.length,
        severity: "error" as const,
        message: d.message,
      },
    ];
  });
}
