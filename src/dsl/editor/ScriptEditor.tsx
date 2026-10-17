import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  startCompletion,
} from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  toggleComment,
  undo,
} from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { lintGutter, lintKeymap, setDiagnostics } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  tooltips,
} from "@codemirror/view";
import { formatScript } from "../formatScript";
import type { Diagnostic } from "../parser";
import { scriptCompletions, type CompletionData } from "./completions";
import { scriptHover, toCmDiagnostics } from "./hover";
import { scriptHighlight, scriptLanguage } from "./language";
import {
  inlineErrors,
  inlineErrorTheme,
  setInlineErrors,
} from "./inlineErrors";

/** Typing pause before error messages appear under their lines. */
const INLINE_PAUSE_MS = 700;

export type ScriptEditorHandle = {
  /** Types `text` at the caret, replacing the selection. */
  insert(text: string): void;
  /** Formats the document; undoable. */
  format(): void;
  /** Replaces the document; undoable. */
  replace(text: string): void;
  goTo(line: number, col: number): void;
  /** Scrolls the caret into the middle of the editor. */
  reveal(): void;
  undo(): void;
  redo(): void;
  complete(): void;
  toggleComment(): void;
  focus(): void;
  blur(): void;
};

type Props = {
  value: string;
  onChange(value: string): void;
  onFocusChange?(focused: boolean): void;
  /** The last evaluation, and whether it is of the current text. */
  data: CompletionData;
  current: boolean;
};

/** Replaces only what changed, so the caret keeps its place. */
function minimalChange(from: string, to: string) {
  let start = 0;
  while (start < from.length && start < to.length && from[start] === to[start])
    start++;
  let endA = from.length;
  let endB = to.length;
  while (endA > start && endB > start && from[endA - 1] === to[endB - 1]) {
    endA--;
    endB--;
  }
  return { from: start, to: endA, insert: to.slice(start, endB) };
}

const theme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--surface-elevated)",
    color: "var(--text-primary)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    lineHeight: "1.6",
  },
  ".cm-content": { padding: "0.75rem 0", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0 0.9rem 0 0.6rem" },
  ".cm-gutters": {
    backgroundColor: "var(--surface-soft)",
    color: "var(--text-muted)",
    border: "none",
    borderRight: "1px solid var(--border-soft)",
  },
  ".cm-activeLine": { backgroundColor: "rgba(37, 99, 235, 0.05)" },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    color: "var(--text-primary)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection":
    {
      backgroundColor: "rgba(37, 99, 235, 0.2) !important",
    },
  ".cm-matchingBracket": {
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    outline: "1px solid rgba(37, 99, 235, 0.4)",
  },
  ".cm-selectionMatch": { backgroundColor: "rgba(250, 204, 21, 0.3)" },
  ".cm-tooltip": {
    border: "1px solid var(--border-soft)",
    borderRadius: "0.6rem",
    backgroundColor: "var(--surface-elevated)",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.16)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul": {
    fontFamily: "inherit",
    maxHeight: "16rem",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "0.3rem 0.6rem !important",
    lineHeight: "1.5",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "#fff",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionDetail": {
    color: "rgba(255,255,255,0.85)",
  },
  ".cm-completionDetail": {
    marginLeft: "0.75rem",
    fontStyle: "normal",
    color: "var(--text-muted)",
  },
  ".cm-completionInfo": { padding: "0.5rem 0.75rem", maxWidth: "18rem" },
  ".cm-diagnostic": {
    padding: "0.4rem 0.7rem",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy #dc2626",
    textDecorationThickness: "1px",
    textUnderlineOffset: "3px",
  },
  ".cm-gutter-lint": { width: "0.9rem" },
  ".cm-panels": {
    backgroundColor: "var(--surface-soft)",
    borderColor: "var(--border-soft)",
  },
});

const NARROW = "(max-width: 640px)";

export const ScriptEditor = forwardRef<ScriptEditorHandle, Props>(
  function ScriptEditor(
    { value, onChange, onFocusChange, data, current },
    ref,
  ) {
    const host = useRef<HTMLDivElement | null>(null);
    const view = useRef<EditorView | null>(null);
    const lastEdit = useRef(0);
    const shownInline = useRef<Diagnostic[]>([]);
    // Read by the editor's extensions, which outlive renders.
    const latest = useRef({ data, onChange, onFocusChange });
    useLayoutEffect(() => {
      latest.current = { data, onChange, onFocusChange };
    });

    useEffect(() => {
      const wrap = new Compartment();
      const narrow = window.matchMedia(NARROW);
      const format = (v: EditorView) => {
        const text = v.state.doc.toString();
        const next = formatScript(text);
        if (next !== text)
          v.dispatch({
            changes: minimalChange(text, next),
            userEvent: "format",
          });
        return true;
      };
      const getData = () => latest.current.data;
      const v = new EditorView({
        parent: host.current!,
        state: EditorState.create({
          doc: value,
          extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            lintGutter(),
            history(),
            drawSelection(),
            dropCursor(),
            bracketMatching(),
            closeBrackets(),
            highlightActiveLine(),
            highlightSelectionMatches(),
            scriptLanguage,
            scriptHighlight,
            autocompletion({
              override: [scriptCompletions(getData)],
              icons: true,
              activateOnTyping: true,
            }),
            // A tap is not a hover: on touch screens the card would cover the
            // text being typed.
            window.matchMedia("(hover: hover)").matches
              ? scriptHover(getData)
              : [],
            // Fixed tooltips drift on iOS while the page or keyboard moves.
            tooltips({ position: "absolute" }),
            keymap.of([
              { key: "Shift-Alt-f", run: format, preventDefault: true },
              { key: "Mod-Shift-f", run: format, preventDefault: true },
              { key: "Tab", run: acceptCompletion },
              ...closeBracketsKeymap,
              ...defaultKeymap,
              ...searchKeymap,
              ...historyKeymap,
              ...completionKeymap,
              ...lintKeymap,
              indentWithTab,
            ]),
            wrap.of(narrow.matches ? EditorView.lineWrapping : []),
            EditorView.contentAttributes.of({
              autocapitalize: "off",
              autocorrect: "off",
              spellcheck: "false",
              "aria-label": "Script",
            }),
            inlineErrors,
            inlineErrorTheme,
            EditorView.updateListener.of((u) => {
              if (u.docChanged) {
                lastEdit.current = Date.now();
                latest.current.onChange(u.state.doc.toString());
              }
              if (u.focusChanged)
                latest.current.onFocusChange?.(u.view.hasFocus);
            }),
            theme,
          ],
        }),
      });
      view.current = v;
      const onNarrow = () =>
        v.dispatch({
          effects: wrap.reconfigure(
            narrow.matches ? EditorView.lineWrapping : [],
          ),
        });
      narrow.addEventListener("change", onNarrow);
      return () => {
        narrow.removeEventListener("change", onNarrow);
        v.destroy();
        view.current = null;
      };
      // The editor owns the text after mount; `value` only seeds it.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Problems of the current text: underlined at once (that moves nothing),
    // and written under their lines once typing pauses, so lines do not
    // jump while a statement is half written.
    useEffect(() => {
      const v = view.current;
      if (!v || !current) return;
      const found = data.result?.diagnostics ?? [];
      v.dispatch(setDiagnostics(v.state, toCmDiagnostics(v.state.doc, found)));
      // Fixed problems go at once; new ones wait for the pause. (By message:
      // a line added above moves a problem without making it new.)
      const shown = new Set(shownInline.current.map((d) => d.message));
      const kept = found.filter((d) => shown.has(d.message));
      if (kept.length !== shownInline.current.length) {
        shownInline.current = kept;
        v.dispatch({ effects: setInlineErrors.of(kept) });
      }
      const wait = Math.max(
        0,
        INLINE_PAUSE_MS - (Date.now() - lastEdit.current),
      );
      const timer = setTimeout(() => {
        shownInline.current = found;
        view.current?.dispatch({ effects: setInlineErrors.of(found) });
      }, wait);
      return () => clearTimeout(timer);
    }, [data.result, current]);

    useImperativeHandle(ref, () => ({
      insert(text) {
        const v = view.current;
        if (!v) return;
        v.dispatch(v.state.replaceSelection(text), {
          scrollIntoView: true,
          userEvent: "input.type",
        });
        v.focus();
      },
      format() {
        const v = view.current;
        if (!v) return;
        const text = v.state.doc.toString();
        const next = formatScript(text);
        if (next !== text)
          v.dispatch({
            changes: minimalChange(text, next),
            userEvent: "format",
          });
      },
      replace(text) {
        const v = view.current;
        if (!v) return;
        v.dispatch({
          changes: { from: 0, to: v.state.doc.length, insert: text },
          selection: EditorSelection.cursor(0),
          scrollIntoView: true,
        });
      },
      goTo(line, col) {
        const v = view.current;
        if (!v) return;
        const l = v.state.doc.line(
          Math.min(Math.max(line, 1), v.state.doc.lines),
        );
        const pos = Math.min(l.from + col - 1, l.to);
        v.dispatch({
          selection: EditorSelection.cursor(pos),
          scrollIntoView: true,
        });
        v.focus();
      },
      reveal() {
        const v = view.current;
        if (!v) return;
        v.requestMeasure();
        v.dispatch({
          effects: EditorView.scrollIntoView(v.state.selection.main.head, {
            y: "center",
          }),
        });
      },
      undo: () => void (view.current && undo(view.current)),
      redo: () => void (view.current && redo(view.current)),
      complete: () => void (view.current && startCompletion(view.current)),
      toggleComment: () => void (view.current && toggleComment(view.current)),
      focus: () => view.current?.focus(),
      blur: () => view.current?.contentDOM.blur(),
    }));

    return <div ref={host} className="script-editor" />;
  },
);
