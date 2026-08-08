/**
 * The shape of any form's values.
 *
 * Plain objects are used as the container for form values. Nested objects and
 * arrays are supported at the value level and will be reachable through
 * field-path access in a future iteration.
 */
export type FieldValues = Record<string, unknown>;

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

/** Options accepted by {@link useSmartForm}. */
export interface UseSmartFormOptions<TFieldValues extends FieldValues> {
  /**
   * The initial values of the form.
   *
   * The hook stores its own copy; the passed object is never mutated.
   */
  defaultValues: TFieldValues;
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
   * Neither the original nor the provided values are mutated.
   */
  reset: (values?: TFieldValues) => void;

  /**
   * Whether the current values differ from the original `defaultValues`.
   *
   * Starts `false`, becomes `true` once any value differs, and returns to
   * `false` after `reset()` restores the original values.
   */
  isDirty: boolean;
}
