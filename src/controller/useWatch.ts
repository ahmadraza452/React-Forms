import { useCallback, useSyncExternalStore } from "react";

import type { FieldValues, Path, UseWatchProps } from "../core/types";

/**
 * Watches one field (or the whole form) from any component that has access to
 * the form's `control`.
 *
 * ```tsx
 * const email = useWatch({ control: form.control, name: "email" });
 * const allValues = useWatch({ control: form.control });
 * ```
 *
 * The returned value stays in sync with the form and the component re-renders
 * only when the watched field(s) change.
 */
export function useWatch<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>(
  props: UseWatchProps<TFieldValues> & { name: TName },
): TFieldValues[TName];
export function useWatch<TFieldValues extends FieldValues>(
  props: UseWatchProps<TFieldValues>,
): TFieldValues;
export function useWatch<
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues> | undefined,
>(
  props: UseWatchProps<TFieldValues> & { name?: TName },
): TFieldValues | TFieldValues[Path<TFieldValues>] {
  const { control, name } = props;

  const subscribe = useCallback(
    (listener: () => void) =>
      name === undefined ? control.subscribe(listener) : control.subscribeField(name, listener),
    [control, name],
  );
  const getSnapshot = useCallback(() => control.getSnapshot(), [control]);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (name === undefined) {
    return control.getValues();
  }
  return control.getValue(name as Path<TFieldValues>) as TFieldValues[Path<TFieldValues>];
}
