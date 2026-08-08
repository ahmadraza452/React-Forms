import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useSmartForm, type UseSmartFormReturn } from "../src/index";

interface FormValues {
  name: string;
  email: string;
  age: number;
  password: string;
  description: string;
  country: string;
}

const defaultValues: FormValues = {
  name: "",
  email: "",
  age: 0,
  password: "",
  description: "",
  country: "",
};

function setup() {
  const formRef: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

  function Harness() {
    const form = useSmartForm({ defaultValues });
    formRef.current = form;

    return (
      <form>
        <input data-testid="name" {...form.register("name")} />
        <input data-testid="email" type="email" {...form.register("email")} />
        <input data-testid="age" type="number" {...form.register("age")} />
        <input data-testid="password" type="password" {...form.register("password")} />
        <textarea data-testid="description" {...form.register("description")} />
        <select data-testid="country" {...form.register("country")}>
          <option value="">Select</option>
          <option value="us">United States</option>
          <option value="ca">Canada</option>
        </select>
      </form>
    );
  }

  render(<Harness />);

  return { form: () => formRef.current as UseSmartFormReturn<FormValues> };
}

afterEach(() => {
  cleanup();
});

describe("register", () => {
  it("registers a field with the correct name and initial value", () => {
    const { form } = setup();

    const name = screen.getByTestId("name") as HTMLInputElement;
    expect(name.getAttribute("name")).toBe("name");
    expect(name.value).toBe("");
    expect(form().getValue("name")).toBe("");
  });

  it("renders the current value in the input", () => {
    const { form } = setup();

    act(() => {
      form().setValue("email", "initial@example.com");
    });

    expect((screen.getByTestId("email") as HTMLInputElement).value).toBe("initial@example.com");
  });

  it("updates form state when a text input changes", () => {
    const { form } = setup();

    fireEvent.change(screen.getByTestId("email"), { target: { value: "hello@example.com" } });

    expect(form().getValue("email")).toBe("hello@example.com");
    expect((screen.getByTestId("email") as HTMLInputElement).value).toBe("hello@example.com");
    expect(form().getValues()).toEqual({ ...defaultValues, email: "hello@example.com" });
  });

  it("updates form state when a textarea changes", () => {
    const { form } = setup();

    fireEvent.change(screen.getByTestId("description"), { target: { value: "Long text" } });

    expect(form().getValue("description")).toBe("Long text");
    expect((screen.getByTestId("description") as HTMLTextAreaElement).value).toBe("Long text");
  });

  it("updates form state when a select changes", () => {
    const { form } = setup();

    fireEvent.change(screen.getByTestId("country"), { target: { value: "us" } });

    expect(form().getValue("country")).toBe("us");
    expect((screen.getByTestId("country") as HTMLSelectElement).value).toBe("us");
  });

  it("stores number input values as numbers", () => {
    const { form } = setup();

    fireEvent.change(screen.getByTestId("age"), { target: { value: "42" } });

    expect(form().getValue("age")).toBe(42);
    expect((screen.getByTestId("age") as HTMLInputElement).value).toBe("42");
  });

  it("stores NaN when a number input is cleared and displays an empty string", () => {
    const { form } = setup();

    fireEvent.change(screen.getByTestId("age"), { target: { value: "42" } });
    fireEvent.change(screen.getByTestId("age"), { target: { value: "" } });

    expect(Number.isNaN(form().getValue("age"))).toBe(true);
    expect((screen.getByTestId("age") as HTMLInputElement).value).toBe("");
  });

  it("marks a field as touched on blur", () => {
    const { form } = setup();

    expect(form().touchedFields.email).toBe(false);

    fireEvent.blur(screen.getByTestId("email"));

    expect(form().touchedFields.email).toBe(true);
    expect(form().touchedFields.name).toBe(false);
  });

  it("tracks dirty fields and isDirty consistently", () => {
    const { form } = setup();

    expect(form().dirtyFields.email).toBe(false);
    expect(form().isDirty).toBe(false);

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });

    expect(form().dirtyFields.email).toBe(true);
    expect(form().dirtyFields.name).toBe(false);
    expect(form().isDirty).toBe(true);

    fireEvent.change(screen.getByTestId("email"), { target: { value: "" } });

    expect(form().dirtyFields.email).toBe(false);
    expect(form().isDirty).toBe(false);
  });

  it("updates one field without affecting other fields", () => {
    const { form } = setup();

    fireEvent.change(screen.getByTestId("name"), { target: { value: "Ahmad" } });

    expect(form().getValue("name")).toBe("Ahmad");
    expect(form().getValue("email")).toBe("");
    expect(form().getValue("password")).toBe("");
    expect(form().getValue("age")).toBe(0);
    expect(form().getValues()).toEqual({ ...defaultValues, name: "Ahmad" });
  });

  it("resets registered fields and all form state", () => {
    const { form } = setup();

    fireEvent.change(screen.getByTestId("name"), { target: { value: "Ahmad" } });
    fireEvent.blur(screen.getByTestId("name"));
    expect(form().isDirty).toBe(true);

    act(() => {
      form().reset();
    });

    expect((screen.getByTestId("name") as HTMLInputElement).value).toBe("");
    expect(form().getValue("name")).toBe("");
    expect(form().isDirty).toBe(false);
    expect(form().dirtyFields.name).toBe(false);
    expect(form().touchedFields.name).toBe(false);
  });

  it("keeps registered inputs in sync after reset(values)", () => {
    const { form } = setup();

    act(() => {
      form().reset({ ...defaultValues, name: "Ahmad", email: "ahmad@example.com" });
    });

    expect((screen.getByTestId("name") as HTMLInputElement).value).toBe("Ahmad");
    expect((screen.getByTestId("email") as HTMLInputElement).value).toBe("ahmad@example.com");
    expect(form().touchedFields.name).toBe(false);
  });

  it("returns field state via getFieldState", () => {
    const { form } = setup();

    expect(form().getFieldState("email")).toEqual({
      value: "",
      touched: false,
      dirty: false,
      error: undefined,
      invalid: false,
    });

    fireEvent.change(screen.getByTestId("email"), { target: { value: "a@b.c" } });
    fireEvent.blur(screen.getByTestId("email"));

    expect(form().getFieldState("email")).toEqual({
      value: "a@b.c",
      touched: true,
      dirty: true,
      error: undefined,
      invalid: false,
    });
  });

  it("lets users override handlers after spread without interference", () => {
    const calls: string[] = [];
    const formRef: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

    function Harness() {
      const form = useSmartForm({ defaultValues });
      formRef.current = form;

      return (
        <input
          data-testid="override"
          {...form.register("email")}
          onChange={(event) => {
            calls.push(event.target.value);
          }}
        />
      );
    }

    render(<Harness />);

    fireEvent.change(screen.getByTestId("override"), { target: { value: "ignored" } });

    expect(calls).toEqual(["ignored"]);
    expect(formRef.current?.getValue("email")).toBe("");
  });
});
