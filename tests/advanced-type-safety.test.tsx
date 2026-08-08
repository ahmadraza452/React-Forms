import { describe, expect, expectTypeOf, it } from "vitest";

import {
  Controller,
  useSmartForm,
  useWatch,
  type Control,
  type ControllerProps,
  type FieldError,
  type SetValueOptions,
} from "../src/index";

interface ProfileForm {
  email: string;
  age: number;
  user: {
    name: string;
  };
}

const profileDefaultValues: ProfileForm = {
  email: "",
  age: 0,
  user: { name: "" },
};

/**
 * The functions below are never invoked. They exist only so TypeScript
 * verifies the hook's public types (and the `@ts-expect-error` markers) at
 * compile time without running React hooks outside a component.
 */
describe("advanced API type safety", () => {
  it("types watch() for the whole form, single fields and multiple fields", () => {
    function typeChecks() {
      const form = useSmartForm<ProfileForm>({ defaultValues: profileDefaultValues });

      expectTypeOf(form.watch()).toEqualTypeOf<ProfileForm>();
      expectTypeOf(form.watch("email")).toEqualTypeOf<string>();
      expectTypeOf(form.watch("age")).toEqualTypeOf<number>();
      expectTypeOf(form.watch("user")).toEqualTypeOf<{ name: string }>();
      expectTypeOf(form.watch(["email", "age"])).toEqualTypeOf<[string, number]>();

      // @ts-expect-error unknown field name
      form.watch("doesNotExist");
      // @ts-expect-error unknown field name inside the array
      form.watch(["email", "doesNotExist"]);
    }

    expect(typeChecks).toBeTypeOf("function");
  });

  it("rejects invalid value types in setValue and accepts options", () => {
    function typeChecks() {
      const form = useSmartForm<ProfileForm>({ defaultValues: profileDefaultValues });

      form.setValue("email", "test@example.com", {
        shouldValidate: true,
        shouldTouch: true,
        shouldDirty: false,
      });

      // @ts-expect-error email is a string, not a number
      form.setValue("email", 123);
      // @ts-expect-error age is a number, not a string
      form.setValue("age", "old");
      // @ts-expect-error unknown field
      form.setValue("doesNotExist", "x");

      const options: SetValueOptions = { shouldValidate: true };
      form.setValue("email", "a@b.c", options);
    }

    expect(typeChecks).toBeTypeOf("function");
  });

  it("types resetField and control", () => {
    function typeChecks() {
      const form = useSmartForm<ProfileForm>({ defaultValues: profileDefaultValues });

      form.resetField("email");
      form.resetField("age");

      // @ts-expect-error unknown field name
      form.resetField("doesNotExist");

      expectTypeOf(form.control).toEqualTypeOf<Control<ProfileForm>>();
      expectTypeOf(form.control.getFieldState("email")).toMatchTypeOf<{
        value: string;
      }>();
    }

    expect(typeChecks).toBeTypeOf("function");
  });

  it("types getFieldState return values", () => {
    function typeChecks() {
      const form = useSmartForm<ProfileForm>({ defaultValues: profileDefaultValues });

      expectTypeOf(form.getFieldState("email").value).toEqualTypeOf<string>();
      expectTypeOf(form.getFieldState("age").value).toEqualTypeOf<number>();

      // @ts-expect-error unknown field name
      form.getFieldState("doesNotExist");
    }

    expect(typeChecks).toBeTypeOf("function");
  });

  it("types useWatch", () => {
    function typeChecks() {
      const form = useSmartForm<ProfileForm>({ defaultValues: profileDefaultValues });

      const all = useWatch({ control: form.control });
      expectTypeOf(all).toEqualTypeOf<ProfileForm>();

      const email = useWatch({ control: form.control, name: "email" });
      expectTypeOf(email).toEqualTypeOf<string>();

      const age = useWatch({ control: form.control, name: "age" });
      expectTypeOf(age).toEqualTypeOf<number>();

      // @ts-expect-error unknown field name
      useWatch({ control: form.control, name: "doesNotExist" });
    }

    expect(typeChecks).toBeTypeOf("function");
  });

  it("types Controller render props", () => {
    function typeChecks() {
      const form = useSmartForm<ProfileForm>({ defaultValues: profileDefaultValues });

      const element = (
        <Controller<ProfileForm, "email">
          control={form.control}
          name="email"
          render={({ field, fieldState }) => {
            expectTypeOf(field.name).toEqualTypeOf<"email">();
            expectTypeOf(field.value).toEqualTypeOf<string>();
            expectTypeOf(fieldState.error).toEqualTypeOf<FieldError | undefined>();
            expectTypeOf(fieldState.invalid).toEqualTypeOf<boolean>();
            expectTypeOf(fieldState.touched).toEqualTypeOf<boolean>();
            expectTypeOf(fieldState.dirty).toEqualTypeOf<boolean>();
            return (
              <input
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
              />
            );
          }}
        />
      );

      expectTypeOf(element).toMatchTypeOf<unknown>();

      // @ts-expect-error wrong field name for the generic
      <Controller<ProfileForm, "email"> control={form.control} name="age" render={() => null} />;

      const props: ControllerProps<ProfileForm, "email"> = {
        control: form.control,
        name: "email",
        render: () => null,
      };
      expectTypeOf(props).toEqualTypeOf<ControllerProps<ProfileForm, "email">>();
    }

    expect(typeChecks).toBeTypeOf("function");
  });
});
