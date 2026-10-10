import { beforeEach, describe, expect, it } from "vitest";
import { setCoolProp } from "../../coolprop";
import { fakeCoolProp, LIQUID_WATER } from "../../test-fixtures/fakeCoolProp";
import { validityError } from "../validity";

let water: ReturnType<ReturnType<typeof fakeCoolProp>["cp"]["fluid"]>["data"];

beforeEach(() => {
  const fake = fakeCoolProp();
  setCoolProp(fake.cp);
  water = fake.cp.fluid("Water").data;
});

describe("validityError", () => {
  it("accepts states inside the equation of state's range, its limits included", () => {
    expect(validityError(LIQUID_WATER, water, "celsius")).toBeNull();
    expect(
      validityError(
        { ...LIQUID_WATER, temperature: water.t_triple },
        water,
        "celsius",
      ),
    ).toBeNull();
    expect(
      validityError(
        { ...LIQUID_WATER, temperature: water.t_max },
        water,
        "celsius",
      ),
    ).toBeNull();
  });

  it("rejects temperatures and pressures past the limits, stating them in display units", () => {
    const hot = validityError(
      { ...LIQUID_WATER, temperature: 5273.15 },
      water,
      "celsius",
    );
    expect(hot).toMatch(
      /^Outside the range of Water's equation of state: T from 0\.01 °C to 1,?726\.85 °C, p up to 1,?000,?000 kPa\.$/,
    );
    expect(
      validityError({ ...LIQUID_WATER, pressure: 2e9 }, water, "kelvin"),
    ).toMatch(/T from 273\.16 K to 2,?000 K/);
    expect(
      validityError({ ...LIQUID_WATER, temperature: 250 }, water, "celsius"),
    ).not.toBeNull();
  });
});
