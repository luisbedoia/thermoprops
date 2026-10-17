import { describe, expect, it } from "vitest";
import { formatScript } from "../formatScript";
import { TEMPLATES } from "../templates";

describe("formatScript", () => {
  it("normalizes spacing", () => {
    expect(
      formatScript(
        "state 1:T=-10°C,x=1\nstate 2s=1->isentropic( P=1.2MPa )\nlet a=( 1.h-4.h )/2*-3\nlet b = 1.v ^ 1.3\nstate w [ Water ]: T = 50%, P=1 bar",
      ),
    ).toBe(
      [
        "state 1: T = -10 °C, x = 1",
        "state 2s = 1 -> isentropic(P = 1.2 MPa)",
        "let a = (1.h - 4.h) / 2 * -3",
        "let b = 1.v^1.3",
        "state w [Water]: T = 50%, P = 1 bar",
        "",
      ].join("\n"),
    );
  });

  it("aligns trailing comments in a block and collapses blank lines", () => {
    expect(
      formatScript(
        "\n\nfluid Water # the fluid\nstate 1: T = 25 °C, P = 1 bar   #inlet\n\n\n\n#  note  \nprint 1.h\n\n",
      ),
    ).toBe(
      [
        "fluid Water                    # the fluid",
        "state 1: T = 25 °C, P = 1 bar  # inlet",
        "",
        "# note",
        "print 1.h",
        "",
      ].join("\n"),
    );
  });

  it("keeps a line that does not tokenize and is idempotent", () => {
    const once = formatScript('fluid "R-410A"\nlet a = 2 $ 3\ncycle 1->2->1');
    expect(once).toBe('fluid "R-410A"\nlet a = 2 $ 3\ncycle 1 -> 2 -> 1\n');
    expect(formatScript(once)).toBe(once);
  });

  it.each(TEMPLATES.map((t) => [t.name, t.source]))(
    "leaves the %s template as it is",
    (_, source) => {
      expect(formatScript(source)).toBe(source);
    },
  );
});
