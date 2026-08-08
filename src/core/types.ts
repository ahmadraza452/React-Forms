/**
 * The shape of any form's values.
 *
 * Any object type is accepted as the container for form values. The
 * constraint is intentionally broad so that both `interface` declarations and
 * inline object literals can be used as the generic shape (TypeScript does
 * not give interfaces an implicit index signature, so a stricter `Record`
 * constraint would reject them).
 */
export type FieldValues = object;

/**
 * The path (field name) type for a given values shape.
 *
 * Currently resolves to the top-level field names. This is the single
 * extension point for nested-field support (e.g. `"user.name"` or
 * `"items.0.id"`), which will be added in a future iteration without changing
 * the public API.
 */
export type Path<TFieldValues extends FieldValues> = keyof TFieldValues & string;

/**
 * The value type of a field at a given {@link Path}.
 *
 * Resolves to the current top-level value type and will be extended together
 * with {@link Path} to resolve nested values once path support lands.
 */
export type PathValue<
  TFieldValues extends FieldValues,
  TPath extends Path<TFieldValues>,
> = TFieldValues[TPath];

/**
 * The type of the change/blur handlers returned by {@link register}.
 *
 * Intentionally permissive so the returned props can be spread onto any
 * native input (`input`, `textarea`, `select`) as well as custom input
 * components, matching React's own event handler expectations. The handlers
 * inspect the DOM event at runtime.
 */
export type ChangeHandler = (...event: unknown[]) => void;

/**
 * A single field error with a message and optional metadata.
 */
export interface FieldError {
  /** Human-readable error message. */
  message: string;
  /** Optional metadata for custom error handling. */
  meta?: Record<string, unknown>;
}

/**
 * A map of field errors for a given form values shape.
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

/** Options accepted by {@link useSmartForm}. */
export interface UseSmartFormOptions<TFieldValues extends FieldValues> {
  /**
   * The initial values of the form.
   *
   * The hook stores its own copy; the passed object is never mutated.
   */
  defaultValues: TFieldValues;

  /**
   * The validation resolver function.
   *
   * Can be synchronous or asynchronous. Receives the current form values
   * and should return a validation result with optional transformed values
   * and a map of field errors.
   */
  validate?: Validator<TFieldValues>;

  /**
   * When to validate the form.
   *
   * - `"onSubmit"`: Only validate when explicitly triggered (default).
   * - `"onBlur"`: Validate a field when it loses focus.
   * - `"onChange"`: Validate a field when its value changes.
   *
   * @default "onSubmit"
   */
  mode?: ValidationMode;

  /**
   * When to re-validate a field that already has an error.
   *
   * - `"onChange"`: Re-validate when the field value changes (default).
   * - `"onBlur"`: Re-validate when the field loses focus.
   *
   * @default "onChange"
   */
  reValidateMode?: ReValidateMode;
}

/**
 * The props returned by {@link useSmartForm}.register and meant to be spread
 * onto a native input element (or a compatible custom component).
 */
export interface UseSmartFormRegisterReturn<
  TFieldValues extends FieldValues,
  TPath extends Path<TFieldValues>,
> {
  /** The registered field name. */
  name: TPath;
  /**
   * The current value of the field.
   *
   * For number inputs whose stored value is `NaN` (i.e. the input was
   * cleared), `""` is rendered instead so the field displays as empty.
   */
  value: TFieldValues[TPath];
  /** Updates the form state when the field value changes. */
  onChange: ChangeHandler;
  /** Marks the field as touched when it loses focus. */
  onBlur: ChangeHandler;
  /**
   * Registers the underlying DOM element with the form so it can be tracked
   * and accessed when needed.
   */
  ref: (element: HTMLElement | null) => void;
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
  error: FieldError | undefined;
  /** Whether the field currently has a validation error. */
  invalid: boolean;
}

/** The object returned by {@link useSmartForm}. */
export interface UseSmartFormReturn<TFieldValues extends FieldValues> {
  /**
   * Returns a copy of the current complete form values.
   */
  getValues: () => TFieldValues;

  /**
   * Returns a copy of the current value of a single field.
   *
   * Currently supports top-level fields; nested path support is planned.
   */
  getValue: <TPath extends Path<TFieldValues>>(name: TPath) => TFieldValues[TPath];

  /**
   * Updates the value of a single field and triggers a re-render.
   *
   * The field name and its value are type-checked against the form shape.
   * Currently supports top-level fields; nested path support is planned.
   */
  setValue: <TPath extends Path<TFieldValues>>(name: TPath, value: TFieldValues[TPath]) => void;

  /**
   * Resets the form.
   *
   * - Without arguments, restores the original `defaultValues`.
   * - With values, uses them as the new current form values.
   *
   * Also resets `isDirty`, `dirtyFields` and `touchedFields`. Neither the
   * original nor the provided values are mutated.
   */
  reset: (values?: TFieldValues) => void;

  /**
   * Registers a field, returning the props to spread onto an input.
   *
   * ```tsx
   * <input {...form.register("email")} />
   * ```
   *
   * The returned `onChange` updates the form automatically. Spreading
   * additional props (or overriding a returned handler) after `register(...)`
   * is normal React behavior: the later value wins, so overriding `onChange`
   * stops the automatic update.
   */
  register: <TPath extends Path<TFieldValues>>(
    name: TPath,
  ) => UseSmartFormRegisterReturn<TFieldValues, TPath>;

  /**
   * Per-field dirty state: `true` when a field's value differs from its
   * original default value.
   */
  dirtyFields: Record<keyof TFieldValues, boolean>;

  /**
   * Per-field touched state: `true` once a field has been focused and
   * blurred. Reset to all `false` by {@link reset}.
   */
  touchedFields: Record<keyof TFieldValues, boolean>;

  /**
   * Returns the current state of a single field.
   */
  getFieldState: <TPath extends Path<TFieldValues>>(name: TPath) => FieldState<TFieldValues, TPath>;

  /**
   * Whether the current values differ from the original `defaultValues`.
   *
   * Starts `false`, becomes `true` once any value differs, and returns to
   * `false` after `reset()` restores the original values.
   */
  isDirty: boolean;

  /**
   * Validates the form or a specific field.
   *
   * @param name - Optional field name to validate only that field.
   * @returns `true` if validation passes, `false` if validation fails.
   */
  trigger: (name?: Path<TFieldValues>) => Promise<boolean>;

  /**
   * Clears validation errors.
   *
   * @param name - Optional field name to clear only that field's error.
   */
  clearErrors: (name?: Path<TFieldValues>) => void;

  /**
   * Current validation errors for all fields.
   */
  errors: FieldErrors<TFieldValues>;

  /**
   * Whether the form is currently valid (no validation errors).
   *
   * Before the first validation run, this is `true` (optimistic default).
   * After validation runs, it reflects the actual validation state.
   */
  isValid: boolean;
}
