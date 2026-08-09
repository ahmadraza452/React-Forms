import { describe, expect, it } from "vitest";

import { Controller, useSmartForm, useWatch, zodResolver } from "../src/index";

describe("@ahmad231/react-formkit public API", () => {
  it("exports the useSmartForm hook", () => {
    expect(typeof useSmartForm).toBe("function");
  });

  it("exports the zodResolver", () => {
    expect(typeof zodResolver).toBe("function");
  });

  it("exports the Controller component and useWatch hook", () => {
    expect(typeof Controller).toBe("function");
    expect(typeof useWatch).toBe("function");
  });

  it("has a working test environment", () => {
    expect(1 + 1).toBe(2);
  });
});
