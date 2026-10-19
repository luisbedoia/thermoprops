import { describe, expect, it } from "vitest";
import { formatScript } from "../formatScript";
import { TEMPLATES } from "../templates";

describe("formatScript", () => {
  it("normalizes spacing", () => {
    expect(
      formatScript(
        "1:T=-10°C,x=0.5\n2s:from 1,isentropic to P=1.2MPa\na=( h1-h4 )/2*-3\nb = v1 ^ 1.3\nw [ Water ]: T = 50%, P=1 bar\nprint T1   in °F",
      ),
    ).toBe(
      [
        "1: T = -10 °C, x = 0.5",
        "2s: from 1, isentropic to P = 1.2 MPa",
        "a = (h1 - h4) / 2 * -3",
        "b = v1^1.3",
        "w [Water]: T = 50%, P = 1 bar",
        "print T1 in °F",
        "",
      ].join("\n"),
    );
  });

  it("aligns trailing comments in a block and collapses blank lines", () => {
    expect(
      formatScript(
        "\n\nfluid Water # the fluid\n1: T = 25 °C, P = 1 bar   #inlet\n\n\n\n#  note  \nprint h1\n\n",
      ),
    ).toBe(
      [
        "fluid Water              # the fluid",
        "1: T = 25 °C, P = 1 bar  # inlet",
        "",
        "# note",
        "print h1",
        "",
      ].join("\n"),
    );
  });

  it("keeps a line that does not tokenize and is idempotent", () => {
    const once = formatScript('fluid "R-410A"\na = 2 $ 3\ndraw 1->2->1');
    expect(once).toBe('fluid "R-410A"\na = 2 $ 3\ndraw 1 -> 2 -> 1\n');
    expect(formatScript(once)).toBe(once);
  });

  it.each(TEMPLATES.map((t) => [t.name, t.source]))(
    "leaves the %s template as it is",
    (_, source) => {
      expect(formatScript(source)).toBe(source);
    },
  );
});
