import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  useSmartForm,
  type FieldError,
  type ValidationMode,
  type ReValidateMode,
  type UseSmartFormReturn,
} from "../src/index";

afterEach(() => {
  cleanup();
});

interface FormValues {
  email: string;
  password: string;
  age: number;
}

const defaultValues: FormValues = {
  email: "",
  password: "",
  age: 0,
};

type ValidateFn = (
  values: FormValues,
) =>
  | { errors: Partial<Record<keyof FormValues, { message: string }>> }
  | Promise<{ errors: Partial<Record<keyof FormValues, { message: string }>> }>;

interface SetupOptions {
  mode?: ValidationMode;
  reValidateMode?: ReValidateMode;
}

function setup(validate?: ValidateFn, options: SetupOptions = {}) {
  const formRef: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

  function Harness() {
    // Build options conditionally to satisfy exactOptionalPropertyTypes:
    // passing `undefined` for an optional prop is disallowed by that flag.
    const formOptions: Parameters<typeof useSmartForm<FormValues>>[0] = {
      defaultValues,
      ...(validate !== undefined && {
        validate: validate as (values: FormValues) => ReturnType<ValidateFn>,
      }),
      ...(options.mode !== undefined && { mode: options.mode }),
      ...(options.reValidateMode !== undefined && { reValidateMode: options.reValidateMode }),
    };
    const form = useSmartForm(formOptions);
    formRef.current = form;

    return (
      <form>
        <input data-testid="email" type="email" {...form.register("email")} />
        <input data-testid="password" type="password" {...form.register("password")} />
        <input data-testid="age" type="number" {...form.register("age")} />
      </form>
    );
  }

  render(<Harness />);

  return { form: () => formRef.current as UseSmartFormReturn<FormValues> };
}

describe("validation - basic", () => {
  it("validates a valid form", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByTestId("password"), { target: { value: "secret" } });

    const valid = await form().trigger();
    expect(valid).toBe(true);
    expect(form().isValid).toBe(true);
    expect(form().errors).toEqual({});
  });

  it("rejects an invalid form", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    const valid = await form().trigger();
    expect(valid).toBe(false);
    expect(form().isValid).toBe(false);
    expect(form().errors.email).toEqual({ message: "Email is required" });
  });

  it("handles multiple validation errors", async () => {
    const { form } = setup((values) => {
      const errors: Partial<Record<keyof FormValues, FieldError>> = {};
      if (!values.email) errors.email = { message: "Email is required" };
      if (!values.password) errors.password = { message: "Password is required" };
      return { errors };
    });

    const valid = await form().trigger();
    expect(valid).toBe(false);
    expect(form().errors.email).toEqual({ message: "Email is required" });
    expect(form().errors.password).toEqual({ message: "Password is required" });
  });

  it("clears all errors with clearErrors()", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    await form().trigger();
    expect(form().errors.email).toBeDefined();

    form().clearErrors();
    expect(form().errors).toEqual({});
    expect(form().isValid).toBe(true);
  });

  it("clears individual field error with clearErrors(name)", async () => {
    const { form } = setup((values) => {
      const errors: Partial<Record<keyof FormValues, FieldError>> = {};
      if (!values.email) errors.email = { message: "Email is required" };
      if (!values.password) errors.password = { message: "Password is required" };
      return { errors };
    });

    await form().trigger();
    expect(form().errors.email).toBeDefined();
    expect(form().errors.password).toBeDefined();

    form().clearErrors("email");
    expect(form().errors.email).toBeUndefined();
    expect(form().errors.password).toBeDefined();
  });
});

describe("validation - trigger()", () => {
  it("validates entire form with trigger()", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    const valid = await form().trigger();
    expect(valid).toBe(false);

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    const valid2 = await form().trigger();
    expect(valid2).toBe(true);
  });

  it("validates individual field with trigger(name)", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    const valid = await form().trigger("email");
    expect(valid).toBe(false);

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    const valid2 = await form().trigger("email");
    expect(valid2).toBe(true);
  });
});

describe("validation - async", () => {
  it("handles async validation success", async () => {
    const { form } = setup(async (values) => {
      await new Promise((r) => setTimeout(r, 10));
      return { errors: values.email ? {} : { email: { message: "Email is required" } } };
    });

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    const valid = await form().trigger();
    expect(valid).toBe(true);
  });

  it("handles async validation failure", async () => {
    const { form } = setup(async (values) => {
      await new Promise((r) => setTimeout(r, 10));
      return { errors: values.email ? {} : { email: { message: "Email is required" } } };
    });

    const valid = await form().trigger();
    expect(valid).toBe(false);
    expect(form().errors.email).toEqual({ message: "Email is required" });
  });
});

describe("validation - modes", () => {
  it("validates on submit (default mode)", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    // No validation on change
    fireEvent.change(screen.getByTestId("email"), { target: { value: "test" } });
    expect(form().errors.email).toBeUndefined();

    // Validation only on trigger
    await form().trigger();
    expect(form().errors.email).toBeUndefined();
  });

  it("validates on blur", async () => {
    const { form } = setup(
      (values) => ({
        errors: values.email ? {} : { email: { message: "Email is required" } },
      }),
      { mode: "onBlur", reValidateMode: "onBlur" },
    );

    // Typing does not validate in onBlur mode
    fireEvent.change(screen.getByTestId("email"), { target: { value: "" } });
    await act(async () => {});
    expect(form().errors.email).toBeUndefined();

    // Blur triggers validation → empty email is invalid
    fireEvent.blur(screen.getByTestId("email"));
    await act(async () => {});
    expect(form().errors.email).toEqual({ message: "Email is required" });

    // reValidateMode is onBlur, so changing the value does not clear the error yet
    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    await act(async () => {});
    expect(form().errors.email).toEqual({ message: "Email is required" });

    // Blur again → error cleared
    fireEvent.blur(screen.getByTestId("email"));
    await act(async () => {});
    expect(form().errors.email).toBeUndefined();
  });

  it("validates on change", async () => {
    const { form } = setup(
      (values) => ({
        errors: values.email ? {} : { email: { message: "Email is required" } },
      }),
      { mode: "onChange" },
    );

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test" } });
    await act(async () => {});
    expect(form().errors.email).toBeUndefined();
  });
});

describe("validation - reValidateMode", () => {
  it("re-validates on change when reValidateMode is onChange", async () => {
    const { form } = setup(
      (values) => ({
        errors: values.email ? {} : { email: { message: "Email is required" } },
      }),
      { mode: "onSubmit", reValidateMode: "onChange" },
    );

    // Trigger initial validation to create error
    await form().trigger();
    expect(form().errors.email).toBeDefined();

    // Change value should re-validate
    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    await act(async () => {});
    expect(form().errors.email).toBeUndefined();
  });

  it("re-validates on blur when reValidateMode is onBlur", async () => {
    const { form } = setup(
      (values) => ({
        errors: values.email ? {} : { email: { message: "Email is required" } },
      }),
      { mode: "onSubmit", reValidateMode: "onBlur" },
    );

    // Trigger initial validation to create error
    await form().trigger();
    expect(form().errors.email).toBeDefined();

    // Change value should NOT re-validate
    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    await act(async () => {});
    expect(form().errors.email).toBeDefined();

    // Blur should re-validate
    fireEvent.blur(screen.getByTestId("email"));
    await act(async () => {});
    expect(form().errors.email).toBeUndefined();
  });
});

describe("validation - form state", () => {
  it("exposes errors object", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    expect(form().errors).toEqual({});
    await form().trigger();
    expect(form().errors.email).toEqual({ message: "Email is required" });
  });

  it("exposes isValid", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    expect(form().isValid).toBe(true); // optimistic initial state
    await form().trigger();
    expect(form().isValid).toBe(false);

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    await form().trigger();
    expect(form().isValid).toBe(true);
  });

  it("getFieldState includes error and invalid", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    const initialState = form().getFieldState("email");
    expect(initialState.error).toBeUndefined();
    expect(initialState.invalid).toBe(false);

    await form().trigger();
    const errorState = form().getFieldState("email");
    expect(errorState.error).toEqual({ message: "Email is required" });
    expect(errorState.invalid).toBe(true);

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    await form().trigger();
    const validState = form().getFieldState("email");
    expect(validState.error).toBeUndefined();
    expect(validState.invalid).toBe(false);
  });
});

describe("validation - clearErrors", () => {
  it("clears all errors", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    await form().trigger();
    form().clearErrors();
    expect(form().errors).toEqual({});
    expect(form().isValid).toBe(true);
  });

  it("clears individual field error", async () => {
    const { form } = setup((values) => {
      const errors: Partial<Record<keyof FormValues, FieldError>> = {};
      if (!values.email) errors.email = { message: "Email is required" };
      if (!values.password) errors.password = { message: "Password is required" };
      return { errors };
    });

    await form().trigger();
    form().clearErrors("email");
    expect(form().errors.email).toBeUndefined();
    expect(form().errors.password).toBeDefined();
  });

  it("updates isValid after clearing errors", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    await form().trigger();
    expect(form().isValid).toBe(false);
    form().clearErrors();
    expect(form().isValid).toBe(true);
  });
});

describe("validation - regression", () => {
  it("still works with register()", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByTestId("password"), { target: { value: "secret" } });

    const valid = await form().trigger();
    expect(valid).toBe(true);
    expect(form().getValue("email")).toBe("test@example.com");
    expect(form().getValue("password")).toBe("secret");
  });

  it("still works with setValue", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    form().setValue("email", "test@example.com");
    const valid = await form().trigger();
    expect(valid).toBe(true);
    expect(form().getValue("email")).toBe("test@example.com");
  });

  it("still works with reset()", async () => {
    const { form } = setup((values) => ({
      errors: values.email ? {} : { email: { message: "Email is required" } },
    }));

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    await form().trigger();

    form().reset();
    expect(form().getValue("email")).toBe("");
    expect(form().errors).toEqual({});
    expect(form().isValid).toBe(true);
  });
});
