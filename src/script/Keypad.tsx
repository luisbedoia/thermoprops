import { useRef, useState } from "react";
import {
  ArrowBigUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CornerDownLeft,
  Delete,
  Undo2,
} from "lucide-react";
import type { Suggestions } from "../dsl/editor/completions";
import type { KeypadKey } from "../dsl/editor/ScriptEditor";
import { useTap } from "./useTap";

export type KeypadAction =
  | { kind: "insert"; text: string }
  | { kind: "key"; key: KeypadKey }
  | { kind: "suggest"; index: number }
  | { kind: "undo" | "done" };

type Props = {
  suggestions: Suggestions | null;
  onAction(action: KeypadAction): void;
  /** The keypad's box (to know its height). */
  ref?: React.Ref<HTMLDivElement>;
  /** Where it sits (a tablet's code column). */
  style?: React.CSSProperties;
};

type Layer = "123" | "abc";

type Key = {
  label: React.ReactNode;
  /** An action, a change of layer or case, or the space bar (a trackpad). */
  action:
    | KeypadAction
    | { kind: "layer"; to: Layer }
    | { kind: "shift" }
    | { kind: "space" };
  /** For screen readers, when the label is a symbol or an icon. */
  aria?: string;
  /** Repeats while held, like a keyboard's backspace. */
  repeat?: boolean;
  tone?: "fn" | "accent";
  /** Width in grid columns. */
  span?: number;
};

const ins = (text: string, label: string = text, aria?: string): Key => ({
  label,
  aria,
  action: { kind: "insert", text },
});
const move = (key: KeypadKey, label: React.ReactNode, aria: string): Key => ({
  label,
  aria,
  action: { kind: "key", key },
  repeat: true,
  tone: "fn",
});

const BACKSPACE: Key = {
  label: <Delete />,
  aria: "Delete",
  action: { kind: "key", key: "backspace" },
  repeat: true,
  tone: "fn",
};
const ENTER: Key = {
  label: <CornerDownLeft />,
  aria: "New line",
  action: { kind: "key", key: "enter" },
  tone: "fn",
};
const SPACE = (span: number): Key => ({
  label: "space",
  aria: "Space (hold or slide to move the cursor)",
  action: { kind: "space" },
  tone: "fn",
  span,
});

/** Numbers, the language's symbols and the arrows: 6 columns. */
const NUMBERS: Key[] = [
  ins("7"),
  ins("8"),
  ins("9"),
  ins("("),
  ins(")"),
  BACKSPACE,
  ins("4"),
  ins("5"),
  ins("6"),
  ins(" + ", "+", "plus"),
  ins(" - ", "-", "minus"),
  ins(" -> ", "->", "arrow"),
  ins("1"),
  ins("2"),
  ins("3"),
  ins(" * ", "*", "times"),
  ins(" / ", "/", "divided by"),
  ins(" = ", "=", "equals"),
  ins("0"),
  ins("."),
  ins(", ", ",", "comma"),
  ins(": ", ":", "colon"),
  {
    label: "⇥",
    aria: "Next field",
    action: { kind: "key", key: "next" },
    tone: "fn",
  },
  ENTER,
  {
    label: "ABC",
    aria: "Letters",
    action: { kind: "layer", to: "abc" },
    tone: "fn",
  },
  SPACE(1),
  move("left", <ArrowLeft />, "Left"),
  move("up", <ArrowUp />, "Up"),
  move("down", <ArrowDown />, "Down"),
  move("right", <ArrowRight />, "Right"),
];

const letters = (row: string) => [...row].map((c) => ins(c));

/** Letters (QWERTY): 10 columns. */
const LETTERS: Key[] = [
  ...letters("qwertyuiop"),
  ...letters("asdfghjkl"),
  ins("_", "_", "underscore"),
  {
    label: <ArrowBigUp />,
    aria: "Shift",
    action: { kind: "shift" },
    tone: "fn",
  },
  ...letters("zxcvbnm"),
  ins("#", "#", "comment"),
  { ...BACKSPACE },
  {
    label: "123",
    aria: "Numbers",
    action: { kind: "layer", to: "123" },
    tone: "fn",
    span: 2,
  },
  ins("^", "^", "power"),
  SPACE(5),
  { ...ENTER, span: 2 },
];

/** Px of sliding per caret step: across (a character), down (a line). */
const STEP_X = 9;
const STEP_Y = 22;
/** Holding the space bar this long turns it into a trackpad. */
const HOLD_MS = 350;

/**
 * The space bar: a tap types a space; holding it, or sliding from it, moves
 * the caret like a trackpad (sideways by characters, up and down by lines),
 * as the space bar of a phone's keyboard does.
 */
function useSpaceBar(
  onAction: (a: KeypadAction) => void,
  setTrackpad: (on: boolean) => void,
) {
  const s = useRef<{
    x: number;
    y: number;
    pad: boolean;
    hold?: number;
  } | null>(null);
  const step = (key: KeypadKey) => onAction({ kind: "key", key });
  const end = () => {
    if (s.current?.hold) clearTimeout(s.current.hold);
    s.current = null;
    setTrackpad(false);
  };
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      const state = { x: t.clientX, y: t.clientY, pad: false, hold: 0 };
      state.hold = window.setTimeout(() => {
        state.pad = true;
        setTrackpad(true);
      }, HOLD_MS);
      s.current = state;
    },
    onTouchMove: (e: React.TouchEvent) => {
      const state = s.current;
      if (!state) return;
      const t = e.touches[0];
      let dx = t.clientX - state.x;
      let dy = t.clientY - state.y;
      if (!state.pad && Math.hypot(dx, dy) > 10) {
        clearTimeout(state.hold);
        state.pad = true;
        setTrackpad(true);
      }
      if (!state.pad) return;
      while (Math.abs(dx) >= STEP_X) {
        step(dx > 0 ? "right" : "left");
        state.x += Math.sign(dx) * STEP_X;
        dx = t.clientX - state.x;
      }
      while (Math.abs(dy) >= STEP_Y) {
        step(dy > 0 ? "down" : "up");
        state.y += Math.sign(dy) * STEP_Y;
        dy = t.clientY - state.y;
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const pad = s.current?.pad;
      const had = s.current !== null;
      end();
      // Keeps the focus where it is (see useTap); a tap types the space.
      if (e.cancelable) e.preventDefault();
      if (had && !pad) onAction({ kind: "insert", text: " " });
    },
    onTouchCancel: end,
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    // Mouse, keyboard, or a touch whose end could not be cancelled.
    onClick: (e: React.MouseEvent) => {
      if (e.detail === 0 || !("ontouchstart" in window)) {
        onAction({ kind: "insert", text: " " });
      }
    },
  };
}

/**
 * The page's own keyboard on touch screens, in the manner of Desmos: the
 * system keyboard is never used (the editor has `inputmode="none"`), so
 * nothing resizes, scrolls or moves the focus under the editor while typing.
 * On top, the suggestions for the caret (a state's properties and processes,
 * "h1" and the like, units after a number, statements on an empty line), with undo
 * and close; below, numbers, symbols and arrows, or letters (ABC). The space
 * bar is also a trackpad for the caret.
 */
export function Keypad({ suggestions, onAction, ref, style }: Props) {
  const tap = useTap();
  const [layer, setLayer] = useState<Layer>("123");
  // One-shot capital, like a phone keyboard's shift.
  const [shift, setShift] = useState(false);
  const [trackpad, setTrackpad] = useState(false);
  const space = useSpaceBar(onAction, setTrackpad);

  const run = (key: Key) => () => {
    const a = key.action;
    if (a.kind === "layer") {
      setLayer(a.to);
      setShift(false);
    } else if (a.kind === "shift") {
      setShift((on) => !on);
    } else if (a.kind === "space") {
      onAction({ kind: "insert", text: " " });
    } else if (a.kind === "insert" && shift && /^[a-z]$/.test(a.text)) {
      onAction({ kind: "insert", text: a.text.toUpperCase() });
      setShift(false);
    } else {
      onAction(a);
    }
  };

  const keys = layer === "123" ? NUMBERS : LETTERS;
  const chips = suggestions?.options ?? [];
  return (
    <div
      ref={ref}
      style={style}
      className={`keypad keypad--${layer}${trackpad ? " is-trackpad" : ""}`}
      role="toolbar"
      aria-label="Worksheet keypad"
    >
      <div className="keypad__top">
        <div className="keypad__suggestions" aria-label="Suggestions">
          {chips.length === 0 ? (
            <span className="keypad__hint">
              Suggestions appear here as you type
            </span>
          ) : (
            chips.map((c, i) => (
              <button
                key={`${c.label}-${i}`}
                type="button"
                className="keypad__chip"
                {...tap(() => onAction({ kind: "suggest", index: i }))}
              >
                <span className="keypad__chip-label">{c.label}</span>
                {c.detail && (
                  <span className="keypad__chip-detail">{c.detail}</span>
                )}
              </button>
            ))
          )}
        </div>
        <button
          type="button"
          className="keypad__key keypad__key--fn keypad__side"
          aria-label="Undo"
          {...tap(() => onAction({ kind: "undo" }))}
        >
          <Undo2 />
        </button>
        <button
          type="button"
          className="keypad__key keypad__key--accent keypad__side"
          aria-label="Close keypad"
          {...tap(() => onAction({ kind: "done" }))}
        >
          <ChevronDown />
        </button>
      </div>
      {trackpad && (
        <div className="keypad__trackpad-hint" aria-live="polite">
          Slide to move the cursor
        </div>
      )}
      <div className="keypad__grid">
        {keys.map((k, i) => {
          const isLetter =
            k.action.kind === "insert" && /^[a-z]$/.test(k.action.text);
          const isSpace = k.action.kind === "space";
          return (
            <button
              key={`${layer}-${i}`}
              type="button"
              aria-label={k.aria}
              aria-pressed={k.action.kind === "shift" ? shift : undefined}
              className={[
                "keypad__key",
                k.tone && `keypad__key--${k.tone}`,
                isSpace && "keypad__space",
                k.action.kind === "shift" && shift && "is-on",
              ]
                .filter(Boolean)
                .join(" ")}
              style={k.span ? { gridColumn: `span ${k.span}` } : undefined}
              {...(isSpace ? space : tap(run(k), { repeat: k.repeat }))}
            >
              {isLetter && shift && typeof k.label === "string"
                ? k.label.toUpperCase()
                : k.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
