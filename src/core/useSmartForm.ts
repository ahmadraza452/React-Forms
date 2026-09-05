import { useCallback, useMemo, useRef, useState } from "react";

import { deepClone } from "../utils/deepClone";
import { deepEqual } from "../utils/deepEqual";
import { getEventValue } from "./eventValue";
import { createFieldSubscriptionStore, type FieldSubscriptionStore } from "./store";
import type {
  ChangeHandler,
  Control,
  FieldError,
  FieldErrors,
  FieldState,
  FieldValues,
  Path,
  RegisterOptions,
  RegisterFunction,
  SetValueOptions,
  UseSmartFormOptions,
  UseSmartFormRegisterReturn,
  UseSmartFormReturn,
  ValidationResult,
  ValidationRule,
  WatchFunction,
} from "./types";

/**
 * Builds an all-`false` touched-state record for the given values.
 */
function initialTouchedState<TFieldValues extends FieldValues>(
  values: TFieldValues,
): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const key of Object.keys(values)) {
    state[key] = false;
  }
  return state;
}

/**
 * Renders a `NaN` number value as an empty string.
 *
 * Cleared number inputs store `NaN`; an empty string is the correct display
 * value for the DOM while the stored value stays numeric.
 */
function toDisplayValue(value: unknown): unknown {
  return typeof value === "number" && Number.isNaN(value) ? "" : value;
}

/**
 * Manages the state of a form: values, default values, field registration,
 * single-field reads and writes, reset, form state, watching and controlled
 * components.
 *
 * The form keeps its own copy of `defaultValues` and never mutates the object
 * passed by the caller.
 *
 * Components that need to react to individual fields (`useWatch`,
 * `Controller`) subscribe through `form.control` and re-render only when their
 * subscribed fields change, instead of on every form-wide change.
 */
export function useSmartForm<TFieldValues extends FieldValues>(
  options: UseSmartFormOptions<TFieldValues>,
): UseSmartFormReturn<TFieldValues> {
  const {
    validate,
    mode = "onSubmit",
    reValidateMode = "onChange",
    onSubmit,
    onError,
    shouldFocusError = false,
  } = options;

  const defaultValuesRef = useRef<TFieldValues | null>(null);
  if (defaultValuesRef.current === null) {
    defaultValuesRef.current = deepClone(options.defaultValues);
  }
  const defaults = defaultValuesRef.current as TFieldValues;

  const [values, setValues] = useState<TFieldValues>(() => deepClone(options.defaultValues));

  /**
   * Always holds the latest values snapshot so async callbacks and subscribed
   * components never read stale state from a closed-over render.
   */
  const valuesRef = useRef<TFieldValues>(values);
  valuesRef.current = values;

  /**
   * Touched state is kept in a ref (for synchronous reads by subscribed
   * components) and mirrored in React state (to re-render the host component).
   */
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>(() =>
    initialTouchedState(options.defaultValues),
  );
  const touchedRef = useRef<Record<string, boolean>>(initialTouchedState(options.defaultValues));

  /**
   * Dirty overrides let `setValue(name, value, { shouldDirty: true })` force a
   * field dirty even when its value equals the default. Like touched, it lives
   * in a ref (reads) mirrored in state (host re-renders).
   */
  const [dirtyOverrides, setDirtyOverrides] = useState<Record<string, boolean>>({});
  const dirtyOverridesRef = useRef<Record<string, boolean>>({});

  // -------------------------------------------------------------------
  // Errors are stored in a ref (for synchronous reads immediately after
  // updates) AND trigger a React re-render via forceUpdate.
  // All writes go through `commitErrors` so both are kept in sync.
  //
  // This avoids the need for flushSync (which cannot be called inside
  // React event handlers) while still allowing callers to read the
  // latest errors immediately after `await form.trigger()`.
  // -------------------------------------------------------------------
  const [, forceUpdate] = useState(0);
  const errorsRef = useRef<FieldErrors<TFieldValues>>({});

  /**
   * Monotonically increasing counter used to discard stale async validation
   * results. Every validation run (and `reset`/`resetField`) bumps it; a run
   * only commits its result if its captured sequence number is still current
   * when it resolves. This prevents an older, slower validation from
   * overwriting a newer one (race conditions on async resolvers).
   */
  const validationSeqRef = useRef(0);
  const fieldValidationSeqRef = useRef<Record<string, number>>({});
  const rulesRef = useRef<Record<string, RegisterOptions<TFieldValues, Path<TFieldValues>>>>({});

  // -------------------------------------------------------------------
  // Field-subscription store.
  //
  // `useWatch`/`Controller` components subscribe through `form.control` and
  // are notified only when the fields they care about change. The store lives
  // outside React state so it can be notified synchronously from within event
  // handlers and async callbacks.
  // -------------------------------------------------------------------
  const storeRef = useRef<FieldSubscriptionStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createFieldSubscriptionStore();
  }
  const store = storeRef.current!;

  const notifyFields = useCallback(
    (changedFields: readonly string[]) => {
      if (changedFields.length === 0) return;
      store.notify(changedFields);
    },
    [store],
  );

  /**
   * Writes new errors to the ref (immediate), schedules a React re-render and
   * notifies the subscribers of the fields whose errors changed.
   */
  const commitErrors = useCallback(
    (next: FieldErrors<TFieldValues>) => {
      const prev = errorsRef.current;
      const prevErrors = prev as Record<string, FieldError | undefined>;
      const nextErrors = next as Record<string, FieldError | undefined>;
      const changed: string[] = [];
      for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
        if (!deepEqual(prevErrors[key], nextErrors[key])) changed.push(key);
      }
      errorsRef.current = next;
      forceUpdate((n) => n + 1);
      notifyFields(changed);
    },
    [notifyFields],
  );

  // -------------------------------------------------------------------
  // Submission state: isSubmitting, isSubmitted, submitCount.
  // `isSubmittingRef` mirrors `isSubmitting` so the duplicate-submission
  // guard in handleSubmit can be checked synchronously, before any await.
  // -------------------------------------------------------------------
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const isSubmittingRef = useRef(false);

  const fieldRefs = useRef<Record<string, HTMLElement[]>>({});

  const rememberFieldRef = useCallback((name: string, element: HTMLElement | null) => {
    if (!element) return;
    const current = fieldRefs.current[name] ?? [];
    if (!current.includes(element)) fieldRefs.current[name] = [...current, element];
  }, []);

  const setFocus = useCallback(<TPath extends Path<TFieldValues>>(name: TPath) => {
    const element = (fieldRefs.current[name] ?? []).find(
      (candidate) => candidate.isConnected && !(candidate as HTMLInputElement).disabled,
    );
    element?.focus();
  }, []);

  const focusFirstError = useCallback((errors: FieldErrors<TFieldValues>) => {
    const candidates = Object.keys(errors)
      .filter((name) => name !== "root")
      .flatMap((name) => fieldRefs.current[name] ?? [])
      .filter(
        (element) =>
          element.isConnected &&
          !(element as HTMLInputElement).disabled &&
          typeof element.focus === "function",
      );
    candidates.sort((left, right) => {
      const position = left.compareDocumentPosition(right);
      return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    candidates[0]?.focus();
  }, []);

  const dirtyFields = useMemo<Record<keyof TFieldValues, boolean>>(() => {
    const result = {} as Record<keyof TFieldValues, boolean>;
    for (const key of Object.keys(values)) {
      result[key as keyof TFieldValues] =
        dirtyOverrides[key] === true ||
        !deepEqual(
          (values as Record<string, unknown>)[key],
          (defaults as Record<string, unknown>)[key],
        );
    }
    return result;
  }, [values, dirtyOverrides]);

  const isDirty = useMemo(() => Object.values(dirtyFields).some(Boolean), [dirtyFields]);

  const getValues = useCallback((): TFieldValues => deepClone(valuesRef.current), []);

  const getValue = useCallback(
    <TPath extends Path<TFieldValues>>(name: TPath): TFieldValues[TPath] =>
      deepClone(valuesRef.current[name]) as TFieldValues[TPath],
    [],
  );

  /**
   * Reads a field's state directly from the refs.
   *
   * Subscribed components call this after being notified of a change, so it
   * must return data that is already consistent (values/touched/errors refs are
   * updated synchronously before the notification fires).
   */
  const readFieldState = useCallback(
    <TPath extends Path<TFieldValues>>(name: TPath): FieldState<TFieldValues, TPath> => ({
      value: deepClone(valuesRef.current[name]) as TFieldValues[TPath],
      touched: touchedRef.current[name] === true,
      dirty:
        dirtyOverridesRef.current[name] === true ||
        !deepEqual(
          (valuesRef.current as Record<string, unknown>)[name],
          (defaults as Record<string, unknown>)[name],
        ),
      error: errorsRef.current[name],
      invalid: !!errorsRef.current[name],
    }),
    [defaults],
  );

  const getFieldState = useCallback(
    <TPath extends Path<TFieldValues>>(name: TPath): FieldState<TFieldValues, TPath> =>
      readFieldState(name),
    [readFieldState],
  );

  const validateRules = useCallback(
    async (
      name: Path<TFieldValues>,
      currentValues: TFieldValues,
    ): Promise<FieldError | undefined> => {
      const rules = rulesRef.current[name];
      if (!rules) return undefined;
      const value = currentValues[name];
      const empty =
        value === "" ||
        value === null ||
        value === undefined ||
        (typeof value === "number" && Number.isNaN(value)) ||
        value === false ||
        (Array.isArray(value) && value.length === 0);
      const unpack = <T>(rule: ValidationRule<T>): { value: T; message?: string } =>
        typeof rule === "object" && rule !== null && "value" in rule
          ? (rule as { value: T; message: string })
          : { value: rule as T };
      const required = rules.required;
      if (required && empty && (typeof required === "string" || required.value)) {
        return { message: typeof required === "string" ? required : required.message };
      }
      if (!empty) {
        if (rules.minLength !== undefined) {
          const rule = unpack(rules.minLength);
          if (typeof value === "string" && value.length < rule.value)
            return { message: rule.message ?? `Must be at least ${rule.value} characters` };
        }
        if (rules.maxLength !== undefined) {
          const rule = unpack(rules.maxLength);
          if (typeof value === "string" && value.length > rule.value)
            return { message: rule.message ?? `Must be at most ${rule.value} characters` };
        }
        if (rules.min !== undefined) {
          const rule = unpack(rules.min);
          if (typeof value === "number" && value < rule.value)
            return { message: rule.message ?? `Must be at least ${rule.value}` };
        }
        if (rules.max !== undefined) {
          const rule = unpack(rules.max);
          if (typeof value === "number" && value > rule.value)
            return { message: rule.message ?? `Must be at most ${rule.value}` };
        }
        if (rules.pattern !== undefined) {
          const rule = unpack(rules.pattern);
          rule.value.lastIndex = 0;
          if (typeof value === "string" && !rule.value.test(value))
            return { message: rule.message ?? "Invalid format" };
        }
      }
      if (rules.validate) {
        try {
          const result = await rules.validate(value, currentValues);
          if (typeof result === "string") return { message: result };
        } catch {
          return { message: "Validation failed" };
        }
      }
      return undefined;
    },
    [],
  );

  const validateField = useCallback(
    async (
      name: Path<TFieldValues>,
      currentValues: TFieldValues,
    ): Promise<FieldError | undefined> => {
      try {
        if (rulesRef.current[name]) {
          const ruleError = await validateRules(name, currentValues);
          if (ruleError) return ruleError;
        }
        if (!validate) return undefined;
        const result = await validate(currentValues);
        return result.errors?.[name];
      } catch {
        // If validation throws, treat as error
        return { message: "Validation failed" };
      }
    },
    [validate, validateRules],
  );

  const validateAll = useCallback(
    async (currentValues: TFieldValues): Promise<ValidationResult<TFieldValues>> => {
      try {
        const result = validate
          ? await validate(currentValues)
          : { values: currentValues, errors: {} as FieldErrors<TFieldValues> };
        const errors = { ...result.errors };
        for (const name of Object.keys(rulesRef.current) as Path<TFieldValues>[]) {
          const ruleError = await validateRules(name, currentValues);
          if (ruleError) errors[name] = ruleError;
        }
        return { ...result, values: result.values ?? currentValues, errors };
      } catch {
        // A throwing validator is treated as a validation failure at the
        // form level, consistent with the field-level fallback in
        // `validateField` ("Validation failed" on the field). This keeps
        // error handling consistent: a throwing validator never silently
        // passes validation.
        return {
          values: currentValues,
          errors: { root: { message: "Validation failed" } } as FieldErrors<TFieldValues>,
        };
      }
    },
    [validate, validateRules],
  );

  const runValidation = useCallback(
    async (name?: Path<TFieldValues>): Promise<boolean> => {
      // Always read from the ref so we get the latest values even when
      // React has not yet flushed the state update (stale closure guard).
      const currentValues = valuesRef.current;

      // Capture the current sequence so a result that resolves after a newer
      // validation run (or a reset) started is discarded, not committed.
      if (name) {
        const seq = (fieldValidationSeqRef.current[name] ?? 0) + 1;
        fieldValidationSeqRef.current[name] = seq;
        const fieldError = await validateField(name, currentValues);
        const valid = !fieldError;
        if (seq !== fieldValidationSeqRef.current[name]) return valid;
        const next = { ...errorsRef.current };
        if (fieldError) {
          next[name] = fieldError;
        } else {
          delete next[name];
        }
        commitErrors(next);
        return valid;
      } else {
        const seq = ++validationSeqRef.current;
        const result = await validateAll(currentValues);
        const allErrors = result.errors;
        const valid = Object.keys(allErrors).length === 0;
        if (seq !== validationSeqRef.current) return valid;
        commitErrors(allErrors);
        return valid;
      }
    },
    [validate, validateField, validateAll, commitErrors],
  );

  const clearErrors = useCallback(
    (name?: Path<TFieldValues> | "root") => {
      if (!name) {
        if (Object.keys(errorsRef.current).length === 0) return;
        commitErrors({});
      } else {
        if (!errorsRef.current[name]) return;
        const next = { ...errorsRef.current };
        delete next[name];
        commitErrors(next);
      }
    },
    [commitErrors],
  );

  /**
   * Sets a single error on a field (or the reserved `"root"` key for
   * form-level errors), e.g. from a server/API response. Stored like a
   * validation error: it makes `isValid` `false`, is included in the errors
   * passed to `handleSubmit`'s `onError`, and is cleared by `clearErrors`.
   */
  const setError = useCallback(
    (name: Path<TFieldValues> | "root", error: FieldError | string) => {
      commitErrors({
        ...errorsRef.current,
        [name]: typeof error === "string" ? { message: error } : error,
      });
    },
    [commitErrors],
  );

  /**
   * Sets multiple errors at once, merging into the current errors. Accepts
   * the same shape as `errors`, including the `"root"` key.
   */
  const setErrors = useCallback(
    (errors: FieldErrors<TFieldValues>) => {
      commitErrors({ ...errorsRef.current, ...errors });
    },
    [commitErrors],
  );

  /**
   * Programmatic value update. Does not run validation, touch or mark the
   * field dirty unless requested through {@link SetValueOptions}.
   */
  const setValue = useCallback(
    <TPath extends Path<TFieldValues>>(
      name: TPath,
      value: TFieldValues[TPath],
      setValueOptions?: SetValueOptions,
    ) => {
      // Eagerly update the ref so trigger() and subscribers read the correct
      // value even before React flushes the state update.
      valuesRef.current = { ...valuesRef.current, [name]: value };
      setValues((prev) => {
        const next: TFieldValues = { ...prev };
        next[name] = value;
        return next;
      });

      if (setValueOptions?.shouldTouch && touchedRef.current[name] !== true) {
        touchedRef.current = { ...touchedRef.current, [name]: true };
        setTouchedFields(touchedRef.current);
      }

      if (setValueOptions?.shouldDirty) {
        if (dirtyOverridesRef.current[name] !== true) {
          dirtyOverridesRef.current = { ...dirtyOverridesRef.current, [name]: true };
          setDirtyOverrides(dirtyOverridesRef.current);
        }
      } else if (
        setValueOptions?.shouldDirty === false &&
        dirtyOverridesRef.current[name] === true
      ) {
        const next = { ...dirtyOverridesRef.current };
        delete next[name];
        dirtyOverridesRef.current = next;
        setDirtyOverrides(next);
      }

      notifyFields([name]);

      if (setValueOptions?.shouldValidate) {
        void runValidation(name);
      }
    },
    [runValidation, notifyFields],
  );

  /**
   * Updates a field's value as if the user changed it (the shared core of
   * `register()`'s `onChange` and `Controller`'s `field.onChange`). Runs the
   * configured validation behavior.
   */
  const handleFieldChange = useCallback(
    (name: Path<TFieldValues>, nextValue: unknown) => {
      valuesRef.current = {
        ...valuesRef.current,
        [name]: nextValue as TFieldValues[Path<TFieldValues>],
      };
      setValues((prev) => {
        const next: TFieldValues = { ...prev };
        (next as Record<string, unknown>)[name] = nextValue;
        return next;
      });

      notifyFields([name]);

      // Handle validation on change
      if (mode === "onChange") {
        void runValidation(name);
      }

      // Handle re-validation on change when a field already has an error
      if (reValidateMode === "onChange" && errorsRef.current[name]) {
        void runValidation(name);
      }
    },
    [mode, reValidateMode, runValidation, notifyFields],
  );

  /**
   * Marks a field as touched as if it lost focus (the shared core of
   * `register()`'s `onBlur` and `Controller`'s `field.onBlur`). Runs the
   * configured validation behavior.
   */
  const handleFieldBlur = useCallback(
    (name: Path<TFieldValues>) => {
      if (touchedRef.current[name] !== true) {
        touchedRef.current = { ...touchedRef.current, [name]: true };
        setTouchedFields(touchedRef.current);
        notifyFields([name]);
      }

      // Handle validation on blur
      if (mode === "onBlur") {
        void runValidation(name);
      }

      // Handle re-validation on blur when a field already has an error.
      // Read from errorsRef so we see the latest error state.
      if (reValidateMode === "onBlur" && errorsRef.current[name]) {
        void runValidation(name);
      }
    },
    [mode, reValidateMode, runValidation, notifyFields],
  );

  // The stable control object delegates stateful mutations through `apiRef`
  // so it always uses the latest callbacks even if options change between
  // renders. Everything else it exposes reads refs directly.
  const apiRef = useRef<{
    updateField: (name: Path<TFieldValues>, value: unknown) => void;
    blurField: (name: Path<TFieldValues>) => void;
  }>({
    updateField: () => {},
    blurField: () => {},
  });
  apiRef.current = { updateField: handleFieldChange, blurField: handleFieldBlur };

  const controlRef = useRef<Control<TFieldValues> | null>(null);
  if (controlRef.current === null) {
    controlRef.current = {
      subscribe: (listener) => store.subscribe(listener),
      subscribeField: (name, listener) => store.subscribeField(name, listener),
      getSnapshot: () => store.getVersion(),
      getValues: () => deepClone(valuesRef.current),
      getValue: <TPath extends Path<TFieldValues>>(name: TPath): TFieldValues[TPath] =>
        deepClone(valuesRef.current[name]) as TFieldValues[TPath],
      getFieldState: (name) => readFieldState(name),
      updateField: (name, value) => apiRef.current.updateField(name, value),
      blurField: (name) => apiRef.current.blurField(name),
      setFieldRef: (name, element) => {
        rememberFieldRef(name, element);
      },
    };
  }
  const control = controlRef.current as Control<TFieldValues>;

  const resetField = useCallback(
    (name: Path<TFieldValues>) => {
      // Invalidate any in-flight validation of this field so its stale result
      // is not committed after the reset.
      validationSeqRef.current += 1;
      fieldValidationSeqRef.current[name] = (fieldValidationSeqRef.current[name] ?? 0) + 1;
      const defaultValue = (defaults as Record<string, unknown>)[name];
      (valuesRef.current as Record<string, unknown>)[name] = defaultValue;
      setValues((prev) => {
        const next: TFieldValues = { ...prev };
        (next as Record<string, unknown>)[name] = defaultValue;
        return next;
      });

      if (touchedRef.current[name] === true) {
        touchedRef.current = { ...touchedRef.current, [name]: false };
        setTouchedFields(touchedRef.current);
      }

      if (errorsRef.current[name]) {
        const next = { ...errorsRef.current };
        delete next[name];
        errorsRef.current = next;
        forceUpdate((n) => n + 1);
      }

      if (dirtyOverridesRef.current[name] === true) {
        const next = { ...dirtyOverridesRef.current };
        delete next[name];
        dirtyOverridesRef.current = next;
        setDirtyOverrides(next);
      }

      notifyFields([name]);
    },
    [defaults, notifyFields],
  );

  const handleSubmit = useCallback(
    async (event?: { preventDefault: () => void }) => {
      // Always prevent the browser's default form submission behavior,
      // even for duplicate attempts that are ignored below.
      event?.preventDefault?.();

      // Ignore duplicate submissions while one is already in progress.
      if (isSubmittingRef.current) return;

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setIsSubmitted(true);
      setSubmitCount((count) => count + 1);

      try {
        // Bump the validation sequence so in-flight field validations do not
        // overwrite the submission result, and so a `reset()` called while
        // validation is pending discards this stale result below.
        const seq = ++validationSeqRef.current;
        const result = await validateAll(valuesRef.current);

        if (seq === validationSeqRef.current) {
          commitErrors(result.errors);
        }

        if (Object.keys(result.errors).length === 0) {
          // Pass the parsed/transformed values (e.g. Zod coercion) when the
          // resolver provides them; otherwise fall back to the raw values.
          await onSubmit?.(result.values ?? valuesRef.current);
        } else {
          onError?.(result.errors);
          if (shouldFocusError) focusFirstError(result.errors);
        }
      } finally {
        // Always reset the loading state, even if onSubmit throws.
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [validateAll, onSubmit, onError, commitErrors, shouldFocusError, focusFirstError],
  );

  const reset = useCallback(
    (nextValues?: TFieldValues) => {
      // Invalidate any in-flight validation/submission results so they are
      // not committed after the form is reset.
      validationSeqRef.current += 1;
      for (const name of Object.keys(valuesRef.current)) {
        fieldValidationSeqRef.current[name] = (fieldValidationSeqRef.current[name] ?? 0) + 1;
      }
      const resetValues =
        nextValues === undefined
          ? deepClone(defaultValuesRef.current as TFieldValues)
          : deepClone(nextValues);

      valuesRef.current = resetValues;
      setValues(resetValues);

      const nextTouched = initialTouchedState(resetValues);
      touchedRef.current = nextTouched;
      setTouchedFields(nextTouched);

      dirtyOverridesRef.current = {};
      setDirtyOverrides({});

      // Reset the submission state as well.
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setIsSubmitted(false);
      setSubmitCount(0);

      errorsRef.current = {};
      forceUpdate((n) => n + 1);

      notifyFields(Object.keys(resetValues));
    },
    [notifyFields],
  );

  const register = useCallback(
    <TPath extends Path<TFieldValues>>(
      name: TPath,
      registerOptions?: RegisterOptions<TFieldValues, TPath>,
    ): UseSmartFormRegisterReturn<TFieldValues, TPath> => {
      const currentValue = values[name] as TFieldValues[TPath];
      if (registerOptions) {
        rulesRef.current[name] = registerOptions as unknown as RegisterOptions<
          TFieldValues,
          Path<TFieldValues>
        >;
      } else {
        delete rulesRef.current[name];
      }

      const onChange: ChangeHandler = (...event) => {
        const target = (event[0] as { target?: HTMLInputElement | HTMLSelectElement } | undefined)
          ?.target;
        if (
          registerOptions?.type === "radio" &&
          target instanceof HTMLInputElement &&
          !target.checked
        )
          return;
        const nextValue =
          registerOptions?.type === "checkbox"
            ? Boolean(target instanceof HTMLInputElement && target.checked)
            : registerOptions?.type === "radio"
              ? registerOptions.value
              : registerOptions?.type === "select-multiple" && target instanceof HTMLSelectElement
                ? Array.from(target.selectedOptions, (option) => option.value)
                : (getEventValue(event[0]) ?? currentValue);
        handleFieldChange(name, nextValue);
      };

      const onBlur: ChangeHandler = () => {
        handleFieldBlur(name);
      };

      const ref = (element: HTMLElement | null) => {
        rememberFieldRef(name, element);
      };

      const base = {
        name,
        onChange,
        onBlur,
        ref,
      };
      if (registerOptions?.type === "checkbox") {
        return { ...base, checked: Boolean(currentValue) } as unknown as UseSmartFormRegisterReturn<
          TFieldValues,
          TPath
        >;
      }
      if (registerOptions?.type === "radio") {
        return {
          ...base,
          value: registerOptions.value as TFieldValues[TPath],
          checked: deepEqual(currentValue, registerOptions.value),
        };
      }
      return { ...base, value: toDisplayValue(currentValue) as TFieldValues[TPath] };
    },
    [values, handleFieldChange, handleFieldBlur, rememberFieldRef],
  );

  const watch = useCallback((nameOrNames?: Path<TFieldValues> | readonly Path<TFieldValues>[]) => {
    if (nameOrNames === undefined) {
      return deepClone(valuesRef.current);
    }
    if (Array.isArray(nameOrNames)) {
      return nameOrNames.map((name) =>
        deepClone((valuesRef.current as Record<string, unknown>)[name]),
      );
    }
    const singleName = nameOrNames as Path<TFieldValues>;
    return deepClone((valuesRef.current as Record<string, unknown>)[singleName]);
  }, []) as unknown as WatchFunction<TFieldValues>;

  const returnRef = useRef<UseSmartFormReturn<TFieldValues> | null>(null);

  // Build the return object once and expose `errors` / `isValid` as getters
  // so they always read from errorsRef.current at the moment of access.
  // This ensures tests can read the latest errors immediately after
  // `await trigger()` or `clearErrors()` without waiting for a React re-render.
  if (returnRef.current === null) {
    returnRef.current = {
      getValues,
      getValue,
      setValue,
      setFocus,
      reset,
      register: register as RegisterFunction<TFieldValues>,
      watch,
      dirtyFields,
      touchedFields: touchedFields as Record<keyof TFieldValues, boolean>,
      getFieldState,
      isDirty,
      trigger: runValidation,
      clearErrors,
      setError,
      setErrors,
      resetField,
      handleSubmit,
      control,
      isSubmitting,
      isSubmitted,
      submitCount,
      get errors() {
        return errorsRef.current;
      },
      get isValid() {
        return Object.keys(errorsRef.current).length === 0;
      },
    };
  } else {
    // Keep all non-getter properties up to date on every render.
    const r = returnRef.current;
    r.getValues = getValues;
    r.getValue = getValue;
    r.setValue = setValue;
    r.setFocus = setFocus;
    r.reset = reset;
    r.register = register as RegisterFunction<TFieldValues>;
    r.watch = watch;
    r.dirtyFields = dirtyFields;
    r.touchedFields = touchedFields as Record<keyof TFieldValues, boolean>;
    r.getFieldState = getFieldState;
    r.isDirty = isDirty;
    r.trigger = runValidation;
    r.clearErrors = clearErrors;
    r.setError = setError;
    r.setErrors = setErrors;
    r.resetField = resetField;
    r.handleSubmit = handleSubmit;
    r.control = control;
    r.isSubmitting = isSubmitting;
    r.isSubmitted = isSubmitted;
    r.submitCount = submitCount;
  }

  return returnRef.current as UseSmartFormReturn<TFieldValues>;
}
