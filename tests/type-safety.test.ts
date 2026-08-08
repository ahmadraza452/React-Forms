import { describe, expect, expectTypeOf, it } from "vitest";

import { useSmartForm } from "../src/index";

interface LoginForm {
  email: string;
  password: string;
}

/**
 * The functions below are never invoked. They exist only so TypeScript
 * verifies the hook's public types (and the `@ts-expect-error` markers) at
 * compile time without running React hooks outside a component.
 */
describe("useSmartForm type safety", () => {
  it("infers field value types", () => {
    function typeChecks() {
      const form = useSmartForm<LoginForm>({
        defaultValues: { email: "", password: "" },
      });

      expectTypeOf(form.getValues()).toEqualTypeOf<LoginForm>();
      expectTypeOf(form.getValue("email")).toEqualTypeOf<string>();
      expectTypeOf(form.getValue("password")).toEqualTypeOf<string>();

      form.setValue("email", "test@example.com");
      form.setValue("password", "secret");
      form.reset({ email: "a@b.c", password: "x" });
    }

    expect(typeChecks).toBeTypeOf("function");
  });

  it("infers the shape from defaultValues", () => {
    function typeChecks() {
      const form = useSmartForm({ defaultValues: { name: "", age: 0 } });

      expectTypeOf(form.getValue("name")).toEqualTypeOf<string>();
      expectTypeOf(form.getValue("age")).toEqualTypeOf<number>();
      form.setValue("age", 30);
    }

    expect(typeChecks).toBeTypeOf("function");
  });

  it("rejects values of the wrong type", () => {
    function typeChecks() {
      const form = useSmartForm<LoginForm>({
        defaultValues: { email: "", password: "" },
      });

      // @ts-expect-error email is a string, not a number
      form.setValue("email", 123);
      // @ts-expect-error password is a string, not a boolean
      form.setValue("password", true);
      // @ts-expect-error unknown field
      form.getValue("doesNotExist");
      // @ts-expect-error unknown field
      form.setValue("doesNotExist", "x");
    }

    expect(typeChecks).toBeTypeOf("function");
  });

  it("rejects reset values that do not match the shape", () => {
    function typeChecks() {
      const form = useSmartForm<LoginForm>({
        defaultValues: { email: "", password: "" },
      });

      // @ts-expect-error missing the password field
      form.reset({ email: "a@b.c" });
      // @ts-expect-error email is a string, not a number
      form.reset({ email: 123, password: "x" });
    }

    expect(typeChecks).toBeTypeOf("function");
  });

  it("rejects defaultValues that do not match the shape", () => {
    function typeChecks() {
      // @ts-expect-error missing the password field
      useSmartForm<LoginForm>({ defaultValues: { email: "" } });
    }

    expect(typeChecks).toBeTypeOf("function");
  });
});
