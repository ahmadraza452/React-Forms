import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Controller, useSmartForm, type UseSmartFormReturn } from "../src/index";

afterEach(() => {
  cleanup();
});

describe("edge cases - empty form", () => {
  it("works with empty defaultValues", () => {
    const { result } = useFormHolder({});

    expect(result.getValues()).toEqual({});
    expect(result.isDirty()).toBe(false);
    expect(result.isValid()).toBe(true);

    result.reset();
    expect(result.getValues()).toEqual({});
  });
});

describe("edge cases - many fields", () => {
  it("handles a form with 50 fields", async () => {
    const values: Record<string, string> = {};
    for (let i = 0; i < 50; i += 1) values[`field${i}`] = "";

    const { result } = useFormHolder(values);

    for (let i = 0; i < 50; i += 1) {
      result.setValue(`field${i}`, `value${i}`);
    }

    expect(Object.keys(result.getValues()).length).toBe(50);
    expect(result.getValue("field49")).toBe("value49");
    expect(result.isDirty()).toBe(true);
    expect(result.getFieldState("field0").dirty).toBe(true);
  });
});

describe("edge cases - value handling", () => {
  it("supports null and undefined values where typed", () => {
    interface NullableForm {
      note: string | null;
      maybe: string | undefined;
    }

    const { result } = useFormHolder<NullableForm>({ note: null, maybe: undefined });

    expect(result.getValue("note")).toBeNull();
    expect(result.getValue("maybe")).toBeUndefined();

    result.setValue("note", "hello");
    expect(result.getValue("note")).toBe("hello");

    result.setValue("note", null);
    expect(result.getValue("note")).toBeNull();
    expect(result.isDirty()).toBe(false);
  });

  it("setting the same value repeatedly is stable", () => {
    const { result } = useFormHolder({ name: "" });

    result.setValue("name", "Ahmad");
    result.setValue("name", "Ahmad");
    result.setValue("name", "Ahmad");

    expect(result.getValue("name")).toBe("Ahmad");
    expect(result.getFieldState("name").dirty).toBe(true);
  });

  it("changing a field back to its default clears dirty", () => {
    const { result } = useFormHolder({ name: "", age: 0 });

    result.setValue("name", "Ahmad");
    expect(result.getFieldState("name").dirty).toBe(true);

    result.setValue("name", "");
    expect(result.getFieldState("name").dirty).toBe(false);
    expect(result.isDirty()).toBe(false);
  });

  it("treats NaN as dirty for number fields and resets to the default", () => {
    const { result } = useFormHolder({ age: 0 });

    // Clearing a number input stores NaN.
    result.setValue("age", Number.NaN);
    expect(Number.isNaN(result.getValue("age"))).toBe(true);
    expect(result.getFieldState("age").dirty).toBe(true);

    result.resetField("age");
    expect(result.getValue("age")).toBe(0);
    expect(result.getFieldState("age").dirty).toBe(false);
  });
});

describe("edge cases - submission", () => {
  it("reset() during a pending submission does not corrupt state", async () => {
    let resolveSubmit: (() => void) | null = null;
    const holder: { current: UseSmartFormReturn<{ name: string }> | null } = { current: null };

    function Harness() {
      const form = useSmartForm({
        defaultValues: { name: "" },
        onSubmit: () =>
          new Promise<void>((resolve) => {
            resolveSubmit = resolve;
          }),
      });
      holder.current = form;
      return (
        <form onSubmit={form.handleSubmit}>
          <input aria-label="name" {...form.register("name")} />
        </form>
      );
    }

    render(<Harness />);
    act(() => {
      holder.current?.setValue("name", "Ahmad");
    });

    fireEvent.submit(getForm());
    await act(async () => {});
    expect(holder.current?.isSubmitting).toBe(true);

    // Reset while the submission is in flight.
    act(() => {
      holder.current?.reset();
    });
    expect(holder.current?.getValues()).toEqual({ name: "" });
    expect(holder.current?.isSubmitting).toBe(false);

    // Completing the stale submission must not resurrect state.
    act(() => {
      resolveSubmit?.();
    });
    await act(async () => {});
    expect(holder.current?.isSubmitting).toBe(false);
    expect(holder.current?.getValues()).toEqual({ name: "" });
  });

  it("ignores duplicate submissions and allows a later one after completion", async () => {
    let resolveSubmit: (() => void) | null = null;
    const holder: { current: UseSmartFormReturn<{ name: string }> | null } = { current: null };

    function Harness() {
      const form = useSmartForm({
        defaultValues: { name: "" },
        onSubmit: () =>
          new Promise<void>((resolve) => {
            resolveSubmit = resolve;
          }),
      });
      holder.current = form;
      return (
        <form onSubmit={form.handleSubmit}>
          <input aria-label="name" {...form.register("name")} />
        </form>
      );
    }

    render(<Harness />);

    fireEvent.submit(getForm());
    await act(async () => {});
    expect(holder.current?.isSubmitting).toBe(true);

    // A second submission while one is in progress is ignored.
    fireEvent.submit(getForm());
    await act(async () => {});
    expect(holder.current?.submitCount).toBe(1);

    // After completion a new submission is allowed.
    act(() => {
      resolveSubmit?.();
    });
    await act(async () => {});
    expect(holder.current?.isSubmitting).toBe(false);

    fireEvent.submit(getForm());
    await act(async () => {});
    expect(holder.current?.submitCount).toBe(2);
  });
});

describe("edge cases - unmounted fields", () => {
  it("continues working after a Controller unmounts", () => {
    const holder: { current: UseSmartFormReturn<{ age: number; name: string }> | null } = {
      current: null,
    };

    function Harness({ showAge }: { showAge: boolean }) {
      const form = useSmartForm({ defaultValues: { age: 0, name: "" } });
      holder.current = form;
      return (
        <div>
          {showAge && (
            <Controller
              control={form.control}
              name="age"
              render={({ field }) => <input aria-label="age" {...field} />}
            />
          )}
          <input aria-label="name" {...form.register("name")} />
        </div>
      );
    }

    const { rerender } = render(<Harness showAge />);
    fireEvent.change(screen.getByLabelText("age"), { target: { value: "30" } });
    expect(holder.current?.getValue("age")).toBe("30");

    rerender(<Harness showAge={false} />);
    expect(screen.queryByLabelText("age")).toBeNull();

    // The form still works after the field unmounts.
    act(() => {
      holder.current?.setValue("name", "Ahmad");
    });
    expect(holder.current?.getValue("name")).toBe("Ahmad");
    expect(holder.current?.getValue("age")).toBe("30");
  });
});

interface FormHolder<T> {
  getValues: () => T;
  getValue: <K extends keyof T & string>(name: K) => T[K];
  setValue: <K extends keyof T & string>(name: K, value: T[K]) => void;
  reset: () => void;
  resetField: <K extends keyof T & string>(name: K) => void;
  isDirty: () => boolean;
  isValid: () => boolean;
  getFieldState: <K extends keyof T & string>(
    name: K,
  ) => { value: T[K]; dirty: boolean; touched: boolean; error?: unknown; invalid: boolean };
}

function useFormHolder<T extends object>(defaultValues: T): { result: FormHolder<T> } {
  let api: UseSmartFormReturn<T> | null = null;

  function Harness() {
    const form = useSmartForm({ defaultValues });
    api = form;
    return <div />;
  }

  render(<Harness />);
  const form = api as unknown as UseSmartFormReturn<T>;

  return {
    result: {
      getValues: () => form.getValues(),
      getValue: (name) => form.getValue(name),
      setValue: (name, value) => {
        act(() => {
          form.setValue(name, value);
        });
      },
      reset: () => {
        act(() => {
          form.reset();
        });
      },
      resetField: (name) => {
        act(() => {
          form.resetField(name);
        });
      },
      isDirty: () => form.isDirty,
      isValid: () => form.isValid,
      getFieldState: (name) => form.getFieldState(name),
    },
  };
}

function getForm(): HTMLFormElement {
  const form = document.querySelector("form");
  if (!form) throw new Error("No <form> element rendered");
  return form as HTMLFormElement;
}
