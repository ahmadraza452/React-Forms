import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Controller, useSmartForm, type FieldErrors, type UseSmartFormReturn } from "../src/index";

interface FormValues {
  email: string;
  password: string;
  age: number;
}

const defaultValues: FormValues = { email: "", password: "", age: 0 };

afterEach(() => {
  cleanup();
});

function getForm(): HTMLFormElement {
  const form = document.querySelector("form");
  if (!form) throw new Error("No <form> element rendered");
  return form as HTMLFormElement;
}

interface HarnessProps {
  validate?: (values: FormValues) => { errors: FieldErrors<FormValues> };
  mode?: "onSubmit" | "onBlur" | "onChange";
  showController?: boolean;
}

function setup(props: HarnessProps = {}) {
  const formRef: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

  function Harness({ validate, mode, showController }: HarnessProps) {
    const form = useSmartForm({
      defaultValues,
      ...(validate !== undefined && { validate }),
      ...(mode !== undefined && { mode }),
    });
    formRef.current = form;

    return (
      <form>
        <input aria-label="email" type="email" {...form.register("email")} />
        <input aria-label="password" type="password" {...form.register("password")} />
        {showController && (
          <Controller
            control={form.control}
            name="age"
            render={({ field, fieldState }) => (
              <input
                aria-label="age"
                type="number"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                data-error={fieldState.error?.message ?? ""}
              />
            )}
          />
        )}
      </form>
    );
  }

  render(<Harness {...props} />);

  return { form: () => formRef.current as UseSmartFormReturn<FormValues> };
}

describe("setError - single field", () => {
  it("sets a field error via setError(name, error)", () => {
    const { form } = setup();

    act(() => {
      form().setError("email", { message: "Email is already taken" });
    });

    expect(form().errors.email).toEqual({ message: "Email is already taken" });
    expect(form().isValid).toBe(false);
  });

  it("accepts a plain string message", () => {
    const { form } = setup();

    act(() => {
      form().setError("password", "Password is too weak");
    });

    expect(form().errors.password).toEqual({ message: "Password is too weak" });
  });

  it("preserves meta when provided", () => {
    const { form } = setup();

    act(() => {
      form().setError("email", { message: "Blocked", meta: { code: 403 } });
    });

    expect(form().errors.email).toEqual({ message: "Blocked", meta: { code: 403 } });
  });

  it("replaces an existing error", () => {
    const { form } = setup();

    act(() => {
      form().setError("email", { message: "First message" });
      form().setError("email", { message: "Second message" });
    });

    expect(form().errors.email).toEqual({ message: "Second message" });
  });

  it("does not touch other field errors when replacing one field", () => {
    const { form } = setup();

    act(() => {
      form().setError("email", { message: "Email error" });
      form().setError("password", { message: "Password error" });
      form().setError("email", { message: "Email error v2" });
    });

    expect(form().errors.email).toEqual({ message: "Email error v2" });
    expect(form().errors.password).toEqual({ message: "Password error" });
  });

  it("exposes the error through getFieldState", () => {
    const { form } = setup();

    act(() => {
      form().setError("email", { message: "Server says no" });
    });

    const state = form().getFieldState("email");
    expect(state.error).toEqual({ message: "Server says no" });
    expect(state.invalid).toBe(true);
  });
});

describe("setErrors - multiple errors", () => {
  it("sets multiple field errors at once", () => {
    const { form } = setup();

    act(() => {
      form().setErrors({
        email: { message: "Email is taken" },
        password: { message: "Password is weak" },
      });
    });

    expect(form().errors.email).toEqual({ message: "Email is taken" });
    expect(form().errors.password).toEqual({ message: "Password is weak" });
    expect(form().isValid).toBe(false);
  });

  it("merges with existing errors instead of wiping them", () => {
    const { form } = setup();

    act(() => {
      form().setError("email", { message: "Existing email error" });
      form().setErrors({ password: { message: "New password error" } });
    });

    expect(form().errors.email).toEqual({ message: "Existing email error" });
    expect(form().errors.password).toEqual({ message: "New password error" });
  });

  it("supports nested-style dotted keys at runtime", () => {
    const { form } = setup();

    act(() => {
      // The `Path` type is flat today; dotted keys like `"user.name"` are
      // supported at runtime (as produced by zodResolver for nested objects).
      form().setErrors({ "user.name": { message: "Name is invalid" } } as FieldErrors<FormValues>);
    });

    expect((form().errors as Record<string, unknown>)["user.name"]).toEqual({
      message: "Name is invalid",
    });
  });
});

describe("root errors", () => {
  it("sets a form-level error via setError('root', ...)", () => {
    const { form } = setup();

    act(() => {
      form().setError("root", { message: "Unable to reach the server" });
    });

    expect(form().errors.root).toEqual({ message: "Unable to reach the server" });
    expect(form().isValid).toBe(false);
  });

  it("accepts a string message for root errors", () => {
    const { form } = setup();

    act(() => {
      form().setError("root", "Network error");
    });

    expect(form().errors.root).toEqual({ message: "Network error" });
  });

  it("combines root and field errors", () => {
    const { form } = setup();

    act(() => {
      form().setError("root", "Network error");
      form().setError("email", "Email is taken");
    });

    expect(form().errors.root).toEqual({ message: "Network error" });
    expect(form().errors.email).toEqual({ message: "Email is taken" });
  });

  it("clears only the root error with clearErrors('root')", () => {
    const { form } = setup();

    act(() => {
      form().setError("root", "Network error");
      form().setError("email", "Email is taken");
    });

    form().clearErrors("root");

    expect(form().errors.root).toBeUndefined();
    expect(form().errors.email).toEqual({ message: "Email is taken" });
  });
});

describe("clearErrors with server errors", () => {
  it("clears an individual server error", () => {
    const { form } = setup();

    act(() => {
      form().setErrors({
        email: { message: "Email is taken" },
        password: { message: "Password is weak" },
      });
    });

    form().clearErrors("email");
    expect(form().errors.email).toBeUndefined();
    expect(form().errors.password).toEqual({ message: "Password is weak" });
  });

  it("clears all server errors with clearErrors()", () => {
    const { form } = setup();

    act(() => {
      form().setErrors({
        email: { message: "Email is taken" },
        password: { message: "Password is weak" },
      });
    });

    form().clearErrors();
    expect(form().errors).toEqual({});
    expect(form().isValid).toBe(true);
  });

  it("clears server errors after reset()", () => {
    const { form } = setup();

    act(() => {
      form().setError("email", { message: "Server error" });
      form().setError("root", "Server down");
    });
    expect(form().isValid).toBe(false);

    form().reset();
    expect(form().errors).toEqual({});
    expect(form().isValid).toBe(true);
  });

  it("clears a field's server error via resetField()", () => {
    const { form } = setup();

    act(() => {
      form().setError("email", { message: "Server error" });
      form().setError("password", { message: "Other error" });
    });

    form().resetField("email");
    expect(form().errors.email).toBeUndefined();
    expect(form().errors.password).toEqual({ message: "Other error" });
  });
});

describe("server errors with register() and Controller", () => {
  it("renders server errors next to registered inputs", () => {
    const holder: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

    function Harness() {
      const form = useSmartForm({ defaultValues });
      holder.current = form;
      return (
        <form>
          <input aria-label="email" {...form.register("email")} />
          <span data-testid="email-error">{form.errors.email?.message}</span>
        </form>
      );
    }

    render(<Harness />);
    expect(screen.getByTestId("email-error").textContent).toBe("");

    act(() => {
      holder.current?.setError("email", { message: "Email is already taken" });
    });

    expect(screen.getByTestId("email-error").textContent).toBe("Email is already taken");
  });

  it("updates Controller fieldState reactively", () => {
    const { form } = setup({ showController: true });

    expect(screen.getByLabelText("age").getAttribute("data-error")).toBe("");

    act(() => {
      form().setError("age", { message: "Age out of range" });
    });

    expect(screen.getByLabelText("age").getAttribute("data-error")).toBe("Age out of range");
    expect(form().getFieldState("age").invalid).toBe(true);

    act(() => {
      form().clearErrors("age");
    });
    expect(screen.getByLabelText("age").getAttribute("data-error")).toBe("");
  });

  it("keeps Controller fieldState.error in sync when errors are replaced", () => {
    const { form } = setup({ showController: true });

    act(() => {
      form().setError("age", { message: "First error" });
    });
    expect(screen.getByLabelText("age").getAttribute("data-error")).toBe("First error");

    act(() => {
      form().setError("age", { message: "Second error" });
    });
    expect(screen.getByLabelText("age").getAttribute("data-error")).toBe("Second error");
  });
});

describe("server errors + client validation", () => {
  it("client re-validation replaces a server error on change", async () => {
    const { form } = setup({
      validate: (values) => ({
        errors: values.email ? {} : { email: { message: "Email is required" } },
      }),
      mode: "onChange",
    });

    act(() => {
      form().setError("email", { message: "Email is already taken" });
    });
    expect(form().errors.email).toEqual({ message: "Email is already taken" });

    // Editing the field runs client validation, which replaces the server error.
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "new@example.com" } });
    await act(async () => {});

    expect(form().errors.email).toBeUndefined();
  });

  it("keeps server errors of other fields while client validation runs", async () => {
    const { form } = setup({
      validate: (values) => ({
        errors: values.email ? {} : { email: { message: "Email is required" } },
      }),
      mode: "onChange",
    });

    act(() => {
      form().setError("email", { message: "Email is taken" });
      form().setError("password", { message: "Password breached" });
    });

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.c" } });
    await act(async () => {});

    expect(form().errors.email).toBeUndefined();
    expect(form().errors.password).toEqual({ message: "Password breached" });
  });

  it("a failed client validation overwrites the server error", async () => {
    const { form } = setup({
      validate: (values) => ({
        errors:
          values.email === "bad"
            ? { email: { message: "Email is invalid" } }
            : values.email
              ? {}
              : { email: { message: "Email is required" } },
      }),
      mode: "onChange",
    });

    act(() => {
      form().setError("email", { message: "Email is taken" });
    });

    // Changing to a value that fails client validation replaces the server
    // error with the client error.
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "bad" } });
    await act(async () => {});

    expect(form().errors.email).toEqual({ message: "Email is invalid" });
  });

  it("trigger() clears the root error when the whole form passes", async () => {
    const { form } = setup({
      validate: () => ({ errors: {} }),
    });

    act(() => {
      form().setError("root", "Network error");
    });

    const valid = await form().trigger();
    expect(valid).toBe(true);
    expect(form().errors).toEqual({});
  });
});

describe("server errors + submission", () => {
  it("a passing submission runs onSubmit and replaces server errors with the validation result", async () => {
    let submitted = false;
    const holder: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

    function Harness() {
      const form = useSmartForm({
        defaultValues,
        validate: () => ({ errors: {} }),
        onSubmit: () => {
          submitted = true;
        },
      });
      holder.current = form;
      return (
        <form onSubmit={form.handleSubmit}>
          <input aria-label="email" {...form.register("email")} />
        </form>
      );
    }

    render(<Harness />);

    act(() => {
      holder.current?.setError("email", { message: "Email is taken" });
    });

    fireEvent.submit(getForm());
    await act(async () => {});

    expect(submitted).toBe(true);
    // Client validation passed, so the server error is replaced by the
    // (empty) validation result.
    expect(holder.current?.errors).toEqual({});
    expect(holder.current?.isValid).toBe(true);
  });

  it("a failing validation run replaces server errors with validation errors in onError", async () => {
    let captured: FieldErrors<FormValues> | null = null;
    const holder: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

    function FailingHarness() {
      const form = useSmartForm({
        defaultValues,
        validate: () => ({ errors: { email: { message: "Invalid" } } }),
        onError: (errors) => {
          captured = errors;
        },
      });
      holder.current = form;
      return (
        <form onSubmit={form.handleSubmit}>
          <input aria-label="email" {...form.register("email")} />
        </form>
      );
    }

    render(<FailingHarness />);

    act(() => {
      holder.current?.setError("email", { message: "Server says no" });
    });

    fireEvent.submit(getForm());
    await act(async () => {});

    expect(captured).toEqual({ email: { message: "Invalid" } });
    expect(holder.current?.errors).toEqual({ email: { message: "Invalid" } });
  });
});
