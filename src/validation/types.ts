/**
 * A single field error with a message and optional metadata for future extensibility.
 */
export interface FieldError {
  /** Human-readable error message. */
  message: string;
  /** Optional metadata for custom error handling (e.g., error codes, params). */
  meta?: Record<string, unknown>;
}

/**
 * A map of field errors for a given form values shape.
 *
 * Uses `Partial<Record<Path<TFieldValues>, FieldError>>` to allow for
 * future nested path support while remaining type-safe for flat structures.
 */
export type FieldErrors<TFieldValues extends FieldValues> = Partial<
  Record<Path<TFieldValues>, FieldError>
>;

/**
 * The result of a validation operation.
 */
export interface ValidationResult<TFieldValues extends FieldValues> {
  /** The validated values (may be transformed/normalized by the resolver). */
  values?: TFieldValues;
  /** Map of field errors. Empty when validation passes. */
  errors: FieldErrors<TFieldValues>;
}

/**
 * A function that validates form values and returns a validation result.
 *
 * Can be synchronous or asynchronous.
 */
export type Validator<TFieldValues extends FieldValues> = (
  values: TFieldValues,
) => ValidationResult<TFieldValues> | Promise<ValidationResult<TFieldValues>>;

/**
 * Configuration options for validation behavior.
 */
export type ValidationMode = "onSubmit" | "onBlur" | "onChange";

/**
 * Configuration options for re-validation behavior when a field already has an error.
 */
export type ReValidateMode = "onChange" | "onBlur";

/**
 * Options for the validation system.
 */
export interface ValidationOptions<TFieldValues extends FieldValues> {
  /** The validation resolver function. */
  validate?: Validator<TFieldValues>;
  /** When to validate the form. Default: "onSubmit". */
  mode?: ValidationMode;
  /** When to re-validate a field that already has an error. Default: "onChange". */
  reValidateMode?: ReValidateMode;
}

/**
 * Extended field state including validation information.
 */
export interface FieldState<TFieldValues extends FieldValues, TPath extends Path<TFieldValues>> {
  /** The current value of the field. */
  value: TFieldValues[TPath];
  /** Whether the field has been focused and blurred at least once. */
  touched: boolean;
  /** Whether the field's value differs from its original default value. */
  dirty: boolean;
  /** The validation error for this field, if any. */
  error?: FieldError;
  /** Whether the field currently has a validation error. */
  invalid: boolean;
}

/**
 * The shape of any form's values.
 */
export type FieldValues = object;

/**
 * The path (field name) type for a given values shape.
 */
export type Path<TFieldValues extends FieldValues> = keyof TFieldValues & string;

/**
 * The value type of a field at a given {@link Path}.
 */
export type PathValue<
  TFieldValues extends FieldValues,
  TPath extends Path<TFieldValues>,
> = TFieldValues[TPath];
