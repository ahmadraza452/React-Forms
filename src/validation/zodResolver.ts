import type { ZodError, ZodType, output } from "zod";

import type { FieldError, FieldErrors, FieldValues, Validator } from "./types";

/**
 * Maps the flattened Zod issue paths (e.g. `["user", "name"]`) to dotted
 * form error keys (e.g. `"user.name"`). Numeric array segments are converted
 * to string so `["users", 0, "email"]` becomes `"users.0.email"`.
 *
 * Only the first message per field is kept, matching common resolver behavior
 * when a single field triggers multiple Zod checks (e.g. `min` + `max`).
 */
function mapZodIssues(error: ZodError): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {};

  for (const issue of error.issues) {
    const key = issue.path.map((segment) => String(segment)).join(".");
    if (!key) continue;

    if (!(key in errors)) {
      errors[key] = { message: issue.message };
    }
  }

  return errors;
}

/**
 * Creates a {@link Validator} from a Zod schema.
 *
 * The resolver parses the form values with `safeParseAsync` and converts any
 * Zod issues into the form's error format (a `{ message }` per field). On
 * success it returns the parsed values from Zod, so coercions and transforms
 * (e.g. `z.coerce.number()`) are preserved rather than discarded.
 *
 * Zod is a type-only dependency of this module: there is no runtime `zod`
 * import, so `zod` is never bundled into the library output. Consumers that
 * do not use Zod never load it.
 */
export function zodResolver<
  TSchema extends ZodType<unknown, unknown>,
  TFieldValues extends FieldValues = output<TSchema> & FieldValues,
>(schema: TSchema): Validator<TFieldValues> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);

    if (result.success) {
      return { values: result.data as TFieldValues, errors: {} };
    }

    // Nested/array paths ("user.name", "users.0.email") currently outgrow the
    // flat `Path` type of the core engine; the runtime keys are dotted and the
    // cast keeps the resolver compatible with the public `FieldErrors` type.
    return {
      values,
      errors: mapZodIssues(result.error) as FieldErrors<TFieldValues>,
    };
  };
}
