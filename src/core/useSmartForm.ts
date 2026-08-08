import { useCallback, useMemo, useRef, useState } from "react";

import { deepClone } from "../utils/deepClone";
import { deepEqual } from "../utils/deepEqual";
import type {
  ChangeHandler,
  FieldError,
  FieldErrors,
  FieldState,
  FieldValues,
  Path,
  UseSmartFormOptions,
  UseSmartFormRegisterReturn,
  UseSmartFormReturn,
  ValidationResult,
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
 * single-field reads and writes, reset, and form state.
 *
 * The form keeps its own copy of `defaultValues` and never mutates the object
 * passed by the caller.
 */
export function useSmartForm<TFieldValues extends FieldValues>(
  options: UseSmartFormOptions<TFieldValues>,
): UseSmartFormReturn<TFieldValues> {
  const { validate, mode = "onSubmit", reValidateMode = "onChange", onSubmit, onError } = options;

  const defaultValuesRef = useRef<TFieldValues | null>(null);
  if (defaultValuesRef.current === null) {
    defaultValuesRef.current = deepClone(options.defaultValues);
  }

  const [values, setValues] = useState<TFieldValues>(() => deepClone(options.defaultValues));

  /**
   * Always holds the latest values snapshot so async callbacks (runValidation,
   * register onChange) never read stale state from a closed-over render.
   */
  const valuesRef = useRef<TFieldValues>(values);
  valuesRef.current = values;

  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>(() =>
    initialTouchedState(options.defaultValues),
  );

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
   * Writes new errors to the ref (immediate) and schedules a React re-render.
   * Because errorsRef.current is updated synchronously, the return value of
   * `form.errors` and `form.isValid` reflect the new state before the next
   * render cycle.
   */
  const commitErrors = useCallback((next: FieldErrors<TFieldValues>) => {
    errorsRef.current = next;
    forceUpdate((n) => n + 1);
  }, []);

  // -------------------------------------------------------------------
  // Submission state: isSubmitting, isSubmitted, submitCount.
  // `isSubmittingRef` mirrors `isSubmitting` so the duplicate-submission
  // guard in handleSubmit can be checked synchronously, before any await.
  // -------------------------------------------------------------------
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const isSubmittingRef = useRef(false);

  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  const defaults = defaultValuesRef.current as TFieldValues;

  const dirtyFields = useMemo<Record<keyof TFieldValues, boolean>>(() => {
    const result = {} as Record<keyof TFieldValues, boolean>;
    for (const key of Object.keys(values)) {
      result[key as keyof TFieldValues] = !deepEqual(
        (values as Record<string, unknown>)[key],
        (defaults as Record<string, unknown>)[key],
      );
    }
    return result;
  }, [values]);

  const isDirty = useMemo(() => !deepEqual(values, defaults), [values]);

  const getValues = useCallback((): TFieldValues => deepClone(valuesRef.current), []);

  const getValue = useCallback(
    <TPath extends Path<TFieldValues>>(name: TPath): TFieldValues[TPath] =>
      deepClone(valuesRef.current[name]) as TFieldValues[TPath],
    [],
  );

  const setValue = useCallback(
    <TPath extends Path<TFieldValues>>(name: TPath, value: TFieldValues[TPath]) => {
      // Eagerly update the ref so trigger() reads the correct value
      // even before React flushes the state update.
      valuesRef.current = { ...valuesRef.current, [name]: value };
      setValues((prev) => {
        const next: TFieldValues = { ...prev };
        next[name] = value;
        return next;
      });
    },
    [],
  );

  const validateField = useCallback(
    async (
      name: Path<TFieldValues>,
      currentValues: TFieldValues,
    ): Promise<FieldError | undefined> => {
      if (!validate) return undefined;

      try {
        const result = await validate(currentValues);
        const fieldError = result.errors?.[name];
        return fieldError;
      } catch {
        // If validation throws, treat as error
        return { message: "Validation failed" };
      }
    },
    [validate],
  );

  const validateAll = useCallback(
    async (currentValues: TFieldValues): Promise<ValidationResult<TFieldValues>> => {
      if (!validate) {
        return { values: currentValues, errors: {} };
      }

      try {
        return await validate(currentValues);
      } catch {
        // If validation throws, treat as valid with no errors
        return { values: currentValues, errors: {} };
      }
    },
    [validate],
  );

  const runValidation = useCallback(
    async (name?: Path<TFieldValues>): Promise<boolean> => {
      if (!validate) return true;

      // Always read from the ref so we get the latest values even when
      // React has not yet flushed the state update (stale closure guard).
      const currentValues = valuesRef.current;

      if (name) {
        const fieldError = await validateField(name, currentValues);
        const next = { ...errorsRef.current };
        if (fieldError) {
          next[name] = fieldError;
        } else {
          delete next[name];
        }
        commitErrors(next);
        return !fieldError;
      } else {
        const result = await validateAll(currentValues);
        const allErrors = result.errors;
        commitErrors(allErrors);
        return Object.keys(allErrors).length === 0;
      }
    },
    [validate, validateField, validateAll, commitErrors],
  );

  const clearErrors = useCallback(
    (name?: Path<TFieldValues>) => {
      if (!name) {
        commitErrors({});
      } else {
        const next = { ...errorsRef.current };
        delete next[name];
        commitErrors(next);
      }
    },
    [commitErrors],
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
        const result = await validateAll(valuesRef.current);
        commitErrors(result.errors);

        if (Object.keys(result.errors).length === 0) {
          // Pass the parsed/transformed values (e.g. Zod coercion) when the
          // resolver provides them; otherwise fall back to the raw values.
          await onSubmit?.(result.values ?? valuesRef.current);
        } else {
          onError?.(result.errors);
        }
      } finally {
        // Always reset the loading state, even if onSubmit throws.
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [validateAll, onSubmit, onError, commitErrors],
  );

  const reset = useCallback(
    (nextValues?: TFieldValues) => {
      if (nextValues === undefined) {
        const resetValues = deepClone(defaultValuesRef.current as TFieldValues);
        valuesRef.current = resetValues;
        setValues(resetValues);
        setTouchedFields(initialTouchedState(defaultValuesRef.current as TFieldValues));
      } else {
        const resetValues = deepClone(nextValues);
        valuesRef.current = resetValues;
        setValues(resetValues);
        setTouchedFields(initialTouchedState(nextValues));
      }
      commitErrors({});
      // Reset the submission state as well.
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setIsSubmitted(false);
      setSubmitCount(0);
    },
    [commitErrors],
  );

  const register = useCallback(
    <TPath extends Path<TFieldValues>>(
      name: TPath,
    ): UseSmartFormRegisterReturn<TFieldValues, TPath> => {
      const currentValue = values[name] as TFieldValues[TPath];

      const onChange: ChangeHandler = (...event) => {
        const target = (event[0] as { target?: EventTarget | null } | undefined)?.target;
        let nextValue: unknown;
        if (target instanceof HTMLInputElement) {
          nextValue = target.type === "number" ? target.valueAsNumber : target.value;
        } else if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
          nextValue = target.value;
        } else {
          nextValue = currentValue;
        }

        // Eagerly update the ref so validation triggered below sees the new value.
        valuesRef.current = {
          ...valuesRef.current,
          [name]: nextValue as TFieldValues[typeof name],
        };

        setValues((prev) => {
          const next: TFieldValues = { ...prev };
          next[name] = nextValue as TFieldValues[TPath];
          return next;
        });

        // Handle validation on change
        if (mode === "onChange" && validate) {
          void runValidation(name);
        }

        // Handle re-validation on change when a field already has an error
        if (reValidateMode === "onChange" && validate && errorsRef.current[name]) {
          void runValidation(name);
        }
      };

      const onBlur: ChangeHandler = () => {
        setTouchedFields((prev) => ({ ...prev, [name]: true }));

        // Handle validation on blur
        if (mode === "onBlur" && validate) {
          void runValidation(name);
        }

        // Handle re-validation on blur when a field already has an error.
        // Read from errorsRef so we see the latest error state.
        if (reValidateMode === "onBlur" && validate && errorsRef.current[name]) {
          void runValidation(name);
        }
      };

      const ref = (element: HTMLElement | null) => {
        fieldRefs.current[name] = element;
      };

      return {
        name,
        value: toDisplayValue(currentValue) as TFieldValues[TPath],
        onChange,
        onBlur,
        ref,
      };
    },
    [values, mode, reValidateMode, runValidation, validate],
  );

  const getFieldState = useCallback(
    <TPath extends Path<TFieldValues>>(name: TPath): FieldState<TFieldValues, TPath> => ({
      value: deepClone(values[name]) as TFieldValues[TPath],
      touched: touchedFields[name] === true,
      dirty: dirtyFields[name] === true,
      error: errorsRef.current[name],
      invalid: !!errorsRef.current[name],
    }),
    [values, touchedFields, dirtyFields],
  );

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
      reset,
      register,
      dirtyFields,
      touchedFields: touchedFields as Record<keyof TFieldValues, boolean>,
      getFieldState,
      isDirty,
      trigger: runValidation,
      clearErrors,
      handleSubmit,
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
    r.reset = reset;
    r.register = register;
    r.dirtyFields = dirtyFields;
    r.touchedFields = touchedFields as Record<keyof TFieldValues, boolean>;
    r.getFieldState = getFieldState;
    r.isDirty = isDirty;
    r.trigger = runValidation;
    r.clearErrors = clearErrors;
    r.handleSubmit = handleSubmit;
    r.isSubmitting = isSubmitting;
    r.isSubmitted = isSubmitted;
    r.submitCount = submitCount;
  }

  return returnRef.current;
}
