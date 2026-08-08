import { describe, expect, it } from "vitest";

import { useSmartForm } from "../src/index";

describe("react-smart-form public API", () => {
  it("exports the useSmartForm hook", () => {
    expect(typeof useSmartForm).toBe("function");
  });

  it("has a working test environment", () => {
    expect(1 + 1).toBe(2);
  });
});
