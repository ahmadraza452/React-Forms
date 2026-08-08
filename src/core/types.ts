import type { ReactNode } from "react";

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
 *
 * The reserved `"root"` key holds form-level (non-field) errors — e.g. a
 * server error such as `"Unable to create account"` that does not belong to a
 * specific field. Server errors set via `setError`/`setErrors` are stored in
 * the same structure as validation errors, so `isValid`, `clearErrors()` and
 * `handleSubmit`'s `onError` treat them identically.
 */
export type FieldErrors<TFieldValues extends FieldValues> = Partial<
  Record<Path<TFieldValues> | "root", FieldError>
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
 * A function invoked when the form is submitted and validation passes.
 *
 * Receives the validated values. When a resolver returns transformed values
 * (e.g. Zod coercion via `zodResolver`), the parsed values are passed. May be
 * asynchronous; {@link UseSmartFormReturn.isSubmitting} stays `true` until the
 * returned promise settles.
 */
export type SubmitHandler<TFieldValues extends FieldValues> = (
  values: TFieldValues,
) => void | Promise<void>;

/**
 * A function invoked when a submission attempt fails validation.
 *
 * Receives the current field errors. Never invoked for unexpected errors
 * thrown inside `onSubmit`.
 */
export type SubmitErrorHandler<TFieldValues extends FieldValues> = (
  errors: FieldErrors<TFieldValues>,
) => void;

/**
 * Configuration options for validation behavior.
 */
export type ValidationMode = "onSubmit" | "onBlur" | "onChange";

/**
 * Configuration options for re-validation behavior when a field already has an error.
 */
export type ReValidateMode = "onChange" | "onBlur";

/**
 * Options accepted by {@link UseSmartFormReturn.setValue}.
 */
export interface SetValueOptions {
  /**
   * Validate the field after updating it.
   *
   * Defaults to `false` — programmatic updates do not run validation unless
   * requested.
   */
  shouldValidate?: boolean;
  /**
   * Mark the field as touched.
   *
   * Defaults to `false`.
   */
  shouldTouch?: boolean;
  /**
   * Mark the field as dirty, even when the new value equals the default.
   *
   * Defaults to `false`. Note that a field whose value differs from its
   * default is always dirty regardless of this option (dirty state is derived
   * from the value comparison).
   */
  shouldDirty?: boolean;
}

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
   * Called when the form is submitted and validation passes.
   *
   * Receives the validated values (parsed/transformed by the resolver when one
   * is configured, e.g. Zod coercion). May be asynchronous; `isSubmitting`
   * stays `true` until the returned promise settles.
   */
  onSubmit?: SubmitHandler<TFieldValues>;

  /**
   * Called when a submission attempt fails validation.
   *
   * Receives the current field errors. Never called for unexpected errors
   * thrown inside `onSubmit`.
   */
  onError?: SubmitErrorHandler<TFieldValues>;

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

/**
 * The internal/external control object used by {@link useWatch} and
 * {@link Controller}.
 *
 * Created once by {@link useSmartForm} and stable across renders. It exposes a
 * minimal surface: subscription hooks (so components re-render only when the
 * fields they care about change), read access, and the mutation bridge used by
 * controlled components. Implementation details of the form are not exposed.
 */
export interface Control<TFieldValues extends FieldValues> {
  /**
   * Subscribes to all form value/state changes.
   *
   * Returns an unsubscribe function.
   */
  subscribe: (listener: () => void) => () => void;

  /**
   * Subscribes to a single field's changes.
   *
   * Returns an unsubscribe function.
   */
  subscribeField: <TPath extends Path<TFieldValues>>(
    name: TPath,
    listener: () => void,
  ) => () => void;

  /**
   * The current store version.
   *
   * Used as the `getSnapshot` value for `useSyncExternalStore`: it changes
   * only when subscribed fields change.
   */
  getSnapshot: () => number;

  /** Returns a deep copy of the current form values. */
  getValues: () => TFieldValues;

  /** Returns a deep copy of a single field's current value. */
  getValue: <TPath extends Path<TFieldValues>>(name: TPath) => TFieldValues[TPath];

  /** Returns the current state of a single field. */
  getFieldState: <TPath extends Path<TFieldValues>>(name: TPath) => FieldState<TFieldValues, TPath>;

  /**
   * Updates a field's value as if the user changed it.
   *
   * Used by `Controller`'s `field.onChange`. Runs the configured validation
   * behavior (`mode` / `reValidateMode`) like `register()`'s `onChange` does.
   */
  updateField: <TPath extends Path<TFieldValues>>(name: TPath, value: TFieldValues[TPath]) => void;

  /**
   * Marks a field as touched as if it lost focus.
   *
   * Used by `Controller`'s `field.onBlur`. Runs the configured validation
   * behavior (`mode` / `reValidateMode`) like `register()`'s `onBlur` does.
   */
  blurField: <TPath extends Path<TFieldValues>>(name: TPath) => void;

  /** Registers a controlled field's DOM element with the form. */
  setFieldRef: (name: Path<TFieldValues>, element: HTMLElement | null) => void;
}

/**
 * The name of a field error target: a field path or the reserved `"root"`
 * key for form-level (server) errors.
 */
export type ErrorName<TFieldValues extends FieldValues> = Path<TFieldValues> | "root";

/**
 * The callable `watch` API returned by {@link useSmartForm}.
 */
export type WatchFunction<TFieldValues extends FieldValues> = {
  /** Returns a deep copy of the complete current form values. */
  (): TFieldValues;
  /** Returns a deep copy of a single field's current value. */
  <TPath extends Path<TFieldValues>>(name: TPath): TFieldValues[TPath];
  /** Returns deep copies of the given fields' current values. */
  <TPaths extends readonly Path<TFieldValues>[]>(
    names: readonly [...TPaths],
  ): {
    [K in keyof TPaths]: TFieldValues[TPaths[K]];
  };
};

/** Props accepted by {@link useWatch}. */
export interface UseWatchProps<TFieldValues extends FieldValues> {
  /** The form control object returned by {@link useSmartForm}. */
  control: Control<TFieldValues>;
  /**
   * The field to watch.
   *
   * Omit this to watch the whole form (re-renders on any value/state change).
   */
  name?: Path<TFieldValues>;
}

/**
 * The `field` object rendered by {@link Controller}.
 */
export interface ControllerField<
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
> {
  /** The controlled field name. */
  name: TName;
  /** The current value of the field. */
  value: TFieldValues[TName];
  /**
   * Updates the form value.
   *
   * Accepts either a native change event or a raw value:
   *
   * ```ts
   * field.onChange(event); // native input
   * field.onChange("new value"); // custom component
   * ```
   */
  onChange: (...event: unknown[]) => void;
  /** Marks the field as touched (and validates per `mode`). */
  onBlur: (...event: unknown[]) => void;
  /** Registers the underlying DOM element with the form. */
  ref: (element: HTMLElement | null) => void;
}

/**
 * The `fieldState` object rendered by {@link Controller}.
 */
export interface ControllerFieldState {
  /** The validation error for the field, if any. */
  error: FieldError | undefined;
  /** Whether the field currently has a validation error. */
  invalid: boolean;
  /** Whether the field has been focused and blurred at least once. */
  touched: boolean;
  /** Whether the field's value differs from its original default value. */
  dirty: boolean;
}

/**
 * The render props passed to {@link Controller}'s `render` function.
 */
export interface ControllerRenderProps<
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
> {
  /** The props to spread onto a controlled component. */
  field: ControllerField<TFieldValues, TName>;
  /** The current state of the controlled field. */
  fieldState: ControllerFieldState;
}

/**
 * Props accepted by {@link Controller}.
 */
export interface ControllerProps<
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
> {
  /** The form control object returned by {@link useSmartForm}. */
  control: Control<TFieldValues>;
  /** The field to control. */
  name: TName;
  /** Renders the controlled component with the current `field` and `fieldState`. */
  render: (props: ControllerRenderProps<TFieldValues, TName>) => ReactNode;
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
   * Programmatic updates do not mark the field as touched or run validation by
   * default; pass {@link SetValueOptions} to opt in.
   *
   * Currently supports top-level fields; nested path support is planned.
   */
  setValue: <TPath extends Path<TFieldValues>>(
    name: TPath,
    value: TFieldValues[TPath],
    options?: SetValueOptions,
  ) => void;

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
   * Watches the current form values.
   *
   * Called without arguments it returns a deep copy of the whole form. When
   * called during render, it is reactive: the component re-renders when the
   * watched values change.
   *
   * ```tsx
   * const email = form.watch("email");
   * const [email, password] = form.watch(["email", "password"]);
   * ```
   */
  watch: WatchFunction<TFieldValues>;

  /**
   * Per-field dirty state: `true` when a field's value differs from its
   * original default value (or it was explicitly marked dirty).
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
   * @param name - Optional field name (or `"root"` for a form-level error) to
   * clear only that error. Without arguments, clears all errors.
   */
  clearErrors: (name?: ErrorName<TFieldValues>) => void;

  /**
   * Sets a single error on a field (or on `"root"` for a form-level error).
   *
   * Primarily intended for server/API errors that arrive after validation:
   * the error is stored like a validation error, makes `isValid` `false`, is
   * passed to `handleSubmit`'s `onError`, and can be cleared with
   * `clearErrors(name)`.
   *
   * ```ts
   * form.setError("email", { message: "Email is already taken" });
   * form.setError("root", "Unable to reach the server");
   * ```
   *
   * @param name - The field name or `"root"`.
   * @param error - The error object, or a plain message string.
   */
  setError: (name: ErrorName<TFieldValues>, error: FieldError | string) => void;

  /**
   * Sets multiple errors at once.
   *
   * Merges into the current errors, so existing errors are kept unless the
   * provided map replaces them. Accepts the same shape as {@link errors},
   * including the `"root"` key.
   */
  setErrors: (errors: FieldErrors<TFieldValues>) => void;

  /**
   * Resets a single field to its default value.
   *
   * Also clears the field's error, touched and dirty state. Other fields are
   * not affected.
   */
  resetField: <TPath extends Path<TFieldValues>>(name: TPath) => void;

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

  /**
   * Submits the form: prevents the browser's default behavior, runs validation
   * and then calls `onSubmit` with the validated values — or `onError` with the
   * field errors when validation fails.
   *
   * ```tsx
   * <form onSubmit={form.handleSubmit}>
   * ```
   *
   * @param event - Optional form event. When passed directly as a form
   * `onSubmit` handler, React provides the event automatically. The default
   * browser submission is always prevented; callers do not need to call
   * `event.preventDefault()` manually.
   * @returns A promise that resolves when the submission finishes and rejects
   * if `onSubmit` throws (unexpected errors are not swallowed).
   */
  handleSubmit: (event?: { preventDefault: () => void }) => Promise<void>;

  /**
   * The control object used by `useWatch` and `Controller`.
   *
   * Stable across renders.
   */
  control: Control<TFieldValues>;

  /**
   * Whether a submission is currently in progress.
   *
   * Becomes `true` while the `onSubmit` callback runs and is reset to `false`
   * when it finishes — even if it throws. Duplicate submission attempts are
   * ignored while a submission is already running.
   */
  isSubmitting: boolean;

  /**
   * Whether the form has been submitted/attempted at least once.
   *
   * Becomes `true` after any submission attempt, including attempts that fail
   * validation, and is reset to `false` by {@link reset}.
   */
  isSubmitted: boolean;

  /**
   * The number of submission attempts made so far.
   *
   * Incremented on every attempt, including attempts that fail validation,
   * and reset to `0` by {@link reset}.
   */
  submitCount: number;
}
