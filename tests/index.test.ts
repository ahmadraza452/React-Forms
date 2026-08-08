import { describe, expect, it } from "vitest";

import { useSmartForm, zodResolver } from "../src/index";

describe("react-smart-form public API", () => {
  it("exports the useSmartForm hook", () => {
    expect(typeof useSmartForm).toBe("function");
  });

  it("exports the zodResolver", () => {
    expect(typeof zodResolver).toBe("function");
  });

  it("has a working test environment", () => {
    expect(1 + 1).toBe(2);
  });
});
