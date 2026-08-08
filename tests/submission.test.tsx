import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  useSmartForm,
  zodResolver,
  type FieldErrors,
  type UseSmartFormReturn,
  type Validator,
} from "../src/index";

afterEach(() => {
  cleanup();
});

interface FormValues {
  email: string;
  password: string;
}

const defaultValues: FormValues = { email: "", password: "" };

const emailRequired: Validator<FormValues> = (values) => ({
  errors: values.email ? {} : { email: { message: "Email is required" } },
});

const alwaysValid: Validator<FormValues> = () => ({ errors: {} });

interface SetupOptions {
  validate?: Validator<FormValues>;
  onSubmit?: (values: FormValues) => void | Promise<void>;
  onError?: (errors: FieldErrors<FormValues>) => void;
}

function setup(options: SetupOptions = {}) {
  const formRef: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

  function Harness() {
    const form = useSmartForm({
      defaultValues,
      ...(options.validate !== undefined && { validate: options.validate }),
      ...(options.onSubmit !== undefined && { onSubmit: options.onSubmit }),
      ...(options.onError !== undefined && { onError: options.onError }),
    });
    formRef.current = form;

    return (
      <form data-testid="form" onSubmit={form.handleSubmit}>
        <input data-testid="email" {...form.register("email")} />
        <input data-testid="password" type="password" {...form.register("password")} />
        <button type="submit" data-testid="submit">
          Submit
        </button>
      </form>
    );
  }

  render(<Harness />);
  return { form: () => formRef.current as UseSmartFormReturn<FormValues> };
}

describe("handleSubmit", () => {
  it("runs validation and calls onSubmit with the current values on success", async () => {
    const onSubmit = vi.fn();
    const { form } = setup({ validate: alwaysValid, onSubmit });

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    await act(async () => {
      fireEvent.submit(screen.getByTestId("form"));
    });
    await act(async () => {});

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: "test@example.com", password: "" });
    expect(form().isSubmitting).toBe(false);
    expect(form().isSubmitted).toBe(true);
    expect(form().submitCount).toBe(1);
  });

  it("does not call onSubmit and reports errors when validation fails", async () => {
    const onSubmit = vi.fn();
    const onError = vi.fn();
    const { form } = setup({ validate: emailRequired, onSubmit, onError });

    await act(async () => {
      fireEvent.submit(screen.getByTestId("form"));
    });
    await act(async () => {});

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({ email: { message: "Email is required" } });
    expect(form().errors.email).toEqual({ message: "Email is required" });
    expect(form().isValid).toBe(false);
    expect(form().isSubmitted).toBe(true);
    expect(form().submitCount).toBe(1);
  });

  it("does not call onError when validation passes", async () => {
    const onSubmit = vi.fn();
    const onError = vi.fn();
    setup({ validate: alwaysValid, onSubmit, onError });

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    await act(async () => {
      fireEvent.submit(screen.getByTestId("form"));
    });
    await act(async () => {});

    expect(onError).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("prevents the default form submission behavior", async () => {
    const onSubmit = vi.fn();
    const { form } = setup({ validate: alwaysValid, onSubmit });

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });

    const preventDefault = vi.fn();
    await act(async () => {
      await form().handleSubmit({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("works when passed through an inline onSubmit handler", async () => {
    const onSubmit = vi.fn();

    function WrappedHarness() {
      const form = useSmartForm({ defaultValues, validate: alwaysValid, onSubmit });

      return (
        <form
          data-testid="form"
          onSubmit={(event) => {
            form.handleSubmit(event);
          }}
        >
          <input data-testid="email" {...form.register("email")} />
          <button type="submit">Submit</button>
        </form>
      );
    }

    render(<WrappedHarness />);

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    await act(async () => {
      fireEvent.submit(screen.getByTestId("form"));
    });
    await act(async () => {});

    expect(onSubmit).toHaveBeenCalledWith({ email: "test@example.com", password: "" });
  });
});

describe("submission state", () => {
  it("toggles isSubmitting during an async submission", async () => {
    let resolveSubmit: (() => void) | undefined;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const onSubmit = vi.fn(() => submitPromise);
    const { form } = setup({ validate: alwaysValid, onSubmit });

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    await act(async () => {
      fireEvent.submit(screen.getByTestId("form"));
    });

    // The submission is still in progress.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(form().isSubmitting).toBe(true);
    expect(form().submitCount).toBe(1);

    await act(async () => {
      resolveSubmit?.();
      await submitPromise;
    });

    expect(form().isSubmitting).toBe(false);
    expect(form().isSubmitted).toBe(true);
    expect(form().submitCount).toBe(1);
  });

  it("resets isSubmitting and propagates errors thrown by onSubmit", async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error("Request failed");
    });
    const onError = vi.fn();
    const { form } = setup({ validate: alwaysValid, onSubmit, onError });

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });

    await act(async () => {
      await expect(form().handleSubmit()).rejects.toThrow("Request failed");
    });

    expect(form().isSubmitting).toBe(false);
    expect(form().isSubmitted).toBe(true);
    expect(form().submitCount).toBe(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("increments submitCount on every submission attempt", async () => {
    const onSubmit = vi.fn(async () => {});
    const { form } = setup({ validate: alwaysValid, onSubmit });

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    expect(form().submitCount).toBe(0);

    for (let attempt = 1; attempt <= 3; attempt++) {
      await act(async () => {
        fireEvent.submit(screen.getByTestId("form"));
      });
      await act(async () => {});
      expect(form().submitCount).toBe(attempt);
    }
    expect(onSubmit).toHaveBeenCalledTimes(3);
  });

  it("sets isSubmitted after any submission attempt, including failed ones", async () => {
    const onSubmit = vi.fn();
    const onError = vi.fn();
    const { form } = setup({ validate: emailRequired, onSubmit, onError });

    expect(form().isSubmitted).toBe(false);

    // A failed validation attempt still counts as submitted.
    await act(async () => {
      fireEvent.submit(screen.getByTestId("form"));
    });
    await act(async () => {});
    expect(form().isSubmitted).toBe(true);
    expect(form().submitCount).toBe(1);

    // A successful attempt keeps isSubmitted true.
    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    await act(async () => {
      fireEvent.submit(screen.getByTestId("form"));
    });
    await act(async () => {});
    expect(form().isSubmitted).toBe(true);
    expect(form().submitCount).toBe(2);
  });

  it("prevents duplicate concurrent submissions", async () => {
    let resolveSubmit: (() => void) | undefined;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const onSubmit = vi.fn(() => submitPromise);
    const { form } = setup({ validate: alwaysValid, onSubmit });

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });

    // Trigger three rapid submits while the first is still in progress.
    for (let attempt = 0; attempt < 3; attempt++) {
      await act(async () => {
        fireEvent.submit(screen.getByTestId("form"));
      });
    }

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(form().isSubmitting).toBe(true);
    expect(form().submitCount).toBe(1);

    await act(async () => {
      resolveSubmit?.();
      await submitPromise;
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(form().isSubmitting).toBe(false);
    expect(form().submitCount).toBe(1);
  });
});

describe("reset", () => {
  it("clears submission, error, dirty and touched state", async () => {
    const onSubmit = vi.fn();
    const { form } = setup({ validate: emailRequired, onSubmit });

    fireEvent.change(screen.getByTestId("email"), { target: { value: "test@example.com" } });
    fireEvent.blur(screen.getByTestId("email"));
    await act(async () => {
      fireEvent.submit(screen.getByTestId("form"));
    });
    await act(async () => {});

    expect(form().isSubmitted).toBe(true);
    expect(form().submitCount).toBe(1);
    expect(form().touchedFields.email).toBe(true);
    expect(form().isDirty).toBe(true);

    act(() => {
      form().reset();
    });

    expect(form().isSubmitting).toBe(false);
    expect(form().isSubmitted).toBe(false);
    expect(form().submitCount).toBe(0);
    expect(form().errors).toEqual({});
    expect(form().isValid).toBe(true);
    expect(form().getValues()).toEqual({ email: "", password: "" });
    expect(form().isDirty).toBe(false);
    expect(form().touchedFields.email).toBe(false);
  });
});

describe("Zod integration", () => {
  it("passes Zod-parsed values to onSubmit", async () => {
    const schema = z.object({
      email: z.string().email("Invalid email"),
      age: z.coerce.number(),
    });
    const onSubmit = vi.fn();
    const formRef: { current: UseSmartFormReturn<{ email: string; age: number }> | null } = {
      current: null,
    };

    function ZodHarness() {
      const form = useSmartForm({
        defaultValues: { email: "", age: 0 },
        validate: zodResolver(schema),
        onSubmit,
      });
      formRef.current = form;

      return (
        <form data-testid="form" onSubmit={form.handleSubmit}>
          <input data-testid="email" {...form.register("email")} />
          <input data-testid="age" {...form.register("age")} />
          <button type="submit">Submit</button>
        </form>
      );
    }

    render(<ZodHarness />);
    const form = () => formRef.current as UseSmartFormReturn<{ email: string; age: number }>;

    fireEvent.change(screen.getByTestId("email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByTestId("age"), { target: { value: "25" } });
    await act(async () => {
      fireEvent.submit(screen.getByTestId("form"));
    });
    await act(async () => {});

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: "a@b.com", age: 25 });
    expect(form().isSubmitting).toBe(false);
  });
});
