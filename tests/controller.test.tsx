import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  Controller,
  useSmartForm,
  type ControllerRenderProps,
  type FieldError,
  type UseSmartFormReturn,
  type ValidationMode,
} from "../src/index";

interface FormValues {
  email: string;
}

const defaultValues: FormValues = { email: "" };

type LastRender = ControllerRenderProps<FormValues, "email">;

interface SetupOptions {
  mode?: ValidationMode;
  validate?: (values: FormValues) => { errors: Partial<Record<keyof FormValues, FieldError>> };
}

function setup(options: SetupOptions = {}) {
  const formRef: { current: UseSmartFormReturn<FormValues> | null } = { current: null };
  let lastRender: LastRender | undefined;

  function Harness() {
    const formOptions: Parameters<typeof useSmartForm<FormValues>>[0] = {
      defaultValues,
      ...(options.validate !== undefined && {
        validate: options.validate as (
          values: FormValues,
        ) => ReturnType<NonNullable<typeof options.validate>>,
      }),
      ...(options.mode !== undefined && { mode: options.mode }),
    };
    const form = useSmartForm(formOptions);
    formRef.current = form;

    return (
      <Controller<FormValues, "email">
        control={form.control}
        name="email"
        render={(props) => {
          lastRender = props;
          return (
            <>
              <input
                data-testid="custom"
                value={props.field.value}
                onChange={(event) => props.field.onChange(event.target.value)}
                onBlur={props.field.onBlur}
              />
              {props.fieldState.error && (
                <span data-testid="error">{props.fieldState.error.message}</span>
              )}
            </>
          );
        }}
      />
    );
  }

  render(<Harness />);

  return {
    form: () => formRef.current as UseSmartFormReturn<FormValues>,
    lastRender: () => lastRender as LastRender,
  };
}

afterEach(() => {
  cleanup();
});

describe("Controller", () => {
  it("renders the controlled value from the form", () => {
    const { form } = setup();

    expect((screen.getByTestId("custom") as HTMLInputElement).value).toBe("");

    act(() => {
      form().setValue("email", "initial@example.com");
    });

    expect((screen.getByTestId("custom") as HTMLInputElement).value).toBe("initial@example.com");
  });

  it("updates form state via field.onChange with a raw value", () => {
    const { form } = setup();

    fireEvent.change(screen.getByTestId("custom"), { target: { value: "a@b.c" } });

    expect(form().getValue("email")).toBe("a@b.c");
    expect(form().watch("email")).toBe("a@b.c");
    expect(form().getFieldState("email").value).toBe("a@b.c");
  });

  it("marks the field as touched via field.onBlur", () => {
    const { form } = setup();

    expect(form().touchedFields.email).toBe(false);

    fireEvent.blur(screen.getByTestId("custom"));

    expect(form().touchedFields.email).toBe(true);
    expect(form().getFieldState("email").touched).toBe(true);
  });

  it("updates dirty and touched state reactively in fieldState", () => {
    const { lastRender } = setup();

    expect(lastRender().fieldState.dirty).toBe(false);
    expect(lastRender().fieldState.touched).toBe(false);

    fireEvent.change(screen.getByTestId("custom"), { target: { value: "a@b.c" } });
    expect(lastRender().fieldState.dirty).toBe(true);

    fireEvent.blur(screen.getByTestId("custom"));
    expect(lastRender().fieldState.touched).toBe(true);
  });

  it("exposes the field props", () => {
    const { lastRender } = setup();

    expect(lastRender().field.name).toBe("email");
    expect(typeof lastRender().field.onChange).toBe("function");
    expect(typeof lastRender().field.onBlur).toBe("function");
    expect(typeof lastRender().field.ref).toBe("function");
  });

  it("validates on blur when mode is onBlur", async () => {
    const validate = (values: FormValues) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    });

    setup({ validate, mode: "onBlur" });

    expect(screen.queryByTestId("error")).toBeNull();

    fireEvent.change(screen.getByTestId("custom"), { target: { value: "" } });
    await act(async () => {});
    expect(screen.queryByTestId("error")).toBeNull();

    fireEvent.blur(screen.getByTestId("custom"));
    await act(async () => {});

    expect(screen.getByTestId("error").textContent).toBe("Email is required");
  });

  it("updates the error state reactively after trigger", async () => {
    const validate = (values: FormValues) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    });

    const { form, lastRender } = setup({ validate });

    expect(lastRender().fieldState.invalid).toBe(false);

    await form().trigger();

    expect(lastRender().fieldState.invalid).toBe(true);
    expect(lastRender().fieldState.error).toEqual({ message: "Email is required" });
    expect(screen.getByTestId("error").textContent).toBe("Email is required");
  });

  it("clears the error reactively when the value becomes valid", async () => {
    const validate = (values: FormValues) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    });

    const { form } = setup({ validate });

    await form().trigger();
    expect(screen.queryByTestId("error")).not.toBeNull();

    fireEvent.change(screen.getByTestId("custom"), { target: { value: "valid@example.com" } });
    await form().trigger();

    expect(screen.queryByTestId("error")).toBeNull();
    expect(form().errors.email).toBeUndefined();
  });

  it("works with fieldState.error rendering", async () => {
    const validate = (values: FormValues) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    });

    const { form, lastRender } = setup({ validate });

    await form().trigger();
    expect(lastRender().fieldState.error?.message).toBe("Email is required");
  });

  it("re-runs validation on change when mode is onChange", async () => {
    const validate = (values: FormValues) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    });

    const { form } = setup({ validate, mode: "onChange" });

    // Typing a value first so the input's value actually changes on the
    // following event (a controlled input does not fire onChange when the
    // value is set to the same string it already holds).
    fireEvent.change(screen.getByTestId("custom"), { target: { value: "x" } });
    fireEvent.change(screen.getByTestId("custom"), { target: { value: "" } });
    await act(async () => {});
    expect(form().errors.email).toEqual({ message: "Email is required" });

    fireEvent.change(screen.getByTestId("custom"), { target: { value: "a@b.c" } });
    await act(async () => {});
    expect(form().errors.email).toBeUndefined();
  });
});
