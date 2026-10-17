/**
 * Error messages written under the line they are about, so a phone shows
 * what is wrong where it is, without another tab or a hover.
 */
import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import type { Diagnostic } from "../parser";

export const setInlineErrors = StateEffect.define<Diagnostic[]>();

class ErrorWidget extends WidgetType {
  constructor(readonly messages: string[]) {
    super();
  }

  eq(other: ErrorWidget) {
    return other.messages.join("\n") === this.messages.join("\n");
  }

  toDOM() {
    // Spacing as padding: CodeMirror measures block widgets without margins.
    const outer = document.createElement("div");
    outer.className = "cm-inline-error";
    const box = document.createElement("div");
    box.className = "cm-inline-error__box";
    box.setAttribute("role", "note");
    for (const message of this.messages) {
      const line = document.createElement("div");
      line.textContent = message;
      box.append(line);
    }
    outer.append(box);
    return outer;
  }

  ignoreEvent() {
    return false;
  }
}

function build(state: EditorState, diagnostics: Diagnostic[]): DecorationSet {
  const byLine = new Map<number, string[]>();
  for (const d of diagnostics) {
    if (d.line < 1 || d.line > state.doc.lines) continue;
    const list = byLine.get(d.line) ?? [];
    if (!list.includes(d.message)) list.push(d.message);
    byLine.set(d.line, list);
  }
  const ranges = [...byLine]
    .sort(([a], [b]) => a - b)
    .map(([line, messages]) =>
      Decoration.widget({
        widget: new ErrorWidget(messages),
        block: true,
        side: 1,
      }).range(state.doc.line(line).to),
    );
  return Decoration.set(ranges);
}

export const inlineErrors = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    let next = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setInlineErrors)) next = build(tr.state, e.value);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const inlineErrorTheme = EditorView.baseTheme({
  ".cm-inline-error": {
    padding: "0.1rem 0 0.35rem",
  },
  ".cm-inline-error__box": {
    padding: "0.3rem 0.6rem",
    borderLeft: "3px solid #dc2626",
    borderRadius: "0 0.4rem 0.4rem 0",
    backgroundColor: "rgba(220, 38, 38, 0.07)",
    color: "#991b1b",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "0.85em",
    lineHeight: "1.4",
    whiteSpace: "normal",
  },
});
