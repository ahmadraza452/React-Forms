import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useSmartForm, type FieldErrors, type UseSmartFormReturn } from "../src/index";

interface FormValues {
  email: string;
}

const defaultValues: FormValues = { email: "" };

afterEach(() => {
  cleanup();
});

function getForm(): HTMLFormElement {
  const form = document.querySelector("form");
  if (!form) throw new Error("No <form> element rendered");
  return form as HTMLFormElement;
}

/**
 * A validator whose results resolve on demand, so tests can control the order
 * in which async validation requests finish.
 */
function createControllableValidator() {
  const pending: Array<{
    values: FormValues;
    resolve: (result: { errors: FieldErrors<FormValues> }) => void;
  }> = [];

  const validate = (values: FormValues): Promise<{ errors: FieldErrors<FormValues> }> =>
    new Promise((resolve) => {
      pending.push({ values, resolve });
    });

  return {
    validate,
    pending,
    /**
     * Finishes the `n`-th request (in call order) with an error whose message
     * is derived from `label`, so tests can tell which request's result won.
     */
    settle(n: number, label: string) {
      const entry = pending[n];
      if (!entry) throw new Error(`No pending validation request at index ${n}`);
      pending.splice(n, 1);
      entry.resolve({ errors: { email: { message: `Invalid: ${label}` } } });
    },
  };
}

interface HarnessProps {
  validate: (values: FormValues) => Promise<{ errors: FieldErrors<FormValues> }>;
  mode?: "onChange" | "onBlur" | "onSubmit";
}

function setup(validate: HarnessProps["validate"], mode?: HarnessProps["mode"]) {
  const holder: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

  function Harness() {
    const form = useSmartForm({
      defaultValues,
      validate,
      ...(mode !== undefined && { mode }),
    });
    holder.current = form;
    return (
      <form>
        <input aria-label="email" {...form.register("email")} />
      </form>
    );
  }

  render(<Harness />);
  return { form: () => holder.current as UseSmartFormReturn<FormValues> };
}

describe("async validation race conditions", () => {
  it("discards a stale field-level result that resolves after a newer one", async () => {
    const controller = createControllableValidator();
    const { form } = setup(controller.validate, "onChange");

    // Request A (slow, started first) — email is "old"
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "old" } });
    // Request B (fast, started second) — email is "new"
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "new" } });

    // B finishes first with an error for its snapshot
    controller.settle(1, "new");

    // A finishes later with an error for the stale snapshot "old"
    controller.settle(0, "old");

    await act(async () => {});

    expect(form().errors.email).toEqual({ message: "Invalid: new" });
  });

  it("a stale whole-form trigger() does not overwrite a newer result", async () => {
    const controller = createControllableValidator();
    const { form } = setup(controller.validate);

    const slow = form().trigger();
    const fast = form().trigger();

    // The second (newer) trigger resolves first with an error.
    controller.settle(1, "second");
    await fast;
    expect(form().errors.email).toEqual({ message: "Invalid: second" });

    // The first (older) trigger resolves last with a stale result.
    controller.settle(0, "first");
    await slow;

    // The stale result must not have overwritten the newer one.
    expect(form().errors.email).toEqual({ message: "Invalid: second" });
  });

  it("returns the correct boolean from each trigger() even when stale", async () => {
    const controller = createControllableValidator();
    const { form } = setup(controller.validate);

    const slow = form().trigger();
    const fast = form().trigger();

    controller.settle(1, "second");
    expect(await fast).toBe(false);

    controller.settle(0, "first");
    expect(await slow).toBe(false);
  });

  it("discards a validation result that resolves after reset()", async () => {
    const controller = createControllableValidator();
    const { form } = setup(controller.validate);

    const triggerPromise = form().trigger();

    // Reset while the validation is still pending.
    form().reset();
    controller.settle(0, "stale");

    await triggerPromise;

    // The stale result must not re-populate errors on the reset form.
    expect(form().errors).toEqual({});
    expect(form().isValid).toBe(true);
  });

  it("discards a field validation result that resolves after resetField()", async () => {
    const controller = createControllableValidator();
    const { form } = setup(controller.validate, "onChange");

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "old" } });
    form().resetField("email");

    controller.settle(0, "stale");
    await act(async () => {});

    expect(form().errors).toEqual({});
    expect(form().getValue("email")).toBe("");
  });

  it("does not commit submission errors that resolve after reset()", async () => {
    const controller = createControllableValidator();
    const holder: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

    function SubmitHarness() {
      const form = useSmartForm({ defaultValues, validate: controller.validate });
      holder.current = form;
      return (
        <form onSubmit={form.handleSubmit}>
          <input aria-label="email" {...form.register("email")} />
        </form>
      );
    }

    render(<SubmitHarness />);

    fireEvent.submit(getForm());
    // The submission's validation is pending; reset the form meanwhile.
    holder.current?.reset();
    controller.settle(0, "stale");

    await act(async () => {});

    expect(holder.current?.errors).toEqual({});
  });

  it("rapidly repeated changes settle on the final value", async () => {
    let callCount = 0;
    const validate = async (values: FormValues) => {
      callCount += 1;
      await new Promise((r) => setTimeout(r, 5));
      return { errors: values.email === "final" ? {} : { email: { message: "Not final" } } };
    };

    const { form } = setup(validate, "onChange");

    for (const value of ["a", "ab", "abc", "abcd", "final"]) {
      fireEvent.change(screen.getByLabelText("email"), { target: { value } });
    }

    await new Promise((r) => setTimeout(r, 60));

    expect(form().errors.email).toBeUndefined();
    expect(callCount).toBeGreaterThan(1);
  });
});
