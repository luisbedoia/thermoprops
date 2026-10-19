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
  nextSnippetField,
  startCompletion,
  type Completion,
} from "@codemirror/autocomplete";
import {
  cursorCharLeft,
  cursorLineDown,
  cursorLineUp,
  cursorCharRight,
  defaultKeymap,
  deleteCharBackward,
  insertNewlineAndIndent,
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
import {
  scriptCompletions,
  suggestionsAt,
  type CompletionData,
  type Suggestions,
} from "./completions";
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
  /** The screen top of `pos`'s line (the caret's, without `pos`). */
  lineTop(pos?: number): number | null;
  /** The caret's whole line on screen, every wrapped row of it. */
  lineBox(): { top: number; bottom: number } | null;

  undo(): void;
  redo(): void;
  complete(): void;
  toggleComment(): void;
  focus(): void;
  blur(): void;
  /** A key of the bar over the system keyboard. */
  key(key: KeypadKey): void;
  /** Applies the bar's suggestion at `index`. */
  suggest(index: number): void;
};

export type KeypadKey =
  "backspace" | "enter" | "left" | "right" | "up" | "down" | "next";

type Props = {
  value: string;
  onChange(value: string): void;
  onFocusChange?(focused: boolean): void;
  /** The last evaluation, and whether it is of the current text. */
  data: CompletionData;
  current: boolean;
  /**
   * The page's keypad types instead of the system keyboard (touch screens):
   * the editor never opens it (`inputmode="none"`), and completions go to
   * the keypad (`onSuggestions`) instead of a popup. Can change at any time.
   */
  keypad?: boolean;
  /** The keypad's suggestions, whenever the caret or the text moves. */
  onSuggestions?(suggestions: Suggestions | null): void;
  /**
   * Px at the bottom of the window covered by something fixed (the keypad):
   * the caret is kept clear of it when the editor itself scrolls it into
   * view (see also `onCaretMoved`, for when the page scrolls).
   */
  bottomInset?: number;
  /**
   * After the text, the caret or the height of the content changed, once
   * laid out; `typed` when the text or the layout changed (not only the
   * caret).
   */
  onCaretMoved?(typed: boolean): void;
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

/**
 * The editor on PlayStation's dark canvas (#121314): white text, its
 * translucent greys for secondary marks, PlayStation Blue for the caret,
 * the selection and the selected suggestion.
 */
const theme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "#121314",
      color: "#ffffff",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily:
        'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
      lineHeight: "1.6",
    },
    ".cm-content": { padding: "0.75rem 0", caretColor: "#53b1ff" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#53b1ff" },
    ".cm-line": { padding: "0 0.9rem 0 0.6rem" },
    ".cm-gutters": {
      backgroundColor: "#121314",
      color: "rgba(229, 229, 229, 0.55)",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "#181818" },
    ".cm-activeLineGutter": {
      backgroundColor: "#181818",
      color: "#ffffff",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection":
      {
        backgroundColor: "rgba(0, 112, 209, 0.45) !important",
      },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(83, 177, 255, 0.18)",
      outline: "1px solid rgba(83, 177, 255, 0.5)",
    },
    ".cm-selectionMatch": { backgroundColor: "rgba(83, 177, 255, 0.16)" },
    ".cm-tooltip": {
      border: "1px solid rgba(229, 229, 229, 0.16)",
      borderRadius: "8px",
      backgroundColor: "#181818",
      color: "#ffffff",
      // It floats over the code: the one shadow on this screen.
      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)",
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
      backgroundColor: "#0070d1",
      color: "#ffffff",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionDetail": {
      color: "rgba(255, 255, 255, 0.85)",
    },
    ".cm-completionDetail": {
      marginLeft: "0.75rem",
      fontStyle: "normal",
      color: "rgba(229, 229, 229, 0.6)",
    },
    ".cm-completionIcon": { opacity: "0.7" },
    ".cm-completionInfo": { padding: "0.5rem 0.75rem", maxWidth: "18rem" },
    ".cm-diagnostic": {
      padding: "0.4rem 0.7rem",
      fontFamily: '"Inter Variable", Inter, system-ui, sans-serif',
    },
    ".cm-diagnostic-error": { borderLeftColor: "#ff5c78" },
    ".cm-lintRange-error": {
      backgroundImage: "none",
      textDecoration: "underline wavy #ff5c78",
      textDecorationThickness: "1px",
      textUnderlineOffset: "3px",
    },
    ".cm-gutter-lint": { width: "0.9rem" },
    ".cm-panels": {
      backgroundColor: "#181818",
      color: "#ffffff",
      borderColor: "rgba(229, 229, 229, 0.16)",
    },
    ".cm-panels input, .cm-panels button": {
      color: "#ffffff",
      backgroundColor: "#26272b",
      border: "1px solid rgba(229, 229, 229, 0.2)",
      borderRadius: "4px",
    },
    ".cm-searchMatch": { backgroundColor: "rgba(83, 177, 255, 0.22)" },
    ".cm-searchMatch-selected": { backgroundColor: "rgba(0, 112, 209, 0.5)" },
  },
  { dark: true },
);

/**
 * Long lines wrap on narrow screens and on touch screens (tablets too):
 * sideways scrolling hides the start of lines and is awkward by touch.
 */
const NARROW = "(max-width: 640px), (pointer: coarse)";

/**
 * With the keypad: no system keyboard (`inputmode="none"` keeps the focus
 * and the caret) and no popup (the keypad shows the completions).
 */
function keypadExtensions(
  keypad: boolean,
  source: ReturnType<typeof scriptCompletions>,
) {
  return [
    completionPopup(!keypad, source),
    keypad ? EditorView.contentAttributes.of({ inputmode: "none" }) : [],
  ];
}

/** What the editor keeps the caret clear of when it scrolls it into view. */
function scrollMargins(bottom: number) {
  return EditorView.scrollMargins.of(() => ({ bottom }));
}

/** The popup of completions; with the keypad it shows them instead. */
function completionPopup(
  enabled: boolean,
  source: ReturnType<typeof scriptCompletions>,
) {
  return autocompletion({
    override: [source],
    icons: true,
    activateOnTyping: enabled,
  });
}

function applyCompletion(
  view: EditorView,
  option: Completion,
  from: number,
  to: number,
) {
  if (typeof option.apply === "function") {
    option.apply(view, option, from, to);
    return;
  }
  const insert = option.apply ?? option.label;
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.cursor(from + insert.length),
    scrollIntoView: true,
    userEvent: "input.complete",
  });
}

export const ScriptEditor = forwardRef<ScriptEditorHandle, Props>(
  function ScriptEditor(
    {
      value,
      onChange,
      onFocusChange,
      data,
      current,
      keypad = false,
      onSuggestions,
      bottomInset = 0,
      onCaretMoved,
    },
    ref,
  ) {
    const host = useRef<HTMLDivElement | null>(null);
    const view = useRef<EditorView | null>(null);
    const lastEdit = useRef(0);
    const shownInline = useRef<Diagnostic[]>([]);
    // Read by the editor's extensions, which outlive renders.
    const latest = useRef({
      data,
      onChange,
      onFocusChange,
      onSuggestions,
      keypad,
      onCaretMoved,
    });
    useLayoutEffect(() => {
      latest.current = {
        data,
        onChange,
        onFocusChange,
        onSuggestions,
        keypad,
        onCaretMoved,
      };
    });
    const keypadMode = useRef(new Compartment());
    const margins = useRef(new Compartment());
    const source = useRef(scriptCompletions(() => latest.current.data));
    const suggestions = useRef<Suggestions | null>(null);
    const frame = useRef(0);
    const settleTimer = useRef(0);
    const caretFrame = useRef(0);
    /** Recomputes the bar's suggestions on the next frame. */
    /** What the bar shows now, to skip a render for the same suggestions. */
    const shownSuggestions = useRef("");
    /**
     * Recomputes the bar's suggestions: on the next frame after an edit, or
     * once the caret rests (`settle` ms) when only the caret moved, as it
     * does continuously while dragged across the text.
     */
    const refreshSuggestions = (settle = 0) => {
      cancelAnimationFrame(frame.current);
      clearTimeout(settleTimer.current);
      const run = () => {
        const v = view.current;
        if (!v || !latest.current.keypad) return;
        const next = v.hasFocus ? suggestionsAt(v.state, source.current) : null;
        suggestions.current = next;
        const key = next
          ? `${next.from}|${next.to}|${next.options.map((o) => `${o.label}:${o.detail ?? ""}`).join(",")}`
          : "";
        if (key === shownSuggestions.current) return;
        shownSuggestions.current = key;
        latest.current.onSuggestions?.(next);
      };
      if (settle) settleTimer.current = window.setTimeout(run, settle);
      else frame.current = requestAnimationFrame(run);
    };

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
            keypadMode.current.of(keypadExtensions(keypad, source.current)),
            margins.current.of(scrollMargins(bottomInset)),
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
              "aria-label": "Worksheet code",
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
              // The caret's line may also move with no edit: an error
              // message appearing under a line above it, a line wrapping.
              if (
                (u.docChanged || u.selectionSet || u.heightChanged) &&
                latest.current.onCaretMoved
              ) {
                // Next frame, once laid out (positions cannot be read
                // inside CodeMirror's own measure cycle).
                const typed = u.docChanged || u.heightChanged;
                cancelAnimationFrame(caretFrame.current);
                caretFrame.current = requestAnimationFrame(() =>
                  latest.current.onCaretMoved?.(typed),
                );
              }
              if (u.docChanged || u.focusChanged) refreshSuggestions();
              else if (u.selectionSet) refreshSuggestions(150);
            }),
            theme,
          ],
        }),
      });
      view.current = v;
      // The scroller is itself focusable in some browsers (Chrome's
      // focusable scroll containers): a tap could leave the focus there, on
      // no text, and typing would go nowhere. Hand it to the text, keeping
      // the selection.
      const toContent = () => v.contentDOM.focus({ preventScroll: true });
      v.scrollDOM.addEventListener("focus", toContent);
      const onNarrow = () =>
        v.dispatch({
          effects: wrap.reconfigure(
            narrow.matches ? EditorView.lineWrapping : [],
          ),
        });
      narrow.addEventListener("change", onNarrow);
      return () => {
        cancelAnimationFrame(frame.current);
        clearTimeout(settleTimer.current);
        cancelAnimationFrame(caretFrame.current);
        narrow.removeEventListener("change", onNarrow);
        v.scrollDOM.removeEventListener("focus", toContent);
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

    // The keypad showed, hid or resized.
    useEffect(() => {
      view.current?.dispatch({
        effects: margins.current.reconfigure(scrollMargins(bottomInset)),
      });
    }, [bottomInset]);

    // The keypad turned on or off.
    useEffect(() => {
      const v = view.current;
      if (!v) return;
      v.dispatch({
        effects: keypadMode.current.reconfigure(
          keypadExtensions(keypad, source.current),
        ),
      });
      refreshSuggestions();
    }, [keypad]);

    // New values for the suggestions' details. (refreshSuggestions reads only
    // refs.)
    useEffect(() => {
      refreshSuggestions();
    }, [data.result]);

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
      lineTop(pos) {
        const v = view.current;
        if (!v) return null;
        const at = pos ?? v.state.selection.main.head;
        return v.coordsAtPos(Math.min(at, v.state.doc.length))?.top ?? null;
      },
      lineBox() {
        const v = view.current;
        if (!v) return null;
        const head = v.state.selection.main.head;
        // The line's element on screen: always laid out as shown (the
        // editor's own height map can lag behind a line just added).
        const { node } = v.domAtPos(head);
        const el = (
          node instanceof Element ? node : node.parentElement
        )?.closest(".cm-line");
        if (el) {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom };
        }
        const block = v.lineBlockAt(head);
        return {
          top: v.documentTop + block.top,
          bottom: v.documentTop + block.bottom,
        };
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
      key(key) {
        const v = view.current;
        if (!v) return;
        const command = {
          backspace: deleteCharBackward,
          enter: insertNewlineAndIndent,
          left: cursorCharLeft,
          right: cursorCharRight,
          up: cursorLineUp,
          down: cursorLineDown,
          // Next field of a snippet, else the end of the line.
          next: (target: EditorView) =>
            nextSnippetField(target) ||
            (target.dispatch({
              selection: EditorSelection.cursor(
                target.state.doc.lineAt(target.state.selection.main.head).to,
              ),
              scrollIntoView: true,
            }),
            true),
        }[key];
        command(v);
      },
      suggest(index) {
        const v = view.current;
        const s = suggestions.current;
        const option = s?.options[index];
        if (!v || !s || !option) return;
        applyCompletion(v, option, s.from, s.to);
      },
    }));

    return <div ref={host} className="script-editor" />;
  },
);
