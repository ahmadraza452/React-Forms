import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useSmartForm, type UseSmartFormReturn } from "../src/index";

interface FormValues {
  email: string;
}

const defaultValues: FormValues = { email: "" };

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
    return <div />;
  }

  render(<Harness />);

  return { form: () => formRef.current as UseSmartFormReturn<FormValues> };
}

afterEach(() => {
  cleanup();
});

describe("setValue options", () => {
  it("does not touch or validate by default", async () => {
    const { form } = setup();

    act(() => {
      form().setValue("email", "");
    });
    await act(async () => {});

    expect(form().touchedFields.email).toBe(false);
    expect(form().errors.email).toBeUndefined();
  });

  it("marks a field as touched with shouldTouch", () => {
    const { form } = setup();

    act(() => {
      form().setValue("email", "a@b.c", { shouldTouch: true });
    });

    expect(form().touchedFields.email).toBe(true);
  });

  it("does not touch other fields with shouldTouch", () => {
    const { form } = setup();

    act(() => {
      form().setValue("email", "a@b.c", { shouldTouch: true });
    });

    expect(form().touchedFields.email).toBe(true);
    expect(form().touchedFields).not.toHaveProperty("other");
  });

  it("marks a field as dirty with shouldDirty even when equal to the default", () => {
    const { form } = setup();

    expect(form().dirtyFields.email).toBe(false);

    act(() => {
      form().setValue("email", "", { shouldDirty: true });
    });

    expect(form().dirtyFields.email).toBe(true);
    expect(form().isDirty).toBe(true);

    act(() => {
      form().reset();
    });

    expect(form().dirtyFields.email).toBe(false);
  });

  it("validates the field with shouldValidate", async () => {
    const { form } = setup();

    act(() => {
      form().setValue("email", "", { shouldValidate: true });
    });
    await act(async () => {});

    expect(form().errors.email).toEqual({ message: "Email is required" });
  });

  it("clears the field error when shouldValidate passes", async () => {
    const { form } = setup();

    await form().trigger();
    expect(form().errors.email).toEqual({ message: "Email is required" });

    act(() => {
      form().setValue("email", "valid@example.com", { shouldValidate: true });
    });
    await act(async () => {});

    expect(form().errors.email).toBeUndefined();
  });

  it("combines shouldValidate, shouldTouch and shouldDirty", async () => {
    const { form } = setup();

    act(() => {
      form().setValue("email", "", {
        shouldValidate: true,
        shouldTouch: true,
        shouldDirty: true,
      });
    });
    await act(async () => {});

    expect(form().touchedFields.email).toBe(true);
    expect(form().dirtyFields.email).toBe(true);
    expect(form().errors.email).toEqual({ message: "Email is required" });
  });
});
