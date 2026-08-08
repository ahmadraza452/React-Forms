import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSmartForm } from "../src/index";

const defaultValues = { name: "", email: "" };

function renderForm(values: typeof defaultValues = defaultValues) {
  return renderHook(() => useSmartForm({ defaultValues: values }));
}

describe("useSmartForm", () => {
  it("initializes values from a copy of defaultValues", () => {
    const { result } = renderForm();

    expect(result.current.getValues()).toEqual(defaultValues);
    expect(result.current.getValues()).not.toBe(defaultValues);
    expect(result.current.isDirty).toBe(false);
  });

  it("does not mutate the original defaultValues object", () => {
    const frozen = Object.freeze({ name: "", email: "" });
    const { result } = renderHook(() => useSmartForm({ defaultValues: frozen }));

    act(() => {
      result.current.setValue("email", "a@b.c");
    });

    expect(frozen).toEqual({ name: "", email: "" });
    expect(result.current.getValues()).toEqual({ name: "", email: "a@b.c" });
  });

  it("returns a fresh copy of values from getValues", () => {
    const { result } = renderForm();

    const first = result.current.getValues();
    const second = result.current.getValues();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("returns a single field value via getValue", () => {
    const { result } = renderForm();

    act(() => {
      result.current.setValue("email", "test@example.com");
    });

    expect(result.current.getValue("email")).toBe("test@example.com");
    expect(result.current.getValue("name")).toBe("");
  });

  it("updates a field via setValue and triggers a re-render", () => {
    const { result } = renderForm();

    expect(result.current.getValue("name")).toBe("");

    act(() => {
      result.current.setValue("name", "Ahmad");
    });

    expect(result.current.getValue("name")).toBe("Ahmad");
    expect(result.current.getValues()).toEqual({ name: "Ahmad", email: "" });
  });

  it("handles multiple fields independently", () => {
    const { result } = renderForm();

    act(() => {
      result.current.setValue("name", "Ahmad");
      result.current.setValue("email", "ahmad@example.com");
    });

    expect(result.current.getValues()).toEqual({ name: "Ahmad", email: "ahmad@example.com" });
  });

  it("tracks isDirty across changes and reset", () => {
    const { result } = renderForm();

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.setValue("email", "a@b.c");
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("is no longer dirty when a value is set back to its default", () => {
    const { result } = renderForm();

    act(() => {
      result.current.setValue("email", "a@b.c");
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.setValue("email", "");
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("restores the original default values via reset()", () => {
    const { result } = renderForm();

    act(() => {
      result.current.setValue("name", "Ahmad");
      result.current.setValue("email", "a@b.c");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.getValues()).toEqual(defaultValues);
    expect(result.current.isDirty).toBe(false);
  });

  it("uses provided values via reset(values) without mutating them", () => {
    const { result } = renderForm();
    const nextValues = { name: "Ahmad", email: "ahmad@example.com" };

    act(() => {
      result.current.reset(nextValues);
    });

    expect(result.current.getValues()).toEqual(nextValues);
    expect(result.current.getValues()).not.toBe(nextValues);
    expect(nextValues).toEqual({ name: "Ahmad", email: "ahmad@example.com" });
  });

  it("resets back to original defaults after reset(values)", () => {
    const { result } = renderForm();

    act(() => {
      result.current.reset({ name: "Ahmad", email: "ahmad@example.com" });
      result.current.reset();
    });

    expect(result.current.getValues()).toEqual(defaultValues);
  });

  it("keeps isDirty false after reset(values) matching the defaults", () => {
    const { result } = renderForm();

    act(() => {
      result.current.reset({ name: "", email: "" });
    });

    expect(result.current.getValues()).toEqual(defaultValues);
    expect(result.current.isDirty).toBe(false);
  });

  it("infers the shape from defaultValues without an explicit generic", () => {
    const { result } = renderHook(() =>
      useSmartForm({ defaultValues: { email: "", password: "" } }),
    );

    expect(result.current.getValues()).toEqual({ email: "", password: "" });

    act(() => {
      result.current.setValue("password", "secret");
    });
    expect(result.current.getValue("password")).toBe("secret");
  });

  it("supports object-typed fields (nested-ready)", () => {
    const profile = { name: "", age: 0 };
    const { result } = renderHook(() => useSmartForm({ defaultValues: { profile } }));

    act(() => {
      result.current.setValue("profile", { name: "Ahmad", age: 30 });
    });

    expect(result.current.getValue("profile")).toEqual({ name: "Ahmad", age: 30 });
    expect(profile).toEqual({ name: "", age: 0 });
    expect(result.current.isDirty).toBe(true);
  });
});
