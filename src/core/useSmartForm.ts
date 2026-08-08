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
  SetValueOptions,
  UseSmartFormOptions,
  UseSmartFormRegisterReturn,
  UseSmartFormReturn,
  ValidationResult,
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
  const { validate, mode = "onSubmit", reValidateMode = "onChange", onSubmit, onError } = options;

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

  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

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
      if (mode === "onChange" && validate) {
        void runValidation(name);
      }

      // Handle re-validation on change when a field already has an error
      if (reValidateMode === "onChange" && validate && errorsRef.current[name]) {
        void runValidation(name);
      }
    },
    [mode, reValidateMode, validate, runValidation, notifyFields],
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
      if (mode === "onBlur" && validate) {
        void runValidation(name);
      }

      // Handle re-validation on blur when a field already has an error.
      // Read from errorsRef so we see the latest error state.
      if (reValidateMode === "onBlur" && validate && errorsRef.current[name]) {
        void runValidation(name);
      }
    },
    [mode, reValidateMode, validate, runValidation, notifyFields],
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
        fieldRefs.current[name] = element;
      },
    };
  }
  const control = controlRef.current as Control<TFieldValues>;

  const resetField = useCallback(
    (name: Path<TFieldValues>) => {
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
    ): UseSmartFormRegisterReturn<TFieldValues, TPath> => {
      const currentValue = values[name] as TFieldValues[TPath];

      const onChange: ChangeHandler = (...event) => {
        const nextValue = getEventValue(event[0]) ?? currentValue;
        handleFieldChange(name, nextValue);
      };

      const onBlur: ChangeHandler = () => {
        handleFieldBlur(name);
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
    [values, handleFieldChange, handleFieldBlur],
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
      reset,
      register,
      watch,
      dirtyFields,
      touchedFields: touchedFields as Record<keyof TFieldValues, boolean>,
      getFieldState,
      isDirty,
      trigger: runValidation,
      clearErrors,
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
    r.reset = reset;
    r.register = register;
    r.watch = watch;
    r.dirtyFields = dirtyFields;
    r.touchedFields = touchedFields as Record<keyof TFieldValues, boolean>;
    r.getFieldState = getFieldState;
    r.isDirty = isDirty;
    r.trigger = runValidation;
    r.clearErrors = clearErrors;
    r.resetField = resetField;
    r.handleSubmit = handleSubmit;
    r.control = control;
    r.isSubmitting = isSubmitting;
    r.isSubmitted = isSubmitted;
    r.submitCount = submitCount;
  }

  return returnRef.current as UseSmartFormReturn<TFieldValues>;
}
