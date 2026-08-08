import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
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

function setup(children: (control: UseSmartFormReturn<FormValues>["control"]) => ReactNode) {
  const formRef: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

  function Harness() {
    const form = useSmartForm({ defaultValues });
    formRef.current = form;
    return (
      <div>
        <input aria-label="email" {...form.register("email")} />
        <input aria-label="password" {...form.register("password")} />
        {children(form.control)}
      </div>
    );
  }

  render(<Harness />);

  return { form: () => formRef.current as UseSmartFormReturn<FormValues> };
}

describe("useWatch", () => {
  it("watches a single field from a child component", () => {
    function Watcher({ control }: { control: UseSmartFormReturn<FormValues>["control"] }) {
      const email = useWatch({ control, name: "email" });
      return <p data-testid="watched">{email}</p>;
    }

    const { form } = setup((control) => <Watcher control={control} />);

    expect(screen.getByTestId("watched").textContent).toBe("");

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.c" } });

    expect(screen.getByTestId("watched").textContent).toBe("a@b.c");
    expect(form().getValue("email")).toBe("a@b.c");
  });

  it("watches the whole form", () => {
    function Watcher({ control }: { control: UseSmartFormReturn<FormValues>["control"] }) {
      const values = useWatch({ control });
      return (
        <p data-testid="watched">
          {values.email}|{values.password}
        </p>
      );
    }

    setup((control) => <Watcher control={control} />);

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "secret" } });

    expect(screen.getByTestId("watched").textContent).toBe("a@b.c|secret");
  });

  it("updates after setValue", () => {
    function Watcher({ control }: { control: UseSmartFormReturn<FormValues>["control"] }) {
      const email = useWatch({ control, name: "email" });
      return <p data-testid="watched">{email}</p>;
    }

    const { form } = setup((control) => <Watcher control={control} />);

    act(() => {
      form().setValue("email", "programmatic@example.com");
    });

    expect(screen.getByTestId("watched").textContent).toBe("programmatic@example.com");
  });
});
