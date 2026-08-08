import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { memo } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useSmartForm, useWatch, type UseSmartFormReturn } from "../src/index";

interface FormValues {
  email: string;
  password: string;
}

const defaultValues: FormValues = { email: "", password: "" };

afterEach(() => {
  cleanup();
});

describe("field subscriptions", () => {
  it("updates a subscribed field when only that field changes", () => {
    const renders: { current: number } = { current: 0 };

    const EmailWatcher = memo(function EmailWatcher({
      control,
    }: {
      control: UseSmartFormReturn<FormValues>["control"];
    }) {
      renders.current += 1;
      const email = useWatch({ control, name: "email" });
      return <p data-testid="watched">{email}</p>;
    });

    function Harness() {
      const form = useSmartForm({ defaultValues });
      return (
        <div>
          <input aria-label="email" {...form.register("email")} />
          <input aria-label="password" {...form.register("password")} />
          <EmailWatcher control={form.control} />
        </div>
      );
    }

    render(<Harness />);
    expect(screen.getByTestId("watched").textContent).toBe("");
    expect(renders.current).toBe(1);

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.c" } });
    expect(screen.getByTestId("watched").textContent).toBe("a@b.c");
    expect(renders.current).toBe(2);

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "b@c.d" } });
    expect(screen.getByTestId("watched").textContent).toBe("b@c.d");
    expect(renders.current).toBe(3);
  });

  it("does not re-render an unrelated subscribed field", () => {
    const renders: { current: number } = { current: 0 };

    const EmailWatcher = memo(function EmailWatcher({
      control,
    }: {
      control: UseSmartFormReturn<FormValues>["control"];
    }) {
      renders.current += 1;
      const email = useWatch({ control, name: "email" });
      return <p data-testid="watched">{email}</p>;
    });

    function Harness() {
      const form = useSmartForm({ defaultValues });
      return (
        <div>
          <input aria-label="email" {...form.register("email")} />
          <input aria-label="password" {...form.register("password")} />
          <EmailWatcher control={form.control} />
        </div>
      );
    }

    render(<Harness />);
    expect(renders.current).toBe(1);

    // Changing an unrelated field must not re-render the email watcher.
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "secret" } });
    expect(renders.current).toBe(1);
    expect(screen.getByTestId("watched").textContent).toBe("");

    // Changing the watched field re-renders exactly once.
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.c" } });
    expect(renders.current).toBe(2);
  });

  it("re-renders a whole-form watcher on any field change", () => {
    const renders: { current: number } = { current: 0 };

    const FormWatcher = memo(function FormWatcher({
      control,
    }: {
      control: UseSmartFormReturn<FormValues>["control"];
    }) {
      renders.current += 1;
      const values = useWatch({ control });
      return (
        <p data-testid="watched">
          {values.email}|{values.password}
        </p>
      );
    });

    function Harness() {
      const form = useSmartForm({ defaultValues });
      return (
        <div>
          <input aria-label="email" {...form.register("email")} />
          <input aria-label="password" {...form.register("password")} />
          <FormWatcher control={form.control} />
        </div>
      );
    }

    render(<Harness />);
    expect(renders.current).toBe(1);

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.c" } });
    expect(screen.getByTestId("watched").textContent).toBe("a@b.c|");
    expect(renders.current).toBe(2);

    fireEvent.change(screen.getByLabelText("password"), { target: { value: "secret" } });
    expect(screen.getByTestId("watched").textContent).toBe("a@b.c|secret");
    expect(renders.current).toBe(3);
  });

  it("keeps the control reference stable across renders", () => {
    const controls: unknown[] = [];
    const { rerender } = render(<Harness controls={controls} />);
    rerender(<Harness controls={controls} />);
    rerender(<Harness controls={controls} />);

    expect(new Set(controls).size).toBe(1);
  });
});

function Harness({ controls }: { controls: unknown[] }) {
  const form = useSmartForm({ defaultValues });
  controls.push(form.control);
  return <div />;
}
