import { describe, expect, it } from "vitest";
import { evaluate } from "../../dsl/evaluate";
import { loadRealCoolProp } from "../../test-fixtures/realCoolProp";
import { updating, writeJson } from "../../test-fixtures/updateFixture";
import { SNAPSHOT, T1, cycleOf, cycleSource, domeBranch } from "../cycle";

async function solve() {
  const cp = await loadRealCoolProp();
  const d = cp
    .fluid("R134a")
    .diagram({ diagram: "temperature_entropy", dome_points: 48 });
  const result = evaluate(cycleSource(T1.initial), cp);
  expect(result.diagnostics).toEqual([]);
  return {
    dome: {
      liquid: domeBranch(d.dome.liquid),
      vapor: domeBranch(d.dome.vapor),
    },
    cycle: cycleOf(result),
  };
}

describe("the landing's cycle", () => {
  it("is drawn from what CoolProp gives", async () => {
    const solved = await solve();
    if (updating) writeJson(new URL("../cycle.json", import.meta.url), solved);
    expect(SNAPSHOT).toEqual(solved);
  });

  it("solves at every temperature the visitor may set", async () => {
    const cp = await loadRealCoolProp();
    for (const t of [T1.min, T1.initial, T1.max]) {
      const c = cycleOf(evaluate(cycleSource(t), cp));
      expect(c.states.map((s) => s.name)).toEqual(["1", "2", "3", "4"]);
      expect(c.paths).toHaveLength(4);
      expect(c.cop).toBeGreaterThan(1);
    }
  });
});
