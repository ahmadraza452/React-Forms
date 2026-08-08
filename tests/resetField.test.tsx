import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useSmartForm, type UseSmartFormReturn } from "../src/index";

interface FormValues {
  email: string;
  password: string;
}

const defaultValues: FormValues = { email: "", password: "" };

function setup() {
  const formRef: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

  function Harness() {
    const form = useSmartForm<FormValues>({
      defaultValues,
      validate: (values) => ({
        errors: values.email ? {} : { email: { message: "Email is required" } },
      }),
    });
    formRef.current = form;
    return (
      <form>
        <input data-testid="email" {...form.register("email")} />
        <input data-testid="password" {...form.register("password")} />
      </form>
    );
  }

  render(<Harness />);

  return { form: () => formRef.current as UseSmartFormReturn<FormValues> };
}

afterEach(() => {
  cleanup();
});

describe("resetField", () => {
  it("resets a single field to its default value", () => {
    const { form } = setup();

    act(() => {
      form().setValue("email", "test@example.com");
    });
    expect(form().getValue("email")).toBe("test@example.com");

    act(() => {
      form().resetField("email");
    });

    expect(form().getValue("email")).toBe("");
    expect(form().getValues()).toEqual(defaultValues);
  });

  it("clears the field error", async () => {
    const { form } = setup();

    await form().trigger();
    expect(form().errors.email).toEqual({ message: "Email is required" });

    act(() => {
      form().resetField("email");
    });

    expect(form().errors.email).toBeUndefined();
  });

  it("clears touched state", () => {
    const { form } = setup();

    fireEvent.blur(screen_email());
    expect(form().touchedFields.email).toBe(true);

    act(() => {
      form().resetField("email");
    });

    expect(form().touchedFields.email).toBe(false);
  });

  it("clears dirty state", () => {
    const { form } = setup();

    fireEvent.change(screen_email(), { target: { value: "a@b.c" } });
    expect(form().dirtyFields.email).toBe(true);
    expect(form().isDirty).toBe(true);

    act(() => {
      form().resetField("email");
    });

    expect(form().dirtyFields.email).toBe(false);
    expect(form().isDirty).toBe(false);
  });

  it("clears dirty state forced by shouldDirty", () => {
    const { form } = setup();

    act(() => {
      form().setValue("email", "", { shouldDirty: true });
    });
    expect(form().dirtyFields.email).toBe(true);

    act(() => {
      form().resetField("email");
    });

    expect(form().dirtyFields.email).toBe(false);
  });

  it("does not affect other fields", () => {
    const { form } = setup();

    fireEvent.change(screen_email(), { target: { value: "a@b.c" } });
    fireEvent.blur(screen_email());
    act(() => {
      form().setValue("password", "secret");
    });

    act(() => {
      form().resetField("email");
    });

    expect(form().getValue("password")).toBe("secret");
    expect(form().touchedFields.password).toBe(false);
    expect(form().dirtyFields.password).toBe(true);
  });

  it("keeps field state consistent with getFieldState", () => {
    const { form } = setup();

    fireEvent.change(screen_email(), { target: { value: "a@b.c" } });
    fireEvent.blur(screen_email());

    act(() => {
      form().resetField("email");
    });

    expect(form().getFieldState("email")).toEqual({
      value: "",
      touched: false,
      dirty: false,
      error: undefined,
      invalid: false,
    });
  });
});

function screen_email(): HTMLInputElement {
  // Local helper to keep the DOM reference without importing screen twice.
  return document.querySelector('[data-testid="email"]') as HTMLInputElement;
}
