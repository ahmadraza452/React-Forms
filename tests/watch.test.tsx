import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useSmartForm, type UseSmartFormReturn } from "../src/index";

interface FormValues {
  email: string;
  password: string;
}

const defaultValues: FormValues = { email: "", password: "" };

function setup() {
  const formRef: { current: UseSmartFormReturn<FormValues> | null } = { current: null };

  function Harness() {
    const form = useSmartForm({ defaultValues });
    formRef.current = form;
    return <div />;
  }

  render(<Harness />);

  return { form: () => formRef.current as UseSmartFormReturn<FormValues> };
}

afterEach(() => {
  cleanup();
});

describe("watch", () => {
  it("returns the entire form values", () => {
    const { form } = setup();

    expect(form().watch()).toEqual({ email: "", password: "" });

    act(() => {
      form().setValue("email", "a@b.c");
    });

    expect(form().watch()).toEqual({ email: "a@b.c", password: "" });
  });

  it("returns a fresh copy each time", () => {
    const { form } = setup();

    const first = form().watch();
    const second = form().watch();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("watches a single field", () => {
    const { form } = setup();

    expect(form().watch("email")).toBe("");

    act(() => {
      form().setValue("email", "a@b.c");
    });

    expect(form().watch("email")).toBe("a@b.c");
    expect(form().watch("password")).toBe("");
  });

  it("watches multiple fields", () => {
    const { form } = setup();

    act(() => {
      form().setValue("email", "a@b.c");
      form().setValue("password", "secret");
    });

    expect(form().watch(["email", "password"])).toEqual(["a@b.c", "secret"]);
  });

  it("returns a fresh object copy for object-typed fields", () => {
    const { result } = renderHook(() => useSmartForm({ defaultValues: { user: { name: "" } } }));

    act(() => {
      result.current.setValue("user", { name: "Ahmad" });
    });

    expect(result.current.watch("user")).toEqual({ name: "Ahmad" });
    expect(result.current.watch("user")).not.toBe(result.current.watch("user"));
  });

  it("reactively updates a single watched field during render", () => {
    function Harness() {
      const form = useSmartForm({ defaultValues });
      const email = form.watch("email");
      return (
        <div>
          <input aria-label="email" {...form.register("email")} />
          <p data-testid="out">{email}</p>
        </div>
      );
    }

    render(<Harness />);
    expect(screen.getByTestId("out").textContent).toBe("");

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "hello@example.com" } });

    expect(screen.getByTestId("out").textContent).toBe("hello@example.com");
  });

  it("reactively updates multiple watched fields during render", () => {
    function Harness() {
      const form = useSmartForm({ defaultValues });
      const [email, password] = form.watch(["email", "password"]);
      return (
        <div>
          <input aria-label="email" {...form.register("email")} />
          <input aria-label="password" {...form.register("password")} />
          <p data-testid="out">
            {email}|{password}
          </p>
        </div>
      );
    }

    render(<Harness />);
    expect(screen.getByTestId("out").textContent).toBe("|");

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.c" } });
    expect(screen.getByTestId("out").textContent).toBe("a@b.c|");

    fireEvent.change(screen.getByLabelText("password"), { target: { value: "secret" } });
    expect(screen.getByTestId("out").textContent).toBe("a@b.c|secret");
  });

  it("reflects setValue and reset changes", () => {
    const { form } = setup();

    act(() => {
      form().setValue("email", "initial@example.com");
    });
    expect(form().watch("email")).toBe("initial@example.com");

    act(() => {
      form().reset();
    });
    expect(form().watch("email")).toBe("");
  });
});
