import type { FieldErrors, FieldValues, ValidationResult, Validator } from "./types";

/**
 * Creates a synchronous validator from a function that returns errors.
 *
 * Useful for simple validation logic that doesn't require async operations.
 */
export function createSyncValidator<TFieldValues extends FieldValues>(
  validate: (values: TFieldValues) => FieldErrors<TFieldValues>,
): Validator<TFieldValues> {
  return (values) => ({
    values,
    errors: validate(values),
  });
}

/**
 * Creates an asynchronous validator from a function that returns errors.
 *
 * Useful for async validation like API checks.
 */
export function createAsyncValidator<TFieldValues extends FieldValues>(
  validate: (values: TFieldValues) => Promise<FieldErrors<TFieldValues>>,
): Validator<TFieldValues> {
  return async (values) => ({
    values,
    errors: await validate(values),
  });
}

/**
 * Combines multiple validators into a single validator that runs all of them
 * and merges their errors.
 */
export function combineValidators<TFieldValues extends FieldValues>(
  ...validators: Validator<TFieldValues>[]
): Validator<TFieldValues> {
  return async (values) => {
    let mergedErrors: FieldErrors<TFieldValues> = {};

    for (const validator of validators) {
      const result = await validator(values);
      if (result.errors) {
        mergedErrors = { ...mergedErrors, ...result.errors };
      }
    }

    return {
      values,
      errors: mergedErrors,
    };
  };
}

/**
 * Validates a single field using the provided validator.
 *
 * This is a utility for field-level validation that can be used by resolvers
 * that support partial validation.
 */
export async function validateField<TFieldValues extends FieldValues>(
  validator: Validator<TFieldValues>,
  values: TFieldValues,
): Promise<ValidationResult<TFieldValues>> {
  return validator(values);
}

/**
 * Checks if a validation result has any errors.
 */
export function hasErrors<TFieldValues extends FieldValues>(
  result: ValidationResult<TFieldValues>,
): boolean {
  return Object.keys(result.errors || {}).length > 0;
}

/**
 * Gets the first error from a validation result, if any.
 */
export function getFirstError<TFieldValues extends FieldValues>(
  result: ValidationResult<TFieldValues>,
): { field: string; error: { message: string } } | undefined {
  const errors = result.errors || {};
  const firstKey = Object.keys(errors)[0];
  if (!firstKey) return undefined;
  const error = errors[firstKey as keyof typeof errors];
  if (!error) return undefined;
  return { field: firstKey, error };
}
