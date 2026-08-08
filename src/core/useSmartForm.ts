import { useCallback, useMemo, useRef, useState } from "react";

import { deepClone } from "../utils/deepClone";
import { deepEqual } from "../utils/deepEqual";
import type {
  FieldValues,
  Path,
  UseSmartFormOptions,
  UseSmartFormReturn,
} from "./types";

/**
 * Manages the state of a form: values, default values, single-field reads and
 * writes, reset, and basic form state.
 *
 * The form keeps its own copy of `defaultValues` and never mutates the object
 * passed by the caller.
 */
export function useSmartForm<TFieldValues extends FieldValues>(
  options: UseSmartFormOptions<TFieldValues>,
): UseSmartFormReturn<TFieldValues> {
  const defaultValuesRef = useRef<TFieldValues | null>(null);
  if (defaultValuesRef.current === null) {
    defaultValuesRef.current = deepClone(options.defaultValues);
  }

  const [values, setValues] = useState<TFieldValues>(() => deepClone(options.defaultValues));

  const isDirty = useMemo(
    () => !deepEqual(values, defaultValuesRef.current as TFieldValues),
    [values],
  );

  const getValues = useCallback((): TFieldValues => deepClone(values), [values]);

  const getValue = useCallback(
    <TPath extends Path<TFieldValues>>(name: TPath): TFieldValues[TPath] =>
      deepClone(values[name]) as TFieldValues[TPath],
    [values],
  );

  const setValue = useCallback(
    <TPath extends Path<TFieldValues>>(name: TPath, value: TFieldValues[TPath]) => {
      setValues((prev) => {
        const next: TFieldValues = { ...prev };
        next[name] = value;
        return next;
      });
    },
    [],
  );

  const reset = useCallback((nextValues?: TFieldValues) => {
    if (nextValues === undefined) {
      setValues(deepClone(defaultValuesRef.current as TFieldValues));
    } else {
      setValues(deepClone(nextValues));
    }
  }, []);

  return { getValues, getValue, setValue, reset, isDirty };
}
