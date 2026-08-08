import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  useSmartForm,
  zodResolver,
  type FieldError,
  type UseSmartFormReturn,
  type Validator,
} from "../src/index";

afterEach(() => {
  cleanup();
});

describe("zodResolver", () => {
  it("passes valid values with no errors and returns the parsed values", async () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number(),
    });
    const resolver = zodResolver(schema);

    const result = await resolver({ email: "a@b.com", age: 25 });

    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ email: "a@b.com", age: 25 });
  });

  it("maps a required-field error to the correct field", async () => {
    const schema = z.object({
      email: z.string().email("Invalid email"),
    });
    const resolver = zodResolver(schema);

    const result = await resolver({ email: "" });

    expect(result.errors.email).toEqual({ message: "Invalid email" });
  });

  it("maps errors for multiple fields independently", async () => {
    const schema = z.object({
      email: z.string().email("Invalid email"),
      password: z.string().min(8, "Password must be at least 8 characters"),
      username: z.string().min(3, "Username is too short"),
    });
    const resolver = zodResolver(schema);

    const result = await resolver({ email: "not-an-email", password: "short", username: "ab" });

    expect(result.errors.email).toEqual({ message: "Invalid email" });
    expect(result.errors.password).toEqual({ message: "Password must be at least 8 characters" });
    expect(result.errors.username).toEqual({ message: "Username is too short" });
  });

  it("preserves custom error messages", async () => {
    const schema = z.object({
      email: z.string().email("Please enter a valid email"),
    });
    const resolver = zodResolver(schema);

    const result = await resolver({ email: "bad" });

    expect(result.errors.email).toEqual({ message: "Please enter a valid email" });
  });

  it("maps nested object paths to dotted keys", async () => {
    const schema = z.object({
      user: z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email"),
      }),
    });
    const resolver = zodResolver(schema);

    const result = await resolver({ user: { name: "", email: "bad" } });
    const errors = result.errors as Record<string, FieldError>;

    expect(errors["user.name"]).toEqual({ message: "Name is required" });
    expect(errors["user.email"]).toEqual({ message: "Invalid email" });
  });

  it("maps array element paths to dotted keys with indices", async () => {
    const schema = z.object({
      users: z.array(z.object({ email: z.string().email("Invalid email") })),
    });
    const resolver = zodResolver(schema);

    const result = await resolver({ users: [{ email: "first" }, { email: "second" }] });
    const errors = result.errors as Record<string, FieldError>;

    expect(errors["users.0.email"]).toEqual({ message: "Invalid email" });
    expect(errors["users.1.email"]).toEqual({ message: "Invalid email" });
  });

  it("returns parsed values after coercion", async () => {
    const schema = z.object({ age: z.coerce.number() });
    // The resolver's parameter is typed as the Zod output; the raw string input
    // is what the form actually feeds in at runtime, so we widen the type.
    const resolver = zodResolver(schema) as Validator<{ age: string }>;

    const result = await resolver({ age: "25" });

    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ age: 25 });
  });

  it("returns parsed values after transforms rather than the raw input", async () => {
    const schema = z.object({
      slug: z.string().transform((value) => value.toLowerCase().replace(/\s+/g, "-")),
    });
    const resolver = zodResolver(schema);

    const result = await resolver({ slug: "Hello World" });

    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ slug: "hello-world" });
  });

  it("converts Zod failures into errors instead of throwing", async () => {
    const schema = z.object({ email: z.string().email("Invalid email") });
    const resolver = zodResolver(schema);

    await expect(resolver({ email: "nope" })).resolves.toMatchObject({
      errors: { email: { message: "Invalid email" } },
    });
  });
});

describe("zodResolver with useSmartForm", () => {
  interface ZodForm {
    email: string;
    password: string;
  }

  function setup<TSchema extends z.ZodType>(schema: TSchema) {
    const formRef: { current: UseSmartFormReturn<ZodForm> | null } = { current: null };

    function Harness() {
      const form = useSmartForm({
        defaultValues: { email: "", password: "" },
        validate: zodResolver(schema),
      });
      formRef.current = form;

      return (
        <form>
          <input data-testid="email" {...form.register("email")} />
          <input data-testid="password" type="password" {...form.register("password")} />
        </form>
      );
    }

    render(<Harness />);
    return { form: () => formRef.current as UseSmartFormReturn<ZodForm> };
  }

  it("exposes Zod errors through form.errors and isValid", async () => {
    const schema = z.object({
      email: z.string().email("Invalid email"),
      password: z.string().min(8, "Password must be at least 8 characters"),
    });
    const { form } = setup(schema);

    let valid = false;
    await act(async () => {
      valid = await form().trigger();
    });

    expect(valid).toBe(false);
    expect(form().isValid).toBe(false);
    expect(form().errors.email).toEqual({ message: "Invalid email" });
    expect(form().errors.password).toEqual({ message: "Password must be at least 8 characters" });
  });

  it("clears Zod errors when values become valid", async () => {
    const schema = z.object({
      email: z.string().email("Invalid email"),
      password: z.string().min(8, "Password must be at least 8 characters"),
    });
    const { form } = setup(schema);

    await act(async () => {
      await form().trigger();
    });
    expect(form().isValid).toBe(false);

    fireEvent.change(screen.getByTestId("email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByTestId("password"), { target: { value: "longpassword" } });
    await act(async () => {});

    let valid = false;
    await act(async () => {
      valid = await form().trigger();
    });
    expect(valid).toBe(true);
    expect(form().isValid).toBe(true);
    expect(form().errors).toEqual({});
  });
});

describe("zodResolver type inference", () => {
  it("infers the form shape from the schema", () => {
    function typeChecks() {
      const schema = z.object({ email: z.string(), age: z.number() });
      const form = useSmartForm({
        defaultValues: { email: "", age: 18 },
        validate: zodResolver(schema),
      });

      expectTypeOf(form.getValues()).toEqualTypeOf<{ email: string; age: number }>();
      expectTypeOf(form.getValue("email")).toEqualTypeOf<string>();
      form.setValue("age", 30);
    }

    expect(typeChecks).toBeTypeOf("function");
  });

  it("uses Zod output types so coercions keep their type", () => {
    function typeChecks() {
      const schema = z.object({ age: z.coerce.number() });
      const form = useSmartForm({ defaultValues: { age: 0 }, validate: zodResolver(schema) });

      expectTypeOf(form.getValues()).toEqualTypeOf<{ age: number }>();
      expectTypeOf(form.getValue("age")).toEqualTypeOf<number>();
    }

    expect(typeChecks).toBeTypeOf("function");
  });
});
