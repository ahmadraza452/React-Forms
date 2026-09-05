import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSmartForm, type UseSmartFormReturn } from "../src";

afterEach(cleanup);

interface Values {
  email: string;
  age: number;
  accepted: boolean;
  plan: string;
  tags: string[];
}

const defaults: Values = { email: "", age: 0, accepted: false, plan: "basic", tags: [] };

describe("v1.1 field rules", () => {
  it("runs built-in and async custom rules through trigger", async () => {
    let form!: UseSmartFormReturn<Values>;
    function Harness() {
      form = useSmartForm({ defaultValues: defaults });
      return (
        <>
          <input
            data-testid="email"
            {...form.register("email", {
              required: "Email is required",
              pattern: { value: /@/, message: "Invalid email" },
              validate: async (value) => value !== "used@example.com" || "Email is used",
            })}
          />
          <input {...form.register("age", { min: { value: 18, message: "Adults only" } })} />
        </>
      );
    }
    render(<Harness />);
    expect(await form.trigger("email")).toBe(false);
    expect(form.errors.email?.message).toBe("Email is required");
    fireEvent.change(screen.getByTestId("email"), { target: { value: "bad" } });
    expect(await form.trigger("email")).toBe(false);
    expect(form.errors.email?.message).toBe("Invalid email");
    fireEvent.change(screen.getByTestId("email"), { target: { value: "used@example.com" } });
    expect(await form.trigger("email")).toBe(false);
    expect(form.errors.email?.message).toBe("Email is used");
  });

  it("gives field rules precedence over resolver errors", async () => {
    let form!: UseSmartFormReturn<Values>;
    function Harness() {
      form = useSmartForm({
        defaultValues: defaults,
        validate: () => ({ errors: { email: { message: "Resolver error" } } }),
      });
      return <input {...form.register("email", { required: "Rule error" })} />;
    }
    render(<Harness />);
    await form.trigger();
    expect(form.errors.email?.message).toBe("Rule error");
  });
});

describe("v1.1 native inputs", () => {
  it("handles checkbox, radio and multiple select and syncs programmatic updates", () => {
    let form!: UseSmartFormReturn<Values>;
    function Harness() {
      form = useSmartForm({ defaultValues: defaults });
      return (
        <>
          <input
            data-testid="accepted"
            type="checkbox"
            {...form.register("accepted", { type: "checkbox" })}
          />
          <input
            data-testid="basic"
            type="radio"
            {...form.register("plan", { type: "radio", value: "basic" })}
          />
          <input
            data-testid="pro"
            type="radio"
            {...form.register("plan", { type: "radio", value: "pro" })}
          />
          <select
            data-testid="tags"
            multiple
            {...form.register("tags", { type: "select-multiple" })}
          >
            <option value="react">React</option>
            <option value="ts">TypeScript</option>
          </select>
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByTestId("accepted"));
    fireEvent.click(screen.getByTestId("pro"));
    const select = screen.getByTestId("tags") as HTMLSelectElement;
    select.options[0]!.selected = true;
    select.options[1]!.selected = true;
    fireEvent.change(select);
    expect(form.getValues()).toEqual({
      ...defaults,
      accepted: true,
      plan: "pro",
      tags: ["react", "ts"],
    });
    act(() => form.reset());
    expect((screen.getByTestId("accepted") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId("basic") as HTMLInputElement).checked).toBe(true);
  });
});

describe("v1.1 focus", () => {
  it("focuses the first invalid enabled mounted field on submit", async () => {
    const submit = vi.fn();
    function Harness() {
      const form = useSmartForm({
        defaultValues: defaults,
        shouldFocusError: true,
        onSubmit: submit,
      });
      return (
        <form onSubmit={form.handleSubmit}>
          <input disabled {...form.register("age", { min: 18 })} />
          <input data-testid="email" {...form.register("email", { required: "Required" })} />
          <button type="submit">Submit</button>
        </form>
      );
    }
    render(<Harness />);
    fireEvent.submit(screen.getByRole("button").closest("form")!);
    await act(async () => {});
    expect(document.activeElement).toBe(screen.getByTestId("email"));
    expect(submit).not.toHaveBeenCalled();
  });
});
