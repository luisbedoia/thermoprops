import { ChevronDown, Redo2, Sparkles, Undo2 } from "lucide-react";

/** What phone keyboards hide behind a second or third layer. */
const KEYS = [
  "->",
  "=",
  ".",
  ",",
  "(",
  ")",
  "°C",
  "+",
  "-",
  "*",
  "/",
  "^",
  "[",
  "]",
];

export type SymbolAction =
  | { kind: "insert"; text: string }
  | { kind: "complete" | "comment" | "undo" | "redo" | "done" };

type Props = {
  onAction(action: SymbolAction): void;
};

/**
 * A row of keys under the editor while it is edited on a phone, so right
 * above the on-screen keyboard. Pressing a key keeps the focus (and the
 * keyboard) in the editor.
 */
export function SymbolBar({ onAction }: Props) {
  const press = (action: SymbolAction) => ({
    onPointerDown: (e: React.PointerEvent) => e.preventDefault(),
    onClick: () => onAction(action),
  });
  return (
    <div className="symbol-bar" role="toolbar" aria-label="Symbols">
      <div className="symbol-bar__keys">
        <button
          type="button"
          aria-label="Suggest"
          {...press({ kind: "complete" })}
        >
          <Sparkles />
        </button>
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            {...press({ kind: "insert", text: k === "->" ? " -> " : k })}
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          aria-label="Comment line"
          {...press({ kind: "comment" })}
        >
          #
        </button>
        <button type="button" aria-label="Undo" {...press({ kind: "undo" })}>
          <Undo2 />
        </button>
        <button type="button" aria-label="Redo" {...press({ kind: "redo" })}>
          <Redo2 />
        </button>
      </div>
      <button
        type="button"
        className="symbol-bar__done"
        aria-label="Hide keyboard"
        {...press({ kind: "done" })}
      >
        <ChevronDown />
      </button>
    </div>
  );
}
